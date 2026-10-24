import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { probeGraphics, watchStartup } from '../public/startup-diagnostics.js';

test('graphics preflight accepts WebGL2, falls back to WebGL1 and releases its test context', () => {
  for (const version of [1, 2]) {
    const calls = []; let released = 0;
    const result = probeGraphics({ createElement: () => ({ getContext: name => {
      calls.push(name);
      return name === `webgl${version === 2 ? '2' : ''}` ? { getExtension: () => ({ loseContext: () => released++ }) } : null;
    } }) });
    assert.deepEqual(result, { available: true, version });
    assert.deepEqual(calls, version === 2 ? ['webgl2'] : ['webgl2', 'webgl']);
    assert.equal(released, 1);
  }
});

test('graphics preflight rejects unavailable, lost and blocked contexts', () => {
  for (const getContext of [() => null, () => { throw new Error('Blocked'); }, () => ({ isContextLost: () => true })]) {
    assert.deepEqual(probeGraphics({ createElement: () => ({ getContext }) }), { available: false, version: 0 });
  }
});

test('the real frame stops before library, ROM or runtime loading when browser graphics fail', async () => {
  const source = fs.readFileSync(new URL('../public/frame.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  const messages = [], elements = [];
  let libraryRequests = 0, scriptLoads = 0;
  const message = { hidden: false, replaceChildren() {}, append(...children) { elements.push(...children); } };
  class Observer { observe() {} disconnect() {} }
  const document = {
    querySelector: selector => selector === '#boot-message' ? message : { querySelector: () => null },
    createElement: tag => tag === 'canvas' ? { getContext: () => null } : { tag },
    body: { append() { scriptLoads++; } },
  };
  await vm.runInNewContext(`(async () => { ${source} })()`, {
    GAMES: [{ id: 'gpolice2' }], defaultControls: () => ({}),
    loadLibrary: async () => { libraryRequests++; throw new Error('Unexpected download'); },
    probeGraphics, watchStartup, document, MutationObserver: Observer,
    console: { warn() {}, error() {} }, window: { addEventListener() {} },
    parent: { postMessage: value => messages.push(value) }, location: { search: '?id=gpolice2', origin: 'http://127.0.0.1:3000' },
    URLSearchParams, clearTimeout,
  });
  assert.equal(libraryRequests, 0);
  assert.equal(scriptLoads, 0);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].phase, 'error');
  assert.match(messages[0].message, /could not create a WebGL graphics context/);
  assert.equal(elements.find(element => element.tag === 'a').href, '/guides/browser.html');
});

function fixture() {
  let label = null, observer;
  const errors = [], log = [];
  const output = { warn: (...args) => log.push(args), error: (...args) => log.push(args) };
  const warn = output.warn, error = output.error;
  class Observer {
    constructor(callback) { this.callback = callback; observer = this; }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }
  const stop = watchStartup({ root: { querySelector: () => label && { textContent: label } }, console: output, Observer, onError: message => errors.push(message) });
  return { output, errors, log, warn, error, stop, observer, showError(text) { label = text; observer.callback(); } };
}

test('caught emulator startup failures expose the underlying exception and stop observing', () => {
  const f = fixture();
  f.output.warn('Failed to start game', new Error('WebGL context creation failed'));
  assert.equal(f.log.length, 1);
  assert.equal(f.errors.length, 0);
  f.showError('Failed to start game');
  assert.match(f.errors[0], /Failed to start game — Error: WebGL context creation failed/);
  assert.equal(f.output.warn, f.warn);
  assert.equal(f.output.error, f.error);
  assert.equal(f.observer.active, false);
  f.showError('Failed to start game');
  assert.equal(f.errors.length, 1);
});

test('successful startup cleanup restores console methods without losing saves or emitting errors', () => {
  const f = fixture();
  f.output.warn('A startup warning');
  f.stop(); f.stop();
  f.showError('A late label');
  assert.equal(f.errors.length, 0);
  assert.equal(f.output.warn, f.warn);
  assert.equal(f.output.error, f.error);
  assert.equal(f.observer.active, false);
});
