// Test the graphics path before downloading/unpacking a large game. A failed
// WebGL2 probe alone is fine: the installed legacy cores can use WebGL1.
export function probeGraphics(document) {
  for (const [name, version] of [['webgl2', 2], ['webgl', 1]]) {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext(name);
      if (!context || context.isContextLost?.()) continue;
      try { context.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* Optional cleanup extension. */ }
      return { available: true, version };
    } catch { /* Some browsers throw when graphics access is unavailable. */ }
  }
  return { available: false, version: 0 };
}

// EmulatorJS catches some startup exceptions itself. They never reach window's
// error events, so preserve its console detail until its error label appears.
export function watchStartup({ root, console: output, Observer, onError }) {
  let detail = '', stopped = false;
  const original = { warn: output.warn, error: output.error };
  const wrappers = {};
  for (const method of Object.keys(original)) {
    wrappers[method] = function (...args) {
      const exception = args.find(value => value && typeof value.message === 'string');
      const text = exception
        ? `${exception.name || 'Error'}: ${exception.message}`
        : args.filter(value => typeof value === 'string').join(' ');
      if (text && !/^Failed to start game\s*$/i.test(text)) detail = text.slice(0, 2000);
      return original[method].apply(output, args);
    };
    output[method] = wrappers[method];
  }
  const observer = new Observer(() => {
    const label = root.querySelector('.ejs_error_text')?.textContent?.trim();
    if (!label || stopped) return;
    stop();
    onError(`${label}${detail && !label.includes(detail) ? ` — ${detail}` : ''}`);
  });
  function stop() {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    for (const method of Object.keys(original)) {
      if (output[method] === wrappers[method]) output[method] = original[method];
    }
  }
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  return stop;
}
