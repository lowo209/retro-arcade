import test from 'node:test';
import assert from 'node:assert/strict';
import { mountCabinet } from '../public/arcade-cabinet.js';

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
