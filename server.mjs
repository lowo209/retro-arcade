import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };
const SECURITY = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob: data:; worker-src 'self' blob:; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
};

function exists(file) { try { return fs.statSync(file).isFile(); } catch { return false; } }
function config(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'private', 'local.json'), 'utf8')); }
  catch { return {}; }
}
function first(root, names) { return names.map(n => path.join(root, n)).find(exists); }
const BIOS_CHECKSUMS = {
  'scph5501.bin': '490f666e1afb15b7362b406ed1cea246',
  'scph1001.bin': '924e392ed05558ffdb115408c263dccf',
  'scph5502.bin': '32736f17079d0b2b7024407c39bd3050',
};
function firmware(root) {
  let found = false;
  for (const [name, checksum] of Object.entries(BIOS_CHECKSUMS)) {
    const file = path.join(root, 'private/bios', name);
    if (!exists(file)) continue;
    found = true;
    if (fs.statSync(file).size === 524288 && createHash('md5').update(fs.readFileSync(file)).digest('hex') === checksum) return { valid: true, name, reason: '' };
  }
  return { valid: false, reason: found ? 'The PS1 BIOS does not match a supported retail BIOS checksum.' : 'A verified retail PS1 BIOS (scph1001.bin, scph5501.bin or scph5502.bin) is needed.' };
}
export function inspectLibrary(root = ROOT) {
  const local = config(root);
  const bios = firmware(root);
  const runtimeFiles = ['loader.js', 'emulator.min.js', 'emulator.min.css', 'compression/extractzip.js'];
  const runtime = runtimeFiles.every(f => exists(path.join(root, 'vendor/emulatorjs/data', f)));
  const core = name => ['-wasm.data', '-legacy-wasm.data'].every(suffix => exists(path.join(root, 'vendor/emulatorjs/data/cores', name + suffix))) && exists(path.join(root, 'vendor/emulatorjs/data/cores/reports', name + '.json'));
  const umk = path.join(root, 'private/roms/umk3/umk3.zip');
  // This pinned core advertises CUE/BIN and PBP, but does not advertise CHD.
  const nfs = first(root, ['private/roms/nfs/high-stakes.pbp', 'private/roms/nfs/high-stakes.zip']);
  const gt2 = first(root, ['private/roms/gt2/gt2-arcade.pbp', 'private/roms/gt2/gt2-arcade.zip']);
  const sim = first(root, ['private/roms/gt2/gt2-simulation.zip']);
  const re3 = first(root, ['private/roms/re3/re3-nemesis.pbp', 'private/roms/re3/re3-nemesis.zip']);
  const ac3 = first(root, ['private/roms/ac3/electrosphere.pbp', 'private/roms/ac3/electrosphere.zip']);
  const gits = first(root, ['private/roms/gits/ghost-in-the-shell.pbp', 'private/roms/gits/ghost-in-the-shell.zip']);
  const gpolice2 = first(root, ['private/roms/gpolice2/weapons-of-justice.pbp', 'private/roms/gpolice2/weapons-of-justice.zip']);
  const gt4dir = path.resolve(root, local.gt4?.buildDirectory || 'private/gt4/web');
  const gt4disc = path.resolve(root, local.gt4?.disc || 'private/gt4/disc.iso');
  const gt4ready = ['ps2web.html', 'ps2web.js', 'ps2web.wasm', 'ps2web.data'].every(f => exists(path.join(gt4dir, f))) && exists(gt4disc);
  const missingRuntime = !runtime ? 'Install the local EmulatorJS runtime with npm run setup.' : '';
  const psxReason = file => !file ? 'Add the correct PS1 disc as a CUE + BIN ZIP or PBP. See the setup guide below.' : !bios.valid ? bios.reason : missingRuntime || (!core('pcsx_rearmed') ? 'The local PlayStation core is missing. Run setup again.' : '');
  const makePSX = (id, file, discLabel, region = 'US') => ({ id, region, ready: !!file && bios.valid && runtime && core('pcsx_rearmed'), core: 'pcsx_rearmed', reason: psxReason(file), romUrl: file ? `/media/${id}/${path.basename(file)}` : null, biosUrl: bios.valid ? `/firmware/${bios.name}` : null, requirements: [
    { label: discLabel, present: !!file },
    { label: bios.valid ? `Verified PS1 BIOS · ${bios.name}` : 'Verified retail PS1 BIOS', present: bios.valid },
    { label: 'Local PlayStation emulator', present: runtime && core('pcsx_rearmed') },
  ] });
  const games = [
    { id: 'umk3', ready: exists(umk) && runtime && core('mame2003_plus'), core: 'mame2003_plus', reason: !exists(umk) ? 'Add a compatible UMK3 rev 1.2 arcade ROM set.' : missingRuntime || (!core('mame2003_plus') ? 'The local arcade core is missing. Run setup again.' : ''), romUrl: exists(umk) ? '/media/umk3/umk3.zip' : null },
    makePSX('nfs', nfs, 'US PS1 High Stakes disc'), makePSX('gt2', gt2, 'European PAL Arcade Mode disc', 'Europe'),
    { id: 'gt4', ready: gt4ready, discPresent: exists(gt4disc), experimental: true, reason: gt4ready ? 'Experimental browser build found. Gameplay has not been verified on this machine.' : 'A local PS2 Web Recomp build is needed. The ISO alone cannot run in a browser.', playerUrl: gt4ready ? '/experimental/gt4/ps2web.html' : null },
    makePSX('re3', re3, 'US Resident Evil 3: Nemesis disc'),
    makePSX('ac3', ac3, 'European PAL Ace Combat 3 disc', 'Europe'),
    makePSX('gits', gits, 'European PAL Ghost in the Shell disc', 'Europe'),
    makePSX('gpolice2', gpolice2, 'European PAL G-Police: Weapons of Justice disc', 'Europe'),
  ];
  if (sim) games[2].alternate = { ...makePSX('gt2', sim, 'US Simulation Mode disc'), label: 'Simulation Mode', warning: 'This separate US Simulation disc has its own saves. The main launch uses the European Arcade disc.' };
  for (const game of games) {
    const cover = first(root, ['png', 'jpg', 'jpeg'].map(extension => `private/covers/${game.id}.${extension}`));
    if (cover) game.coverUrl = `/covers/${path.basename(cover)}`;
  }
  return { runtime, bios: bios.valid, biosName: bios.name || null, games };
}

