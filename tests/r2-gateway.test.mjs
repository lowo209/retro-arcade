import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGateway } from '../scripts/r2-gateway.mjs';
import { buildR2Gateway } from '../scripts/build-r2-gateway.mjs';

const prefix = 'releases/tester-v1';
const key = prefix + '/media/ctr/game.zip';
const etag = '0123456789abcdef0123456789abcdef-23';
const origin = 'https://lowo209.github.io';
const data = new TextEncoder().encode('0123456789');
const file = { key, bytes: data.length, contentType: 'application/zip', etag };
const request = (method = 'GET', headers = {}, target = key) => new Request('https://assets.example/' + target, { method, headers: { Origin: origin, ...headers } });
function fixture(overrides = {}) {
  const calls = [];
  const object = (range, body = true) => ({ size: data.length, etag, storageClass: 'Standard', uploaded: new Date('2026-10-28T12:00:00Z'),
    ...(body ? { body: new ReadableStream({ start(controller) { controller.enqueue(range ? data.slice(range.offset, range.offset + range.length) : data); controller.close(); } }) } : {}),
    arrayBuffer() { throw new Error('Do not buffer R2 objects.'); }, text() { throw new Error('Do not decode R2 objects.'); } });
  const bucket = {
    async get(value, options) { calls.push({ method: 'get', key: value, options }); return object(options?.range); },
    async head(value) { calls.push({ method: 'head', key: value }); return object(null, false); },
    ...overrides,
  };
  const gateway = createGateway({ prefix, objects: [file] });
  return { gateway, calls, bucket, run: value => gateway.fetch(value, { ASSETS: bucket }) };
}

test('gateway streams a complete object with one R2 read and verified public headers', async () => {
  const setup = fixture();
  const response = await setup.run(request());
  assert.equal(response.status, 200); assert.equal(setup.calls.length, 1); assert.equal(setup.calls[0].method, 'get');
  assert.equal(response.headers.get('content-type'), 'application/zip');
  assert.equal(response.headers.get('content-length'), '10'); assert.equal(response.headers.get('etag'), '"' + etag + '"');
  assert.match(response.headers.get('cache-control'), /(?:^|,\s*)no-transform(?:,|$)/);
  assert.equal(response.headers.get('accept-ranges'), 'bytes');
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('x-arcade-gateway'), 'r2-free-v1');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), data);
});

test('single closed, open and suffix ranges make one ranged read with exact 206 lengths', async () => {
  for (const [header, offset, length, expected] of [['bytes=2-5', 2, 4, '2345'], ['bytes=7-', 7, 3, '789'], ['bytes=-3', 7, 3, '789'], ['bytes=-99', 0, 10, '0123456789'], ['bytes=8-99', 8, 2, '89']]) {
    const setup = fixture(), response = await setup.run(request('GET', { Range: header }));
    assert.equal(response.status, 206); assert.equal(setup.calls.length, 1);
    assert.deepEqual(setup.calls[0].options, { range: { offset, length } });
    assert.equal(response.headers.get('content-length'), String(length));
    assert.equal(response.headers.get('content-range'), `bytes ${offset}-${offset + length - 1}/10`);
    assert.equal(await response.text(), expected);
  }
});

test('invalid ranges are rejected before touching R2', async () => {
  for (const range of ['', 'bytes=10-', 'bytes=-0', 'bytes=8-2', 'bytes=0-1,3-4', 'items=0-1', 'bytes=-', 'bytes=9007199254740992-', 'bytes=0-9007199254740992']) {
    const setup = fixture(), response = await setup.run(request('GET', { Range: range }));
    assert.equal(response.status, 416, range); assert.equal(response.headers.get('content-range'), 'bytes */10');
    assert.equal(setup.calls.length, 0, range);
  }
});

test('HEAD uses one metadata read, ignores Range and returns no game body', async () => {
  const setup = fixture(), response = await setup.run(request('HEAD', { Range: 'bytes=2-5' }));
  assert.equal(response.status, 200); assert.equal(response.body, null); assert.equal(response.headers.get('content-length'), '10');
  assert.match(response.headers.get('cache-control'), /(?:^|,\s*)no-transform(?:,|$)/);
  assert.deepEqual(setup.calls, [{ method: 'head', key }]);
});

test('immutable release validators avoid reads and If-Range controls partial responses', async () => {
  for (const value of ['"' + etag + '"', 'W/"' + etag + '"', '"other", "' + etag + '"', '*']) {
    const setup = fixture(), response = await setup.run(request('GET', { 'If-None-Match': value }));
    assert.equal(response.status, 304); assert.equal(response.body, null); assert.equal(setup.calls.length, 0);
  }
  let setup = fixture(), response = await setup.run(request('GET', { 'If-Match': '"different"' }));
  assert.equal(response.status, 412); assert.equal(setup.calls.length, 0);
  setup = fixture(); response = await setup.run(request('GET', { 'If-Match': 'W/"' + etag + '"' }));
  assert.equal(response.status, 412); assert.equal(setup.calls.length, 0);
  setup = fixture(); response = await setup.run(request('GET', { Range: 'bytes=2-3', 'If-Range': '"' + etag + '"' }));
  assert.equal(response.status, 206); assert.equal(setup.calls.length, 1); await response.body.cancel();
  setup = fixture(); response = await setup.run(request('GET', { Range: 'bytes=2-3', 'If-Range': '"old"' }));
  assert.equal(response.status, 200); assert.equal(setup.calls.length, 1); assert.equal(setup.calls[0].options, undefined); await response.body.cancel();
});

