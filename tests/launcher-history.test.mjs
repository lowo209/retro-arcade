import test from 'node:test';
import assert from 'node:assert/strict';
import { LAUNCHER_HISTORY_KEY, loadLauncherHistory, saveLauncherHistory, preferredGameId, rememberSelection, rememberStartedGame } from '../public/launcher-history.js';

const ids = ['umk3', 'nfs', 'gt2'];
function storageFixture(entries = []) {
  const values = new Map(entries);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('a valid game link takes priority over the remembered selection', () => {
  const history = { selectedId: 'nfs', recent: [] };
  assert.equal(preferredGameId('gt2', history, ids), 'gt2');
  assert.equal(preferredGameId('unknown', history, ids), 'nfs');
  assert.equal(preferredGameId(null, { selectedId: 'removed' }, ids), 'umk3');
  const browsed = rememberSelection(history, 'gt2', ids);
  assert.equal(browsed.selectedId, 'gt2');
  assert.deepEqual(browsed.recent, [], 'browsing alone never creates played history');
  assert.equal(history.selectedId, 'nfs', 'existing state is not mutated');
});

test('started games form a deduplicated most-recent-first list and retain the GT2 disc', () => {
  let history = { selectedId: null, recent: [] };
  history = rememberStartedGame(history, 'gt2', 'simulation', ids);
  history = rememberStartedGame(history, 'nfs', 'primary', ids);
  history = rememberStartedGame(history, 'umk3', 'simulation', ids);
  history = rememberStartedGame(history, 'gt2', 'primary', ids);
  assert.deepEqual(history, { selectedId: 'gt2', recent: [
    { id: 'gt2', variant: 'primary' }, { id: 'umk3', variant: 'primary' }, { id: 'nfs', variant: 'primary' },
  ] });
  assert.deepEqual(rememberStartedGame(history, 'removed', 'primary', ids), history);
});

test('history restores safe known titles, survives fresh reads and leaves saves/favorites intact', () => {
  const storage = storageFixture([
    ['retro-arcade-favorites-v1', '["gt2"]'], ['emulator-save-103', 'SAVE_SENTINEL'],
    [LAUNCHER_HISTORY_KEY, JSON.stringify({ selectedId: 'removed', recent: [null, { id: 'removed' }, { id: 'gt2', variant: 'simulation' }, { id: 'gt2', variant: 'primary' }, { id: 'nfs', variant: 'bogus' }] })],
  ]);
  assert.deepEqual(loadLauncherHistory(ids, storage), { selectedId: null, recent: [{ id: 'gt2', variant: 'simulation' }, { id: 'nfs', variant: 'primary' }] });
  const history = rememberStartedGame(loadLauncherHistory(ids, storage), 'umk3', 'primary', ids);
  assert.equal(saveLauncherHistory(history, ids, storage), true);
  assert.deepEqual(loadLauncherHistory(ids, storage), history);
  assert.equal(saveLauncherHistory({ ...history, recent: [] }, ids, storage), true);
  assert.deepEqual(loadLauncherHistory(ids, storage).recent, []);
  assert.equal(storage.values.get('retro-arcade-favorites-v1'), '["gt2"]');
  assert.equal(storage.values.get('emulator-save-103'), 'SAVE_SENTINEL');
  assert.equal(storage.values.size, 3);
});

test('malformed and blocked browser storage keep a usable fresh launcher state', t => {
  const storage = storageFixture();
  for (const raw of ['invalid JSON', 'null', '[]', 'false', '"nfs"']) {
    storage.values.set(LAUNCHER_HISTORY_KEY, raw);
    assert.deepEqual(loadLauncherHistory(ids, storage), { selectedId: null, recent: [] });
  }
  assert.deepEqual(loadLauncherHistory(ids, { getItem() { throw Error('blocked'); } }), { selectedId: null, recent: [] });
  assert.equal(saveLauncherHistory({}, ids, { setItem() { throw Error('quota'); } }), false);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('SecurityError'); } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage; });
  assert.deepEqual(loadLauncherHistory(ids), { selectedId: null, recent: [] });
  assert.equal(saveLauncherHistory({}, ids), false);
});
