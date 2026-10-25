import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { buildHosted, validateManifest, publicManifest } from '../scripts/build-hosted.mjs';
import { GAMES } from '../public/catalog.js';
import { hashUploadFile, multipartETag } from '../scripts/r2-integrity.mjs';

const assetBase = 'https://pub-example.r2.dev/releases/tester-v1/';
const manifest = () => ({ schema: 1, hosted: true, runtime: true, bios: true, biosName: 'scph1001.bin', assetBase,
  verifiedAt: '2026-10-24T12:00:00Z', games: GAMES.map(game => game.experimental
    ? { id: game.id, ready: false, experimental: true, reason: 'Coming later.' }
    : { id: game.id, ready: true, core: game.id === 'umk3' ? 'mame2003_plus' : 'pcsx_rearmed', reason: '',
      downloadBytes: 123456, romUrl: assetBase + `media/${game.id}/game.zip`,
      ...(game.id !== 'umk3' ? { biosUrl: assetBase + 'firmware/scph1001.bin' } : {}) }) });

test('hosted build loads a static catalogue and external runtime beneath a Pages project path', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-hosted-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(new URL('../public/', import.meta.url), path.join(root, 'public'), { recursive: true });
  fs.copyFileSync(new URL('../LICENSE', import.meta.url), path.join(root, 'LICENSE'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  const result = buildHosted({ root, basePath: '/retro-arcade/', manifest: manifest() });
  assert.ok(result.files.includes('frame.html'));
  assert.ok(result.files.every(file => !/\.(bin|zip|data|wasm|jpe?g|png)$/.test(file)));
  assert.ok(fs.readFileSync(path.join(result.output, 'frame.html'), 'utf8').includes(`src="/retro-arcade/frame.js?v=${result.release}"`));
  assert.ok(result.files.includes('arcade-session.js'));
  assert.ok(result.files.includes('arcade.css'));
  assert.ok(fs.readFileSync(path.join(result.output, 'frame.js'), 'utf8').includes(`'./startup-diagnostics.js?v=${result.release}'`));
  assert.ok(fs.readFileSync(path.join(result.output, 'arcade-session.js'), 'utf8').includes(`'./catalog.js?v=${result.release}'`));
  assert.match(fs.readFileSync(path.join(result.output, 'frame.html'), 'utf8'), /connect-src 'self' https:\/\/pub-example.r2.dev/);
  const catalog = await import(pathToFileURL(path.join(result.output, 'catalog.js')));
  assert.equal(catalog.IS_HOSTED, true); assert.equal(catalog.IS_PREVIEW, false);
  assert.equal(catalog.runtimeUrl('loader.js'), assetBase + 'vendor/emulatorjs/data/loader.js');
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/library.json')); assert.ok(!url.includes('/api/'));
    assert.equal(options.cache, 'no-store'); return { ok: true, json: async () => manifest() };
  };
  try { assert.equal((await catalog.loadLibrary()).games.filter(game => game.ready).length, 7); }
  finally { globalThis.fetch = original; }
  fs.writeFileSync(path.join(result.output, 'accidental.zip'), 'KEEP_THIS');
  assert.throws(() => buildHosted({ root, manifest: manifest() }), /Unexpected file/);
  assert.equal(fs.readFileSync(path.join(result.output, 'accidental.zip'), 'utf8'), 'KEEP_THIS');
});

test('public activation rejects unverified, incomplete and unrelated game downloads', () => {
  let value = manifest(); value.verifiedAt = null;
  assert.throws(() => validateManifest(value), /verified/);
  value = manifest(); value.games[0].romUrl = 'https://another.example/game.zip';
  assert.throws(() => validateManifest(value), /outside/);
  value = manifest(); value.games.find(game => game.id === 'gt4').ready = true;
  assert.throws(() => validateManifest(value), /GT4/);
  value = manifest(); delete value.games[1].biosUrl;
  assert.throws(() => validateManifest(value), /firmware/);
});

test('public manifest drops credentials, local source paths and operator-only fields', () => {
  const value = manifest(); value.accessKey = 'PRIVATE_SENTINEL'; value.verification = { file: 'PRIVATE_SENTINEL' };
  value.games[0].source = 'PRIVATE_SENTINEL'; value.games[0].requirements = ['PRIVATE_SENTINEL'];
  assert.ok(!JSON.stringify(publicManifest(value)).includes('PRIVATE_SENTINEL'));
});

test('R2 checksums cover single PUTs, exact-size parts and the documented multipart ETag example', async t => {
  assert.equal(multipartETag(['bce6bf66aeb76c7040fdd5f4eccb78e6', '8165449fc15bbf43d3b674595cbcc406'].map(hex => Buffer.from(hex, 'hex'))), 'f77dc0eecdebcd774a2a22cb393ad2ff-2');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-hash-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'fixture.txt'); fs.writeFileSync(file, 'hello');
  assert.equal((await hashUploadFile(file)).etag, '5d41402abc4b2a76b9719d911017c592');
  const hash = await hashUploadFile(file, 5);
  assert.equal(hash.bytes, 5); assert.match(hash.etag, /^[a-f0-9]{32}-1$/);
  assert.equal(hash.sha256, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
});
