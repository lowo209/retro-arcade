import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest } from './build-hosted.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function verifyR2({ root = ROOT, request = fetch, releaseDirectory = '.local/r2-release' } = {}) {
  const release = path.resolve(root, releaseDirectory);
  if (!release.startsWith(path.resolve(root, '.local') + path.sep)) throw new Error('Verification reports must stay in the local release directory.');
  const plan = JSON.parse(fs.readFileSync(path.join(release, 'upload-plan.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(release, 'library.pending.json'), 'utf8'));
  const origin = 'https://lowo209.github.io';
  for (const file of plan.files) {
    const url = new URL(file.key, plan.publicBase).href;
    const response = await request(url, { method: 'HEAD', headers: { Origin: origin }, signal: AbortSignal.timeout(30000) });
    if (!response.ok || Number(response.headers.get('content-length')) !== file.bytes) throw new Error(`Missing or incomplete remote object: ${file.key}`);
    if (![origin, '*'].includes(response.headers.get('access-control-allow-origin'))) throw new Error(`CORS unavailable: ${file.key}`);
    // r2.dev omits custom S3 metadata. Verify its public ETag against the local
    // single-PUT / 32 MiB multipart checksum; the uploader also verifies SHA-256
    // metadata through authenticated S3 HEAD after each completed upload.
    if (!file.etag || response.headers.get('etag')?.replace(/^"|"$/g, '') !== file.etag) throw new Error(`Remote ETag mismatch: ${file.key}`);
    if (file.contentType.startsWith('text/javascript') && !/javascript/.test(response.headers.get('content-type') || '')) throw new Error(`JavaScript MIME type missing: ${file.key}`);
    if (/\.(zip|bin|data)$/.test(file.key)) {
      const range = await request(url, { headers: { Origin: origin, Range: 'bytes=0-31' }, signal: AbortSignal.timeout(30000) });
      if (range.status !== 206 || range.headers.get('content-range') !== `bytes 0-31/${file.bytes}`) { await range.body?.cancel(); throw new Error(`Byte range unavailable: ${file.key}`); }
      const remote = Buffer.from(await range.arrayBuffer());
      const local = Buffer.alloc(32), input = fs.openSync(path.join(root, file.file), 'r');
      try { fs.readSync(input, local, 0, 32, 0); } finally { fs.closeSync(input); }
      if (!remote.equals(local)) throw new Error(`Remote bytes differ: ${file.key}`);
    }
  }
  const cors = await request(new URL(plan.files[0].key, plan.publicBase), { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'range' }, signal: AbortSignal.timeout(30000) });
  if (!cors.ok || ![origin, '*'].includes(cors.headers.get('access-control-allow-origin'))) throw new Error('Range preflight failed.');
  manifest.verifiedAt = new Date().toISOString();
  validateManifest(manifest);
  // Kept local until the public URL has also passed a real browser game launch.
  fs.writeFileSync(path.join(release, 'library.verified.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { objectsVerified: plan.files.length, readyGames: manifest.games.filter(game => game.ready).length, manifest: path.join(release, 'library.verified.json') };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await verifyR2());
