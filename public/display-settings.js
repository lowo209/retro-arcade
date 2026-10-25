export const DISPLAY_SETTINGS_KEY = 'retro-arcade-display-v1';

function normalize(value) {
  const enabled = value && typeof value === 'object' && !Array.isArray(value) ? value.crtEnabled : undefined;
  return { crtEnabled: typeof enabled === 'boolean' ? enabled : true };
}

// Resolve localStorage inside the guarded operation: some browsers throw even
// when reading the property, and the cabinet must still work without storage.
const resolveStorage = storage => storage === undefined ? globalThis.localStorage : storage;

export function loadDisplaySettings(storage) {
  try {
    return normalize(JSON.parse(resolveStorage(storage).getItem(DISPLAY_SETTINGS_KEY)));
  } catch {
    return { crtEnabled: true };
  }
}

export function saveDisplaySettings(settings, storage) {
  try {
    resolveStorage(storage).setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(normalize(settings)));
    return true;
  } catch {
    return false;
  }
}
