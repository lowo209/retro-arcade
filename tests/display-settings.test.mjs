import test from 'node:test';
import assert from 'node:assert/strict';
import { DISPLAY_SETTINGS_KEY, loadDisplaySettings, saveDisplaySettings } from '../public/display-settings.js';

function storageFixture(entries = []) {
  const values = new Map(entries);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('CRT starts enabled and malformed stored preferences cannot disable it accidentally', () => {
  const storage = storageFixture();
  assert.deepEqual(loadDisplaySettings(storage), { crtEnabled: true });
  for (const raw of ['invalid JSON', 'null', '[]', '{}', 'false', '"false"', '{"crtEnabled":"false"}', '{"crtEnabled":0}']) {
    storage.values.set(DISPLAY_SETTINGS_KEY, raw);
    assert.deepEqual(loadDisplaySettings(storage), { crtEnabled: true }, raw);
  }
  const first = loadDisplaySettings(storage);
  first.crtEnabled = false;
  assert.equal(loadDisplaySettings(storage).crtEnabled, true, 'default settings are independent objects');
});

test('the CRT choice survives a new read without changing favorites or game saves', () => {
  const storage = storageFixture([
    ['retro-arcade-favorites-v1', '["gt2"]'],
    ['emulator-save-103', 'SAVE_SENTINEL'],
  ]);
  assert.equal(saveDisplaySettings({ crtEnabled: false, unrelated: 'discard' }, storage), true);
  assert.deepEqual(loadDisplaySettings(storage), { crtEnabled: false });
  assert.equal(storage.values.get(DISPLAY_SETTINGS_KEY), '{"crtEnabled":false}');
  assert.equal(saveDisplaySettings({ crtEnabled: true }, storage), true);
  assert.deepEqual(loadDisplaySettings(storage), { crtEnabled: true });
  assert.equal(storage.values.get('retro-arcade-favorites-v1'), '["gt2"]');
  assert.equal(storage.values.get('emulator-save-103'), 'SAVE_SENTINEL');
  assert.equal(storage.values.size, 3);
});

test('blocked reads and writes do not break the cabinet', () => {
  assert.deepEqual(loadDisplaySettings({ getItem() { throw new Error('Storage blocked'); } }), { crtEnabled: true });
  assert.equal(saveDisplaySettings({ crtEnabled: false }, { setItem() { throw new Error('Quota exceeded'); } }), false);
  assert.deepEqual(loadDisplaySettings(null), { crtEnabled: true });
  assert.equal(saveDisplaySettings({ crtEnabled: false }, null), false);
});

test('a blocked localStorage property getter is guarded before access', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  });
  assert.deepEqual(loadDisplaySettings(), { crtEnabled: true });
  assert.equal(saveDisplaySettings({ crtEnabled: false }), false);
  const explicit = storageFixture();
  assert.equal(saveDisplaySettings({ crtEnabled: false }, explicit), true);
  assert.deepEqual(loadDisplaySettings(explicit), { crtEnabled: false });
});
