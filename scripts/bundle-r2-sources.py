import json, sys, urllib.request, urllib.parse, shutil, hashlib
from pathlib import Path
sys.path.insert(0, str(Path('.local/python-deps').resolve()))
import py7zr
root=Path.cwd(); output=root/'.local/r2-extra'; sources=output/'sources'; sources.mkdir(parents=True,exist_ok=True)
def api(url):
    req=urllib.request.Request(url, headers={'User-Agent':'RetroArcade-source-bundle','Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(req,timeout=60) as response: return json.load(response)
def commit(repo, before, branch=None):
    query=urllib.parse.urlencode({'until':before,'per_page':1,**({'sha':branch} if branch else {})})
    return api('https://api.github.com/repos/'+repo+'/commits?'+query)[0]['sha']
projects=[
 ('EmulatorJS/EmulatorJS','v4.2.3','Frontend 4.2.3'),
 ('EmulatorJS/build','b24e5b535034dc7c3428d76f236d4793881969b6','Core build scripts 2.0.2'),
 ('EmulatorJS/RetroArch',commit('EmulatorJS/RetroArch','2025-06-14T18:34:16Z','next'),'RetroArch used by the June 2025 core build'),
 ('EmulatorJS/pcsx_rearmed',commit('EmulatorJS/pcsx_rearmed','2025-06-14T18:34:16Z'),'PCSX ReARMed'),
 ('EmulatorJS/mame2003-plus-libretro',commit('EmulatorJS/mame2003-plus-libretro','2025-06-14T19:09:40Z'),'MAME 2003 Plus'),
]
records=[]
for repo,ref,label in projects:
    target=sources/(repo.split('/')[1]+'-'+ref+'.tar.gz')
    if not target.exists():
        print('Downloading source:',repo,ref,flush=True)
        url='https://codeload.github.com/'+repo+'/tar.gz/'+ref
        with urllib.request.urlopen(url,timeout=120) as response, target.open('wb') as file: shutil.copyfileobj(response,file)
    records.append({'project':repo,'ref':ref,'file':target.name,'label':label,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
for core in ['pcsx_rearmed','mame2003_plus']:
    dest=output/'notices'/core; dest.mkdir(parents=True,exist_ok=True)
    with py7zr.SevenZipFile(root/'vendor/emulatorjs/data/cores'/f'{core}-wasm.data') as archive:
        archive.extract(path=dest,targets=['license.txt','build.json','core.json'])
(sources/'provenance.json').write_text(json.dumps({'sources':records,'selection':'Frontend pinned to v4.2.3. Core build configuration is 2.0.2, matching embedded build.json. Core/RetroArch snapshots use the most recent upstream commit on the configured branch before the embedded June 14 2025 build start timestamps. No core binaries were modified.'},indent=2)+'\n',encoding='utf8')
links=''.join(f'<li>{r["label"]}: <a href="{r["file"]}">source archive</a> · <a href="https://github.com/{r["project"]}/tree/{r["ref"]}">upstream commit</a></li>' for r in records)
(sources/'index.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Emulator sources</title></head><body><h1>Emulator source code and build scripts</h1><ul>'+links+'</ul><p><a href="provenance.json">Versions, SHA-256 hashes and build provenance</a></p><p>Core packages retain their original license.txt and build.json. The frontend’s optional update check is disabled; the modified unminified sources are served at ../vendor/emulatorjs/data/src/. No game, BIOS or cover rights are granted by these software licenses.</p></body></html>',encoding='utf8')
print('Source bundle ready:',sum(p.stat().st_size for p in output.rglob('*') if p.is_file()),'bytes',flush=True)