test('only allowlisted objects, safe methods and explicit origins can reach the bucket', async () => {
  const cases = [request('POST'), request('GET', {}, prefix + '/private.json'), request('GET', {}, key.replace('/media/', '/media%2f')),
    request('GET', {}, prefix + '//media/ctr/game.zip'), request('GET', { Origin: 'https://unrelated.example' }), request('GET', {}, prefix + '/media/ctr/%67ame.zip')];
  for (const value of cases) {
    const setup = fixture(), response = await setup.run(value);
    assert.ok([403, 404, 405].includes(response.status)); assert.equal(setup.calls.length, 0);
  }
  const setup = fixture(), response = await setup.run(new Request('https://assets.example/' + key));
  assert.equal(response.status, 200); assert.equal(setup.calls.length, 1); assert.equal(response.headers.get('access-control-allow-origin'), null);
  await response.body.cancel();
});

test('CORS preflight permits download headers and makes no R2 operation', async () => {
  const setup = fixture(), response = await setup.run(request('OPTIONS', { 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'range, if-none-match' }));
  assert.equal(response.status, 204); assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.match(response.headers.get('access-control-allow-headers'), /Range/); assert.equal(setup.calls.length, 0);
  assert.equal((await setup.run(request('OPTIONS', { 'Access-Control-Request-Method': 'PUT' }))).status, 403);
  assert.equal((await setup.run(request('OPTIONS', { 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' }))).status, 403);
  assert.equal(setup.calls.length, 0);
});

test('missing files, mismatched objects and R2 errors fail closed without fallback or retry', async () => {
  for (const mode of ['missing', 'throw', 'changed', 'infrequent', 'no-body']) {
    let calls = 0, cancelled = false;
    const gateway = createGateway({ prefix, objects: [file] });
    const bucket = { async get() {
      calls++;
      if (mode === 'missing') return null;
      if (mode === 'throw') throw new Error('Private storage detail must not leak.');
      return { size: file.bytes, etag: mode === 'changed' ? 'changed' : etag, storageClass: mode === 'infrequent' ? 'InfrequentAccess' : 'Standard',
        ...(mode === 'no-body' ? {} : { body: new ReadableStream({ cancel() { cancelled = true; } }) }) };
    }, head() { throw new Error('No fallback HEAD is allowed.'); } };
    const response = await gateway.fetch(request(), { ASSETS: bucket });
    assert.equal(response.status, mode === 'missing' ? 404 : 503); assert.equal(calls, 1);
    assert.doesNotMatch(await response.text(), /Private storage detail/);
    if (['changed', 'infrequent'].includes(mode)) assert.equal(cancelled, true);
  }
  const setup = fixture();
  assert.equal((await setup.gateway.fetch(request(), {})).status, 503); assert.equal(setup.calls.length, 0);
});

test('large games are returned as streams without buffering or a second request', async () => {
  const large = { ...file, bytes: 740180302 };
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); } });
  let calls = 0;
  const gateway = createGateway({ prefix, objects: [large] });
  const response = await gateway.fetch(request(), { ASSETS: { async get() { calls++; return { size: large.bytes, etag, body,
    arrayBuffer() { throw new Error('Full-game buffering is forbidden.'); } }; } } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-length'), String(large.bytes));
  assert.equal(response.body, body); assert.equal(calls, 1);
  const reader = response.body.getReader(); assert.deepEqual((await reader.read()).value, new Uint8Array([1, 2, 3])); await reader.cancel();
});

test('generator emits a small self-contained worker containing only public object metadata', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-gateway-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.local/r2-release'), { recursive: true }); fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(new URL('../scripts/r2-gateway.mjs', import.meta.url), path.join(root, 'scripts/r2-gateway.mjs'));
  const planFile = path.join(root, '.local/r2-release/upload-plan.json');
  const plan = { schema: 1, prefix, totalBytes: file.bytes, publicBase: 'https://old-direct.example/', files: [{ ...file, file: 'private/secret-location.zip', sha256: 'operator-only-hash', credential: 'operator-only-credential' }] };
  fs.writeFileSync(planFile, JSON.stringify(plan));
  const result = buildR2Gateway({ root });
  assert.equal(result.objects, 1); assert.equal(result.totalBytes, 10); assert.ok(result.bytes < 65536);
  const source = fs.readFileSync(result.output, 'utf8');
  assert.doesNotMatch(source, /private\/secret|operator-only|old-direct|^import /m);
  const worker = await import(pathToFileURL(result.output));
  assert.equal((await worker.default.fetch(request('OPTIONS'), {})).status, 204);
  plan.totalBytes = 9_000_000_001; fs.writeFileSync(planFile, JSON.stringify(plan));
  assert.throws(() => buildR2Gateway({ root }), /storage budget|incomplete/);
  assert.throws(() => buildR2Gateway({ root, releaseDirectory: '../elsewhere' }), /local release/);
});

test('configuration rejects duplicate or unsafe release keys and response headers', () => {
  for (const objects of [[file, file], [{ ...file, key: prefix + '/../private' }], [{ ...file, contentType: 'text/plain\r\nInjected: yes' }], [{ ...file, bytes: -1 }], [{ ...file, etag: 'unverified' }]]) {
    assert.throws(() => createGateway({ prefix, objects }), /Invalid gateway/);
  }
});
