import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPreview, normalizeBasePath, PREVIEW_FILES, versionBuildSources } from '../scripts/build-preview.mjs';
import { GAMES, siteUrl } from '../public/catalog.js';

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
  assert.ok(html.includes(`src="/retro-arcade/app.js?v=${result.release}"`));
  assert.ok(html.includes(`href="/retro-arcade/arcade.css?v=${result.release}"`));
  assert.match(html, /id="arcade-menu"/);
  assert.match(html, /data-cabinet-control="start"/);
  assert.ok(result.files.includes('arcade-session.js'));
  assert.ok(result.files.includes('arcade.css'));
  const config = JSON.parse(fs.readFileSync(path.join(result.output, 'preview-build.json')));
  assert.equal(config.gamesIncluded, false); assert.equal(config.firmwareIncluded, false);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Public preview must not call the local API'); };
  try {
    const catalog = await import(pathToFileURL(path.join(result.output, 'catalog.js')));
    const library = await catalog.loadLibrary();
    assert.equal(library.preview, true); assert.equal(library.games.length, GAMES.length);
    assert.ok(library.games.every(game => !game.ready && !game.romUrl && !game.biosUrl));
    assert.equal(library.bios, false);
  } finally { globalThis.fetch = originalFetch; }
  assert.match(fs.readFileSync(path.join(root, 'public/deployment.js'), 'utf8'), /IS_PREVIEW = false/);
  assert.ok(result.files.every(file => !fs.readFileSync(path.join(result.output, file), 'utf8').includes('PRIVATE_SENTINEL')));
});

test('deployment versions refresh the first-party module graph without rewriting vendor imports', () => {
  const sources = [
    ['index.html', '<link rel="stylesheet" href="/retro-arcade/arcade.css"><script type="module" src="/retro-arcade/app.js"></script>'],
    ['app.js', "import { games } from './catalog.js'; import('./arcade-cabinet.js'); import('./arcade-session.js'); const unrelated = './catalog.js'; import('https://example.test/widget.js');"],
    ['catalog.js', "export { preview } from './deployment.js';"],
    ['deployment.js', 'export const preview = true;'],
    ['arcade-cabinet.js', "import * as THREE from './lib/three/three.module.min.js';"],
    ['arcade-session.js', "import { games } from './catalog.js';"],
    ['arcade.css', 'body { color: orange; }'],
    ['lib/three/three.module.min.js', "export * from './three.core.min.js';"],
    ['lib/three/three.core.min.js', 'export const vendor = true;'],
  ];
  const build = value => versionBuildSources(value, { basePath: '/retro-arcade/', configuration: 'preview' });
  const first = build(sources), repeated = build(sources), reversed = build([...sources].reverse());
  assert.equal(first.release, repeated.release);
  assert.equal(first.release, reversed.release);
  assert.match(first.release, /^[a-f0-9]{12}$/);
  const output = Object.fromEntries(first.sources);
  assert.ok(output['index.html'].includes(`/arcade.css?v=${first.release}`));
  assert.ok(output['index.html'].includes(`/app.js?v=${first.release}`));
  assert.ok(output['app.js'].includes(`'./catalog.js?v=${first.release}'`));
  assert.ok(output['app.js'].includes(`'./arcade-cabinet.js?v=${first.release}'`));
  assert.ok(output['app.js'].includes(`'./arcade-session.js?v=${first.release}'`));
  assert.ok(output['app.js'].includes("const unrelated = './catalog.js'"));
  assert.ok(output['app.js'].includes("import('https://example.test/widget.js')"));
  assert.ok(output['catalog.js'].includes(`'./deployment.js?v=${first.release}'`));
  assert.ok(output['arcade-session.js'].includes(`'./catalog.js?v=${first.release}'`));
  assert.equal(output['arcade-cabinet.js'], sources.find(([name]) => name === 'arcade-cabinet.js')[1]);
  assert.equal(output['lib/three/three.module.min.js'], sources.find(([name]) => name === 'lib/three/three.module.min.js')[1]);
  const changed = build(sources.map(([name, data]) => [name, name === 'arcade-session.js' ? data + '\n// changed lifecycle' : data]));
  assert.notEqual(changed.release, first.release);
  assert.ok(Object.fromEntries(changed.sources)['app.js'].includes(`?v=${changed.release}`));
  assert.notEqual(versionBuildSources(sources, { basePath: '/retro-arcade/', configuration: 'hosted' }).release, first.release);
  assert.ok(!sources.some(([, source]) => source.includes('?v=')), 'The original source is never modified.');
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
