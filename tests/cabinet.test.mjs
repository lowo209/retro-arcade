import test from 'node:test';
import assert from 'node:assert/strict';
import { initArcadeCabinet, mountCabinet } from '../public/arcade-cabinet.js';

test('WebGL creation failure leaves a usable static cabinet and library link', () => {
  const previous = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: false });
  const changes = [];
  const status = { textContent: '' };
  const host = {
    querySelector: selector => selector === '[data-cabinet-status]' ? status : {},
    classList: { remove: name => changes.push(name) },
  };
  try {
    // No browser DOM/WebGL exists in Node, exercising the real constructor failure.
    const cleanup = mountCabinet(host);
    assert.match(status.textContent, /3D view unavailable.*library link/);
    assert.deepEqual(changes, ['cabinet-ready']);
    assert.equal(typeof cleanup, 'function');
    cleanup(); cleanup();
  } finally {
    if (previous === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = previous;
  }
});

for (const reducedMotion of [false, true]) {
  test(`the screen remains reachable after WebGL failure${reducedMotion ? ' with reduced motion' : ''}`, () => {
    const previous = globalThis.matchMedia;
    globalThis.matchMedia = query => ({ matches: reducedMotion && query.includes('prefers-reduced-motion') });
    const bounds = { width: 1200, height: 800 };
    const stage = { getBoundingClientRect: () => bounds };
    const status = { textContent: '' };
    const classes = new Set();
    const snapshots = [];
    const host = {
      querySelector(selector) {
        if (selector === '.cabinet-viewport') return stage;
        if (selector === '[data-cabinet-status]') return status;
        return null;
      },
      classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
    };
    try {
      // The actual Three renderer still fails because Node has no browser DOM.
      // The root's Start handler must be able to open a usable DOM screen anyway.
      const cabinet = initArcadeCabinet(host, { onCamera: state => snapshots.push(state) });
      assert.equal(snapshots.length, 1);
      assert.equal(snapshots[0].phase, 'attract');
      assert.equal(snapshots[0].fallback, true);
      assert.ok(classes.has('cabinet-fallback'));

      cabinet.enter();
      const entered = snapshots.at(-1);
      assert.equal(entered.phase, 'browser');
      assert.equal(entered.progress, 1);
      assert.match(status.textContent, /choose a game/i);
      for (const value of Object.values(entered.rect)) assert.ok(Number.isFinite(value));
      assert.ok(entered.rect.width > 0 && entered.rect.height > 0);
      assert.ok(entered.rect.left >= 0 && entered.rect.top >= 0);
      assert.ok(entered.rect.left + entered.rect.width <= bounds.width);
      assert.ok(entered.rect.top + entered.rect.height <= bounds.height);
      const enteredCount = snapshots.length;
      cabinet.enter();
      assert.equal(snapshots.length, enteredCount, 'repeated Start does not restart the screen');

      cabinet.exit();
      assert.equal(snapshots.at(-1).phase, 'attract');
      assert.equal(snapshots.at(-1).progress, 0);
      assert.match(status.textContent, /press start/i);
      cabinet.enter();
      assert.deepEqual(snapshots.map(state => state.phase), ['attract', 'browser', 'attract', 'browser']);

      cabinet.dispose();
      cabinet.dispose();
      const disposedCount = snapshots.length;
      cabinet.exit();
      cabinet.enter();
      assert.equal(snapshots.length, disposedCount, 'disposed cabinet cannot reactivate its screen');
    } finally {
      if (previous === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = previous;
    }
  });
}
