import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { GAMES, siteUrl } from '../public/catalog.js';

const SOURCE = fs.readFileSync(new URL('../public/arcade-session.js', import.meta.url), 'utf8');
const ORIGIN = 'https://arcade.test';
const game = id => GAMES.find(item => item.id === id);

// Exercise the actual module without a WebGL engine or emulator download. This
// DOM tracks ownership and detachment so a hidden old iframe cannot pass.
function fixture({ preview = false, version = '' } = {}) {
  class Target {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    dispatch(type, value = {}) {
      for (const listener of [...(this.listeners.get(type) || [])]) listener.call(this, value);
    }
    get listenerCount() { return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
  }
  const window = new Target(), document = new Target();
  const created = [], timers = new Map(), status = [], exits = [], menus = [];
  let nextTimer = 0;
  class Element extends Target {
    constructor(tag) {
      super(); this.tagName = tag.toUpperCase(); this.children = [];
      this.attributes = {}; this.style = {}; this.dataset = {};
      this.classList = { add() {} }; this.parent = null; this.textContent = '';
      if (tag === 'iframe') this.contentWindow = {};
      created.push(this);
    }
    get childNodes() { return this.children; }
    get isConnected() {
      if (this === container) return true;
      return this.parent?.isConnected || false;
    }
    append(...elements) {
      for (const element of elements) {
        element.remove(); element.parent = this; this.children.push(element);
      }
    }
    replaceChildren(...elements) {
      for (const element of this.children) element.parent = null;
      this.children = []; this.append(...elements);
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    remove() {
      if (!this.parent) return;
      this.parent.children = this.parent.children.filter(element => element !== this);
      this.parent = null;
    }
    focus() { document.activeElement = this; }
    click() { this.dispatch('click', { target: this }); }
    find(predicate) {
      if (predicate(this)) return this;
      for (const child of this.children) {
        const result = child.find(predicate);
        if (result) return result;
      }
      return null;
    }
    async requestFullscreen() {
      document.fullscreenElement = this;
      document.dispatch('fullscreenchange');
    }
  }
  const container = new Element('section');
  document.createElement = tag => new Element(tag);
  document.fullscreenElement = null;
  document.exitFullscreen = async () => {
    document.fullscreenElement = null;
    document.dispatch('fullscreenchange');
  };
  const moduleUrl = `${ORIGIN}/retro-arcade/arcade-session.js${version ? `?v=${encodeURIComponent(version)}` : ''}`;
  const source = SOURCE.replace(/^import .*;\r?\n/gm, '')
    .replace('export function createArcadeSession', 'function createArcadeSession')
    .replaceAll('import.meta.url', JSON.stringify(moduleUrl));
  const createArcadeSession = vm.runInNewContext(`${source}\ncreateArcadeSession;`, {
    GAMES, IS_PREVIEW: preview, IS_HOSTED: true,
    FEEDBACK_URL: 'https://github.com/example/arcade/issues/new',
    siteUrl: path => siteUrl(path, `${ORIGIN}/retro-arcade/catalog.js`),
    window, document, navigator: {}, location: { origin: ORIGIN, href: `${ORIGIN}/retro-arcade/` },
    URL, URLSearchParams,
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const session = createArcadeSession(container, {
    onStatus: detail => status.push(detail), onExit: detail => exits.push(detail), onMenu: detail => menus.push(detail),
  });
  return {
    session, container, document, window, timers, status, exits, menus,
    frames: () => created.filter(element => element.tagName === 'IFRAME' && element.isConnected),
    control: label => container.find(element => element.attributes['aria-label'] === label),
    message({ origin = ORIGIN, source = session.frame?.contentWindow, phase = 'ready', message = 'Ready' } = {}) {
      window.dispatch('message', { origin, source, data: { type: 'retro-arcade-status', phase, message } });
    },
  };
}

test('a cabinet session replaces and unloads every old iframe on start, restart and stop', () => {
  const f = fixture();
  assert.equal(f.session.start(game('umk3'), { ready: true }), true);
  const first = f.session.frame;
  assert.equal(first.src, '/retro-arcade/frame.html?id=umk3');
  assert.equal(f.frames().length, 1);
  assert.equal(f.session.active, true);
  assert.equal(f.document.activeElement, first);
  assert.equal(first.allow, 'autoplay; fullscreen; gamepad');

  assert.equal(f.session.start(game('nfs'), { ready: true }), true);
  const second = f.session.frame;
  assert.notEqual(second, first);
  assert.equal(first.isConnected, false);
  assert.equal(first.parent, null);
  assert.equal(f.frames().length, 1);

  assert.equal(f.session.restart(), true);
  const third = f.session.frame;
  assert.notEqual(third, second);
  assert.equal(second.isConnected, false);
  assert.equal(second.parent, null);
  assert.equal(f.frames().length, 1);
  assert.equal(f.timers.size, 1);
  f.session.stop();
  assert.equal(third.isConnected, false);
  assert.equal(f.session.frame, null);
  assert.equal(f.session.current, null);
  assert.equal(f.session.active, false);
  assert.equal(f.frames().length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.exits.length, 0);
  f.session.dispose();
});

test('GT2 Simulation selects its independent disc and carries the deployed version into the player', () => {
  const f = fixture({ version: 'release&fresh' });
  assert.equal(f.session.start(game('gt2'), { ready: false, alternate: { ready: true } }, 'simulation'), true);
  const url = new URL(f.session.frame.src, ORIGIN);
  assert.equal(url.pathname, '/retro-arcade/frame.html');
  assert.equal(url.searchParams.get('id'), 'gt2');
  assert.equal(url.searchParams.get('variant'), 'simulation');
  assert.equal(url.searchParams.get('v'), 'release&fresh');
  assert.match(f.session.frame.title, /Simulation Mode/);
  assert.equal(f.session.current.variant, 'simulation');
  f.message({ phase: 'started', message: 'Game running' });
  assert.equal(f.timers.size, 0);
  assert.equal(f.container.find(element => element.className === 'arcade-session-footer').hidden, true);
  assert.equal(f.container.find(element => element.className === 'arcade-session-note').hidden, true);
  f.session.dispose();
});

test('unready, invalid-disc and preview launches never create an iframe', () => {
  const cases = [
    { id: 'nfs', state: { ready: false, reason: 'Not uploaded yet.' }, message: /Not uploaded yet/ },
    { id: 'gt2', state: { ready: true, alternate: { ready: false, reason: 'Simulation disc missing.' } }, variant: 'simulation', message: /Simulation disc missing/ },
    { id: 're3', state: { ready: true }, variant: 'simulation', message: /disc option is not available/ },
    { id: 'umk3', state: { ready: true }, preview: true, message: /interface preview/ },
    { id: 'gt4', state: { ready: false, reason: 'Browser build required.' }, message: /Browser build required/ },
  ];
  for (const item of cases) {
    const f = fixture({ preview: !!item.preview });
    assert.equal(f.session.start(game(item.id), item.state, item.variant), false);
    assert.equal(f.session.active, false);
    assert.equal(f.frames().length, 0);
    assert.equal(f.timers.size, 0);
    assert.match(f.status.at(-1).message, item.message);
    assert.equal(f.control('Restart game').disabled, true);
    f.session.dispose();
  }
});

test('only the current same-origin player can update status; spoofed and stale messages are ignored', () => {
  const f = fixture();
  f.session.start(game('umk3'), { ready: true });
  const oldWindow = f.session.frame.contentWindow;
  const initial = f.status.length;
  f.message({ origin: 'https://unrelated.test', message: 'Spoofed origin' });
  f.message({ source: {}, message: 'Spoofed source' });
  f.message({ phase: 'unknown', message: 'Unknown phase' });
  f.message({ message: { nested: 'Not a string' } });
  assert.equal(f.status.length, initial);
  f.message({ message: 'Valid player ready' });
  assert.equal(f.status.at(-1).message, 'Valid player ready');
  f.session.restart();
  const afterRestart = f.status.length;
  f.message({ source: oldWindow, phase: 'error', message: 'Late old frame error' });
  assert.equal(f.status.length, afterRestart);
  assert.equal(f.timers.size, 1);
  f.message({ phase: 'started', message: 'New player running' });
  assert.equal(f.status.at(-1).phase, 'started');
  assert.equal(f.timers.size, 0);
  f.session.dispose();
});

test('Back, pagehide and dispose stop emulation; menu and fullscreen controls remain explicit', async () => {
  const f = fixture();
  f.session.start(game('re3'), { ready: true });
  for (const label of ['Back to games', 'Open game menu', 'Restart game', 'Enter fullscreen']) {
    assert.equal(f.control(label).type, 'button');
  }
  f.control('Open game menu').click();
  assert.equal(f.menus.length, 1);
  assert.equal(f.menus[0].game.id, 're3');
  assert.equal(f.session.active, true);
  assert.equal(await f.session.fullscreen(), true);
  assert.equal(f.document.fullscreenElement, f.container);
  assert.equal(f.control('Exit fullscreen').attributes['aria-pressed'], 'true');
  assert.equal(await f.session.fullscreen(), true);
  assert.equal(f.document.fullscreenElement, null);
  assert.equal(f.control('Enter fullscreen').attributes['aria-pressed'], 'false');
  f.control('Back to games').click();
  assert.equal(f.exits.length, 1);
  assert.equal(f.exits[0].game.id, 're3');
  assert.equal(f.frames().length, 0);
  f.session.start(game('ac3'), { ready: true });
  f.window.dispatch('pagehide');
  assert.equal(f.frames().length, 0);
  assert.equal(f.timers.size, 0);
  f.session.start(game('gits'), { ready: true });
  f.session.dispose(); f.session.dispose();
  assert.equal(f.frames().length, 0);
  assert.equal(f.window.listenerCount, 0);
  assert.equal(f.document.listenerCount, 0);
  assert.equal(f.session.start(game('umk3'), { ready: true }), false);
});

test('graphics failures preserve the real error and expose help without navigating away', () => {
  const f = fixture();
  f.session.start(game('ac3'), { ready: true });
  f.message({ phase: 'error', message: 'The browser could not create a WebGL graphics context.' });
  assert.equal(f.timers.size, 0);
  assert.match(f.status.at(-1).message, /WebGL graphics context/);
  assert.equal(f.frames().length, 1);
  const help = f.container.find(element => element.textContent === 'Graphics help ↗');
  assert.equal(help.href, '/retro-arcade/guides/browser.html');
  assert.equal(help.target, '_blank');
  f.session.dispose();
});

test('loading and failure status remain visible but running gameplay has no status panel', () => {
  const f = fixture();
  f.session.start(game('umk3'), { ready: true });
  const first = f.session.frame;
  const panel = f.container.find(element => element.className === 'arcade-session-footer');
  assert.equal(panel.hidden, false);
  f.message({ phase: 'started', message: 'Emulator running' });
  assert.equal(panel.hidden, true);
  assert.equal(f.session.frame, first);
  assert.equal(f.frames().length, 1);
  f.message({ phase: 'error', message: 'The renderer stopped.' });
  assert.equal(panel.hidden, false);
  assert.ok(f.container.find(element => element.textContent === 'The renderer stopped.'));
  f.session.dispose();
});
