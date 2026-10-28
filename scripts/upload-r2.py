"""Local-only R2 upload form. Credentials stay in memory and never enter Git/logs.

Install boto3 into .local/python-deps, prepare the allowlisted upload plan, then
run with --account ACCOUNT_ID --bucket BUCKET. Open the printed loopback URL.
"""
import argparse, hashlib, json, secrets, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from r2_upload_budget import UploadBudgetError, check_upload_budget

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / '.local/python-deps'))
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from boto3.s3.transfer import TransferConfig

parser = argparse.ArgumentParser()
parser.add_argument('--account', required=True)
parser.add_argument('--bucket', required=True)
parser.add_argument('--port', type=int, default=4321)
args = parser.parse_args()
if len(args.account) != 32 or any(c not in '0123456789abcdef' for c in args.account): raise ValueError('Invalid Cloudflare account ID')
if not args.bucket or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in args.bucket): raise ValueError('Invalid bucket name')
plan = json.loads((ROOT / '.local/r2-release/upload-plan.json').read_text(encoding='utf8'))
for item in plan['files']:
    file = (ROOT / item['file']).resolve()
    if not file.is_relative_to(ROOT) or not file.is_file() or file.stat().st_size != item['bytes']:
        raise ValueError('Upload plan input changed; prepare the release again')
    if not item['key'].startswith(plan['prefix'] + '/') or '..' in item['key'].split('/'):
        raise ValueError('Object outside the release prefix')
csrf = secrets.token_urlsafe(32)
origin = f'http://127.0.0.1:{args.port}'
state = {'phase':'ready','completed':0,'total':len(plan['files']),'bytes':0,'totalBytes':plan['totalBytes'],'current':'','error':''}
lock = threading.Lock()

