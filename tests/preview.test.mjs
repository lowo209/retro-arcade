import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPreview, normalizeBasePath, PREVIEW_FILES } from '../scripts/build-preview.mjs';
import { siteUrl } from '../public/catalog.js';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-preview-test-'));
  fs.cpSync(new URL('../public/', import.meta.url), path.join(root, 'public'), { recursive: true });
  fs.copyFileSync(new URL('../LICENSE', import.meta.url), path.join(root, 'LICENSE'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('public build contains only interface assets and never advertises private games as playable', async t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'private/covers'), { recursive: true });
  fs.writeFileSync(path.join(root, 'private/covers/ac3.jpg'), 'PRIVATE_SENTINEL');
  fs.writeFileSync(path.join(root, 'private/secret.bin'), 'PRIVATE_SENTINEL');
  const result = buildPreview({ root, basePath: '/retro-arcade/' });
  assert.equal(result.files.length, PREVIEW_FILES.length + 3);
  assert.ok(!result.files.some(file => /private|vendor|\.bin$|\.jpg$|frame\.html/.test(file)));
  const html = fs.readFileSync(path.join(result.output, 'index.html'), 'utf8');
  assert.match(html, /src="\/retro-arcade\/app.js"/);
  assert.match(html, /href="\/retro-arcade\/#setup"/);
  const config = JSON.parse(fs.readFileSync(path.join(result.output, 'preview-build.json')));
  assert.equal(config.gamesIncluded, false); assert.equal(config.firmwareIncluded, false);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Public preview must not call the local API'); };
  try {
    const catalog = await import(pathToFileURL(path.join(result.output, 'catalog.js')));
    const library = await catalog.loadLibrary();
    assert.equal(library.preview, true); assert.equal(library.games.length, 8);
    assert.ok(library.games.every(game => !game.ready && !game.romUrl && !game.biosUrl));
    assert.equal(library.bios, false);
  } finally { globalThis.fetch = originalFetch; }
  assert.match(fs.readFileSync(path.join(root, 'public/deployment.js'), 'utf8'), /IS_PREVIEW = false/);
  assert.ok(result.files.every(file => !fs.readFileSync(path.join(result.output, file), 'utf8').includes('PRIVATE_SENTINEL')));
});

test('Pages navigation resolves under project paths as well as the local root', () => {
  for (const base of ['https://example.github.io/retro-arcade/catalog.js', 'http://127.0.0.1:3000/catalog.js']) {
    const prefix = new URL('.', base).pathname;
    assert.equal(siteUrl('game.html?id=ac3', base), `${prefix}game.html?id=ac3`);
    assert.equal(siteUrl('/assets/ac3.svg', base), `${prefix}assets/ac3.svg`);
    assert.equal(siteUrl('#library', base), `${prefix}#library`);
  }
  assert.equal(normalizeBasePath('retro-arcade'), '/retro-arcade/');
  for (const value of ['../private', 'https://example.com/', '/x/../../', '/x\\private', 'x?bad']) assert.throws(() => normalizeBasePath(value));
});

test('public build refuses unexpected files in its output instead of uploading or deleting them', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(path.join(root, 'dist', 'accidental.iso'), 'KEEP_THIS');
  assert.throws(() => buildPreview({ root }), /Unexpected file in dist/);
  assert.equal(fs.readFileSync(path.join(root, 'dist', 'accidental.iso'), 'utf8'), 'KEEP_THIS');
});