// Resolve only inside an explicit public mount, including after following symlinks.
export function containedFile(base, relative) {
  try {
    if (relative.includes('\\') || relative.includes('\0')) return null;
    const realBase = fs.realpathSync(base);
    const target = fs.realpathSync(path.resolve(realBase, relative));
    const rel = path.relative(realBase, target);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !exists(target)) return null;
    return target;
  } catch { return null; }
}

export function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || !size) return false;
  let start, end;
  if (!match[1]) { const suffix = Number(match[2]); if (!suffix) return false; start = Math.max(0, size - suffix); end = size - 1; }
  else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) return false;
  return { start, end };
}

export function createArcadeServer(root = ROOT) {
  return http.createServer(async (req, res) => {
    const send = (status, message) => { res.writeHead(status, { ...SECURITY, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : message); };
    try {
      // Keep the game library on this computer. Reject foreign origins/Host headers.
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return send(403, 'This arcade is local to this computer.');
      if (!['GET', 'HEAD'].includes(req.method)) return send(405, 'Only GET and HEAD are supported.');
      const rawPath = (req.url || '/').split('?')[0];
      const pathname = decodeURIComponent(rawPath);
      if (pathname.includes('..') || pathname.includes('\\') || pathname.includes('\0')) return send(403, 'Path not allowed.');
      if (pathname === '/api/library') {
        const body = JSON.stringify(inspectLibrary(root));
        res.writeHead(200, { ...SECURITY, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
        return res.end(req.method === 'HEAD' ? undefined : body);
      }
      let file;
      if (pathname.startsWith('/vendor/emulatorjs/')) file = containedFile(path.join(root, 'vendor/emulatorjs'), pathname.slice('/vendor/emulatorjs/'.length));
      else if (pathname.startsWith('/media/')) {
        const match = /^\/media\/(umk3|nfs|gt2|re3|ac3|gits|gpolice2)\/([^/]+)$/.exec(pathname);
        const allowed = { umk3: ['umk3.zip'], nfs: ['high-stakes.pbp', 'high-stakes.zip'], gt2: ['gt2-arcade.pbp', 'gt2-arcade.zip', 'gt2-simulation.zip'], re3: ['re3-nemesis.pbp', 're3-nemesis.zip'], ac3: ['electrosphere.zip', 'electrosphere.pbp'], gits: ['ghost-in-the-shell.zip', 'ghost-in-the-shell.pbp'], gpolice2: ['weapons-of-justice.zip', 'weapons-of-justice.pbp'] };
        if (match && allowed[match[1]].includes(match[2])) file = containedFile(path.join(root, 'private/roms', match[1]), match[2]);
      } else if (/^\/firmware\/(scph5501|scph1001|scph5502)\.bin$/.test(pathname)) file = containedFile(path.join(root, 'private/bios'), path.basename(pathname));
      else if (/^\/covers\/(umk3|nfs|gt2|gt4|re3|ac3|gits|gpolice2)\.(png|jpe?g)$/.test(pathname)) file = containedFile(path.join(root, 'private/covers'), path.basename(pathname));
      else if (pathname.startsWith('/experimental/gt4/')) {
        const local = config(root);
        const relative = pathname.slice('/experimental/gt4/'.length);
        if (relative === 'disc.iso') { const disc = path.resolve(root, local.gt4?.disc || 'private/gt4/disc.iso'); if (exists(disc)) file = disc; }
        else if (/^[\w./-]+$/.test(relative) && !relative.split('/').some(p => p.startsWith('.'))) file = containedFile(path.resolve(root, local.gt4?.buildDirectory || 'private/gt4/web'), relative);
      } else file = containedFile(path.join(root, 'public'), pathname === '/' ? 'index.html' : pathname.slice(1));
      if (!file) return send(404, 'File not found. Check the local setup in README.md.');
      const stat = fs.statSync(file);
      const range = parseRange(req.headers.range, stat.size);
      if (range === false) { res.setHeader('Content-Range', `bytes */${stat.size}`); return send(416, 'Requested byte range is not available.'); }
      const headers = { ...SECURITY, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'Last-Modified': stat.mtime.toUTCString(), 'Content-Length': range ? range.end - range.start + 1 : stat.size };
      if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${stat.size}`;
      res.writeHead(range ? 206 : 200, headers);
      if (req.method === 'HEAD') return res.end();
      await pipeline(fs.createReadStream(file, range || {}), res);
    } catch (error) {
      if (error instanceof URIError) return send(400, 'Invalid URL.');
      if (!res.headersSent) send(500, 'The local server could not read this file. Check the terminal.');
      if (!['ERR_STREAM_PREMATURE_CLOSE', 'ECONNRESET'].includes(error.code)) console.error(error.message);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  const server = createArcadeServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Close the other arcade server or set PORT.` : error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Retro Arcade: http://127.0.0.1:${port}\nLocal files only. Press Ctrl+C to stop.`));
}