def upload(access, secret):
    client = None
    try:
        client = boto3.client('s3', endpoint_url=f'https://{args.account}.r2.cloudflarestorage.com',
            aws_access_key_id=access, aws_secret_access_key=secret, region_name='auto',
            config=Config(signature_version='s3v4', retries={'max_attempts':4,'mode':'standard'},
                          request_checksum_calculation='when_required', response_checksum_validation='when_required'))
        with lock: state['current'] = 'Checking existing bucket storage and incomplete uploads'
        budget = check_upload_budget(client, args.bucket, plan['files'])
        print(f"Storage guard: projected {budget['projected_bytes']/1e9:.2f}/{budget['limit_bytes']/1e9:.2f} GB; no files deleted.", flush=True)
        transfer = TransferConfig(multipart_threshold=32*1024*1024, multipart_chunksize=32*1024*1024, max_concurrency=2)
        # Runtime/cover/source objects first, then the large game archives.
        files = sorted(plan['files'], key=lambda item: (item['bytes'] > 20_000_000, item['bytes']))
        for item in files:
            with lock: state['current'] = item['key']
            exists = False
            try:
                head = client.head_object(Bucket=args.bucket, Key=item['key'])
                exists = head['ContentLength'] == item['bytes'] and head.get('Metadata',{}).get('sha256') == item['sha256']
                if not exists: raise ValueError('A different object already exists at this release key; choose a new release prefix')
            except ClientError as error:
                if error.response.get('Error',{}).get('Code') not in ['404','NoSuchKey','NotFound']: raise
            if not exists:
                file = ROOT / item['file']
                digest = hashlib.sha256()
                with file.open('rb') as source:
                    for block in iter(lambda:source.read(4*1024*1024), b''): digest.update(block)
                if digest.hexdigest() != item['sha256']: raise ValueError('Local input changed')
                client.upload_file(str(file), args.bucket, item['key'], ExtraArgs={
                    'ContentType':item['contentType'], 'CacheControl':'public, max-age=86400',
                    'Metadata':{'sha256':item['sha256']}}, Config=transfer)
                head = client.head_object(Bucket=args.bucket, Key=item['key'])
                if head['ContentLength'] != item['bytes'] or head.get('Metadata',{}).get('sha256') != item['sha256']:
                    raise ValueError('Post-upload verification failed')
            with lock:
                state['completed'] += 1
                state['bytes'] += item['bytes']
            print(f"Uploaded/verified {state['completed']}/{state['total']}: {item['key']}",flush=True)
        with lock: state['phase']='complete'; state['current']='All objects uploaded and verified'
    except Exception as error:
        code = error.response.get('Error',{}).get('Code','UploadError') if isinstance(error,ClientError) else type(error).__name__
        # Avoid serializing SDK errors, request headers, or credentials.
        with lock:
            state['phase']='failed'
            state['error'] = f'Upload blocked: {error}' if isinstance(error, UploadBudgetError) else f'Upload stopped ({code}). Check the bucket-scoped key and retry; matching completed objects will be skipped.'
        print('Upload stopped:',code,flush=True)
    finally:
        if client: client.close()
        access = secret = None

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*_): pass
    def respond(self, code, body, kind='application/json'):
        data = body.encode('utf8')
        self.send_response(code)
        for name,value in {'Content-Type':kind,'Content-Length':str(len(data)),'Cache-Control':'no-store',
          'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
          'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'"}.items(): self.send_header(name,value)
        self.end_headers(); self.wfile.write(data)
    def allowed(self): return self.headers.get('Host') == urlsplit(origin).netloc
    def do_GET(self):
        if not self.allowed(): return self.respond(403,'{}')
        if self.path == '/status':
            with lock: body=json.dumps(state)
            return self.respond(200,body)
        if self.path != '/': return self.respond(404,'{}')
        html = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Upload Retro Arcade to R2</title><style>body{max-width:650px;margin:50px auto;padding:24px;background:#151617;color:#eee;font:16px/1.6 system-ui}label,input,button{display:block;width:100%;box-sizing:border-box}input,button{padding:12px;margin:8px 0 22px}button{background:#e18a54;border:0;font-weight:bold;cursor:pointer}progress{width:100%}small{color:#aaa}</style><h1>Upload the playable tester library</h1><p>Uploads the prepared game files, BIOS, covers, emulator and sources to <strong>__BUCKET__</strong>. Total: __SIZE__ GB.</p><p>Use an R2 <strong>Object Read &amp; Write</strong> API key limited to this bucket. Enter its S3 credentials below.</p><form id="form" autocomplete="off"><label>Access Key ID<input id="access" type="password" autocomplete="off" required></label><label>Secret Access Key<input id="secret" type="password" autocomplete="off" required></label><button>Start upload</button></form><small>Credentials stay in this local process’s memory. They are sent only to Cloudflare to authenticate the upload. They are not written to disk or included in the website.</small><h2>Progress</h2><progress id="progress" max="100" value="0"></progress><p id="status">Ready</p><script>const form=document.querySelector('#form'),status=document.querySelector('#status');form.addEventListener('submit',async event=>{event.preventDefault();const access=document.querySelector('#access'),secret=document.querySelector('#secret');const body=JSON.stringify({csrf:'__CSRF__',access:access.value,secret:secret.value});access.value='';secret.value='';const response=await fetch('/upload',{method:'POST',headers:{'Content-Type':'application/json'},body});if(!response.ok){status.textContent='Could not start upload.';return}form.hidden=true});async function poll(){const s=await(await fetch('/status')).json();document.querySelector('#progress').value=s.bytes/s.totalBytes*100;status.textContent=s.phase+' · '+s.completed+'/'+s.total+' objects · '+(s.bytes/1e9).toFixed(2)+'/'+(s.totalBytes/1e9).toFixed(2)+' GB · '+s.current+' '+s.error;if(s.phase==='failed')form.hidden=false}setInterval(poll,2000);poll();</script></html>'''
        return self.respond(200,html.replace('__BUCKET__',args.bucket).replace('__SIZE__',f"{plan['totalBytes']/1e9:.2f}").replace('__CSRF__',csrf),'text/html; charset=utf-8')
    def do_POST(self):
        if not self.allowed() or self.headers.get('Origin') != origin or self.path != '/upload': return self.respond(403,'{}')
        if self.headers.get('Content-Type') != 'application/json': return self.respond(415,'{}')
        try: size=int(self.headers.get('Content-Length','0'))
        except ValueError: return self.respond(400,'{}')
        if not 0 < size < 4096: return self.respond(400,'{}')
        try:
            value=json.loads(self.rfile.read(size))
            if not secrets.compare_digest(value.get('csrf',''),csrf) or not value.get('access') or not value.get('secret'): return self.respond(403,'{}')
            with lock:
                if state['phase']=='uploading': return self.respond(409,'{}')
                state.update(phase='uploading',completed=0,bytes=0,error='')
            threading.Thread(target=upload,args=(value['access'],value['secret']),daemon=True).start()
            value.clear(); return self.respond(202,'{"started":true}')
        except (ValueError,KeyError): return self.respond(400,'{}')

print('Local R2 upload form:',origin,flush=True)
print('No upload starts until you enter the bucket-scoped key and press Start upload.',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
