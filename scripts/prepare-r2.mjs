import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLibrary, containedFile } from '../server.mjs';
import { assetBase } from './build-hosted.mjs';
import { hashUploadFile } from './r2-integrity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function prepareR2({ root = ROOT, publicUrl, prefix = 'releases/tester-v1' } = {}) {
  const publicBase = assetBase(publicUrl);
  if (new URL(publicBase).pathname !== '/') throw new Error('Use the bucket public URL without a path.');
  if (!/^releases\/[a-zA-Z0-9_-]+$/.test(prefix)) throw new Error('Release prefix must be releases/name.');
  const base = new URL(prefix + '/', publicBase).href;
  const library = inspectLibrary(root), entries = new Map();
  if (!library.runtime || !library.bios) throw new Error('Install and verify the runtime and PS1 BIOS first.');
  function add(key, file) {
    if (!file || !fs.statSync(file).isFile()) throw new Error(`Release input missing: ${key}`);
    entries.set(key, file); return base + key;
  }
  function localAsset(url) {
    let file;
    if (/^\/media\/(umk3|nfs|gt2|re3|ac3|gits|gpolice2|mk4|sh|tekken3|ctr)\/[\w.-]+$/.test(url)) file = containedFile(path.join(root, 'private/roms'), url.slice(7));
    else if (/^\/firmware\/scph(1001|5501|5502)\.bin$/.test(url)) file = containedFile(path.join(root, 'private/bios'), path.basename(url));
    else if (/^\/covers\/(umk3|nfs|gt2|gt4|re3|ac3|gits|gpolice2|mk4|sh|tekken3|ctr)\.(png|jpe?g)$/.test(url)) file = containedFile(path.join(root, 'private/covers'), path.basename(url));
    return add(url.slice(1), file);
  }
  function game(value) {
    const result = { id: value.id, ready: value.id !== 'gt4' && value.ready, experimental: !!value.experimental, reason: value.id === 'gt4' ? 'Gran Turismo 4 needs a separate browser build and is coming later.' : value.ready ? '' : 'This game is temporarily unavailable in the tester release.' };
    if (value.coverUrl) result.coverUrl = localAsset(value.coverUrl);
    if (result.ready) {
      result.core = value.core; result.region = value.region;
      result.romUrl = localAsset(value.romUrl);
      result.downloadBytes = fs.statSync(entries.get(value.romUrl.slice(1))).size;
      if (value.biosUrl) result.biosUrl = localAsset(value.biosUrl);
    }
    if (value.alternate?.ready) result.alternate = { ...game(value.alternate), label: value.alternate.label, warning: value.alternate.warning };
    return result;
  }
  const manifest = { schema: 1, hosted: true, assetBase: base, verifiedAt: null, runtime: true, bios: true, biosName: library.biosName, games: library.games.map(game) };
  function directory(source, keyPrefix) {
    const real = fs.realpathSync(source);
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      const file = path.join(source, entry.name);
      if (entry.isSymbolicLink() || !fs.realpathSync(file).startsWith(real + path.sep)) throw new Error('Release refuses linked files.');
      if (entry.isDirectory()) directory(file, `${keyPrefix}/${entry.name}`);
      else {
        if (!/\.(js|css|json|md|txt|wasm|data|html|gz)$/.test(entry.name) && entry.name !== 'LICENSE') throw new Error(`Unexpected release file: ${entry.name}`);
        add(`${keyPrefix}/${entry.name}`, file);
      }
    }
  }
  directory(path.join(root, 'vendor/emulatorjs'), 'vendor/emulatorjs');
  for (const name of ['sources', 'notices']) directory(path.join(root, '.local/r2-extra', name), name);
  if (!entries.has('sources/index.html')) throw new Error('Bundle the corresponding emulator sources before publication.');
  const files = [];
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.zip': 'application/zip', '.gz': 'application/gzip', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.wasm': 'application/wasm' };
  for (const [key, file] of entries) {
    files.push({ key: `${prefix}/${key}`, file: path.relative(root, file).split(path.sep).join('/'), ...await hashUploadFile(file), contentType: types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  }
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (totalBytes > 9_000_000_000) throw new Error('Release exceeds the planned free storage budget.');
  const output = path.join(root, '.local/r2-release'); fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'library.pending.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'upload-plan.json'), JSON.stringify({ schema: 1, prefix, publicBase, totalBytes, files }, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'cors.json'), JSON.stringify([{ AllowedOrigins: ['https://lowo209.github.io', 'http://127.0.0.1:4174'], AllowedMethods: ['GET', 'HEAD'], AllowedHeaders: ['Range'], ExposeHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'x-amz-meta-sha256'], MaxAgeSeconds: 3600 }], null, 2) + '\n');
  return { output, totalBytes, objects: files.length, readyGames: manifest.games.filter(game => game.ready).length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argument = name => process.argv.slice(2).find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  console.log(await prepareR2({ publicUrl: argument('public-url'), prefix: argument('prefix') }));
}
