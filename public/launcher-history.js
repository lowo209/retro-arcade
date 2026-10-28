export const LAUNCHER_HISTORY_KEY = 'retro-arcade-launcher-v1';

const resolveStorage = storage => storage === undefined ? globalThis.localStorage : storage;

function normalize(value, gameIds) {
  const known = new Set(gameIds);
  const recent = [], seen = new Set();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Array.isArray(value.recent)) for (const entry of value.recent) {
      if (!entry || !known.has(entry.id) || seen.has(entry.id)) continue;
      seen.add(entry.id);
      recent.push({ id: entry.id, variant: entry.id === 'gt2' && entry.variant === 'simulation' ? 'simulation' : 'primary' });
      if (recent.length >= gameIds.length) break;
    }
    return { selectedId: known.has(value.selectedId) ? value.selectedId : null, recent };
  }
  return { selectedId: null, recent };
}

export function loadLauncherHistory(gameIds, storage) {
  try {
    return normalize(JSON.parse(resolveStorage(storage).getItem(LAUNCHER_HISTORY_KEY)), gameIds);
  } catch {
    return { selectedId: null, recent: [] };
  }
}

export function saveLauncherHistory(history, gameIds, storage) {
  try {
    resolveStorage(storage).setItem(LAUNCHER_HISTORY_KEY, JSON.stringify(normalize(history, gameIds)));
    return true;
  } catch {
    return false;
  }
}

export function preferredGameId(requestedId, history, gameIds) {
  return gameIds.includes(requestedId) ? requestedId : normalize(history, gameIds).selectedId || gameIds[0];
}

export function rememberSelection(history, id, gameIds) {
  const next = normalize(history, gameIds);
  if (gameIds.includes(id)) next.selectedId = id;
  return next;
}

// Call only after the current player confirms it started. Clicking Play or a
// failed download must not appear as a successful recent game.
export function rememberStartedGame(history, id, variant, gameIds) {
  const next = normalize(history, gameIds);
  if (!gameIds.includes(id)) return next;
  next.selectedId = id;
  next.recent = [{ id, variant: id === 'gt2' && variant === 'simulation' ? 'simulation' : 'primary' }, ...next.recent.filter(item => item.id !== id)];
  return next;
}
