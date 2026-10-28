import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { deflateRawSync } from 'node:zlib';
import { createArcadeServer, parseRange, containedFile, inspectLibrary, hasMatchingSbi } from '../server.mjs';

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
  for (const [id,file] of [['ac3','electrosphere'],['gits','ghost-in-the-shell'],['gpolice2','weapons-of-justice'],['mk4','mortal-kombat-4'],['sh','silent-hill'],['tekken3','tekken-3'],['ctr','crash-team-racing']]) put(`private/roms/${id}/${file}.zip`, '0123456789');
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
  for (const [id,file] of [['ac3','electrosphere'],['gits','ghost-in-the-shell'],['gpolice2','weapons-of-justice'],['mk4','mortal-kombat-4'],['sh','silent-hill'],['tekken3','tekken-3'],['ctr','crash-team-racing']]) {
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
  const api = await request('/api/library'); assert.equal(api.status, 200); assert.equal(JSON.parse(api.body).games.length, 12); assert.ok(!api.body.includes(root)); assert.ok(!api.body.includes('secret'));
  const library = JSON.parse(api.body); assert.equal(library.games[1].coverUrl, '/covers/nfs.png'); assert.equal(library.bios, false); assert.equal(library.games[1].biosUrl, null);
  for (const id of ['ac3','gits','gpolice2','mk4','sh']) { const game = library.games.find(g => g.id === id); assert.equal(game.ready,false); assert.equal(game.region,'Europe'); assert.match(game.reason,/BIOS/); }
  assert.match(library.games.find(game => game.id === 'ctr').reason, /SBI/);
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

test('protected CTR stays unavailable until its ZIP contains matching valid SBI records', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-ctr-sbi-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'private/roms/ctr/crash-team-racing.zip');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const crc32 = data => {
    let crc = -1;
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320); }
    return (~crc) >>> 0;
  };
  function zip(entries, method = 0) {
    const bodies = [], directory = []; let offset = 0;
    for (const [name, data] of entries) {
      const filename = Buffer.from(name), packed = method ? deflateRawSync(data) : data, crc = crc32(data);
      const local = Buffer.alloc(30), central = Buffer.alloc(46);
      local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8); local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
      central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(method, 10); central.writeUInt32LE(crc, 16);
      central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
      bodies.push(local, filename, packed); directory.push(central, filename); offset += local.length + filename.length + packed.length;
    }
    const records = Buffer.concat(directory), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(records.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...bodies, records, end]);
  }
  const cue = ['CTR (Europe).cue', Buffer.from('FILE "CTR (Europe).bin" BINARY\n  TRACK 01 MODE2/2352\n')];
  const sbi = Buffer.from([83, 66, 73, 0, 0x03, 0x08, 0x05, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  fs.writeFileSync(file, zip([cue]));
  assert.equal(hasMatchingSbi(file), false);
  const blocked = inspectLibrary(root).games.find(game => game.id === 'ctr');
  assert.equal(blocked.ready, false); assert.match(blocked.reason, /matching SBI/);
  fs.writeFileSync(file, zip([cue, ['Unrelated.sbi', sbi]]));
  assert.equal(hasMatchingSbi(file), false);
  fs.writeFileSync(file, zip([cue, ['CTR (Europe).sbi', Buffer.from('not actual subchannel data')]]));
  assert.equal(hasMatchingSbi(file), false);
  for (const method of [0, 8]) {
    fs.writeFileSync(file, zip([cue, ['CTR (Europe).sbi', sbi]], method));
    assert.equal(hasMatchingSbi(file), true, `ZIP compression method ${method}`);
    assert.equal(inspectLibrary(root).games.find(game => game.id === 'ctr').requirements.at(-1).present, true);
  }
  const truncated = zip([cue, ['CTR (Europe).sbi', sbi]]).subarray(0, -1);
  fs.writeFileSync(file, truncated); assert.equal(hasMatchingSbi(file), false);
});
