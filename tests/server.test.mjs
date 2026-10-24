import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { createArcadeServer, parseRange, containedFile, inspectLibrary } from '../server.mjs';

test('ranges include open ends, suffixes and rejection of invalid ranges', () => {
  assert.equal(parseRange(undefined, 10), null);
  assert.deepEqual(parseRange('bytes=2-5', 10), { start: 2, end: 5 });
  assert.deepEqual(parseRange('bytes=8-', 10), { start: 8, end: 9 });
  assert.deepEqual(parseRange('bytes=-3', 10), { start: 7, end: 9 });
  assert.deepEqual(parseRange('bytes=0-100', 10), { start: 0, end: 9 });
  for (const header of ['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,4-6', 'nonsense']) assert.equal(parseRange(header, 10), false);
});

test('local server streams discs and blocks source/config paths and foreign hosts', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-arcade-test-'));
  const put = (name, data) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
  put('public/index.html', '<h1>Arcade</h1>'); put('private/local.json', '{"secret":"local"}'); put('private/roms/umk3/umk3.zip', '0123456789');
  put('private/roms/re3/re3-nemesis.zip', 'resident-evil-test');
  for (const [id,file] of [['ac3','electrosphere'],['gits','ghost-in-the-shell'],['gpolice2','weapons-of-justice']]) put(`private/roms/${id}/${file}.zip`, '0123456789');
  put('private/covers/ac3.jpg', 'jpeg-cover');
  put('private/covers/nfs.png', 'test-cover'); put('private/covers/secret.txt', 'never-serve');
  put('private/bios/scph1001.bin', 'invalid-firmware-fixture');
  const server = createArcadeServer(root); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
  const port = server.address().port;
  const request = (url, options = {}) => new Promise((resolve, reject) => { const req = http.request({ host: '127.0.0.1', port, path: url, ...options }, res => { let body = ''; res.on('data', data => body += data); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body })); }); req.on('error', reject); req.end(); });
  const home = await request('/'); assert.equal(home.status, 200); assert.match(home.body, /Arcade/); assert.equal(home.headers['cross-origin-embedder-policy'], 'require-corp');
  const range = await request('/media/umk3/umk3.zip', { headers: { Range: 'bytes=2-5' } }); assert.equal(range.status, 206); assert.equal(range.body, '2345'); assert.equal(range.headers['content-range'], 'bytes 2-5/10');
  const head = await request('/media/umk3/umk3.zip', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(head.body, ''); assert.equal(head.headers['content-length'], '10');
  const badRange = await request('/media/umk3/umk3.zip', { headers: { Range: 'bytes=99-' } }); assert.equal(badRange.status, 416); assert.equal(badRange.headers['content-range'], 'bytes */10');
  const cover = await request('/covers/nfs.png'); assert.equal(cover.status, 200); assert.equal(cover.body, 'test-cover'); assert.equal(cover.headers['content-type'], 'image/png');
  const jpeg = await request('/covers/ac3.jpg'); assert.equal(jpeg.status, 200); assert.equal(jpeg.headers['content-type'], 'image/jpeg');
  for (const [id,file] of [['ac3','electrosphere'],['gits','ghost-in-the-shell'],['gpolice2','weapons-of-justice']]) {
    const disc = await request(`/media/${id}/${file}.zip`, { headers: { Range: 'bytes=2-5' } });
    assert.equal(disc.status, 206); assert.equal(disc.body, '2345');
    assert.equal((await request(`/media/${id}/arbitrary.zip`)).status, 404);
  }
  assert.equal((await request('/covers/arbitrary.jpg')).status, 404);
  assert.equal((await request('/covers/secret.txt')).status, 404);
  assert.equal((await request('/private/covers/nfs.png')).status, 404);
  assert.equal((await request('/firmware/scph1001.bin', { method: 'HEAD' })).status, 200);
  assert.equal((await request('/firmware/other.bin')).status, 404);
  assert.equal((await request('/media/re3/re3-nemesis.zip', { method: 'HEAD' })).headers['content-length'], '18');
  assert.equal((await request('/media/re3/arbitrary.zip')).status, 404);
  for (const url of ['/private/local.json', '/.git/config', '/server.mjs', '/media/umk3/local.json']) assert.equal((await request(url)).status, 404);
  for (const url of ['/../private/local.json', '/%2e%2e/private/local.json', '/%5c..%5cprivate/local.json']) assert.equal((await request(url)).status, 403);
  assert.equal((await request('/%ZZ')).status, 400);
  assert.equal((await request('/', { headers: { Host: 'attacker.example' } })).status, 403);
  assert.equal((await request('/', { method: 'POST' })).status, 405);
  const api = await request('/api/library'); assert.equal(api.status, 200); assert.equal(JSON.parse(api.body).games.length, 8); assert.ok(!api.body.includes(root)); assert.ok(!api.body.includes('secret'));
  const library = JSON.parse(api.body); assert.equal(library.games[1].coverUrl, '/covers/nfs.png'); assert.equal(library.bios, false); assert.equal(library.games[1].biosUrl, null);
  for (const id of ['ac3','gits','gpolice2']) { const game = library.games.find(g => g.id === id); assert.equal(game.ready,false); assert.equal(game.region,'Europe'); assert.match(game.reason,/BIOS/); }
  const re3 = library.games.find(g => g.id === 're3'); assert.equal(re3.ready, false); assert.equal(re3.romUrl, '/media/re3/re3-nemesis.zip'); assert.match(re3.reason, /BIOS/);
  assert.equal(containedFile(path.join(root, 'public'), '../private/local.json'), null);
});

test('readiness never advertises a game without its required runtime, core and firmware', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-ready-test-'));
  try {
    fs.mkdirSync(path.join(root, 'private/roms/gt2'), { recursive: true }); fs.writeFileSync(path.join(root, 'private/roms/gt2/gt2-simulation.zip'), 'test');
    // The supplied PCSX core does not advertise CHD: don't offer a false launch.
    fs.mkdirSync(path.join(root, 'private/roms/nfs'), { recursive: true }); fs.writeFileSync(path.join(root, 'private/roms/nfs/high-stakes.chd'), 'test');
    let library = inspectLibrary(root); assert.ok(library.games.every(g => !g.ready)); assert.equal(library.games[1].romUrl, null); assert.equal(library.games[2].romUrl, null); assert.equal(library.games[2].alternate.ready, false);
    fs.mkdirSync(path.join(root, 'private/bios')); fs.writeFileSync(path.join(root, 'private/bios/scph5501.bin'), Buffer.alloc(524288));
    library = inspectLibrary(root); assert.equal(library.bios, false); assert.match(library.games[2].alternate.reason, /checksum/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
