import { GAMES, defaultControls, loadLibrary, runtimeUrl, siteUrl, IS_HOSTED } from './catalog.js';
import { probeGraphics, watchStartup } from './startup-diagnostics.js';
const query = new URLSearchParams(location.search), id = query.get('id');
const message = document.querySelector('#boot-message');
let started = false, failed = false, timeout, stopDiagnostics = () => {};
function status(phase, text) { parent.postMessage({ type: 'retro-arcade-status', phase, message: text }, location.origin); }
function fail(text) {
  if (failed || started) return;
  failed = true; clearTimeout(timeout); stopDiagnostics();
  message.hidden = false; message.replaceChildren();
  const graphics = /webgl|GLctx|GL\.contexts|graphics context/i.test(text);
  const strong = document.createElement('strong');
  strong.textContent = graphics ? 'Your browser’s game graphics are unavailable.' : 'The game could not start.';
  const p = document.createElement('p'); p.textContent = text; message.append(strong, p);
  if (graphics) {
    const help = document.createElement('a'); help.href = siteUrl('guides/browser.html'); help.target = '_top';
    help.textContent = 'How to restore browser graphics →'; message.append(help);
  }
  status('error', text);
}
stopDiagnostics = watchStartup({ root: document.querySelector('#game'), console, Observer: MutationObserver, onError: fail });
window.addEventListener('pagehide', () => { stopDiagnostics(); clearTimeout(timeout); }, { once: true });
window.addEventListener('error', event => { if (!started) fail(`Emulator error: ${event.message || 'A local dependency could not load.'}`); });
window.addEventListener('unhandledrejection', event => { if (!started) fail(`Emulator error: ${event.reason?.message || 'The local game or core could not load.'}`); });
try {
  const game = GAMES.find(g => g.id === id && !g.experimental);
  if (!game) throw new Error('Unknown emulator game.');
  if (!probeGraphics(document).available) throw new Error('This browser could not create a WebGL graphics context. Check hardware acceleration, restart the browser, then retry. You can also try this same address in another browser. The game files do not need to be replaced.');
  const library = await loadLibrary(); const main = library.games.find(g => g.id === id);
  const state = query.get('variant') === 'simulation' && id === 'gt2' ? main.alternate : main;
  if (!state?.ready) throw new Error(state?.reason || 'This game needs local setup.');
  const required = [runtimeUrl('loader.js'), runtimeUrl('emulator.min.js'), runtimeUrl(`cores/${state.core}-wasm.data`), state.romUrl, ...(state.biosUrl ? [state.biosUrl] : [])];
  for (const url of required) {
    try {
      // A classic cross-origin script may have a cached response without CORS
      // headers. Check the network afresh instead of reusing that response.
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      const name = new URL(url, location.href).pathname.split('/').pop();
      throw new Error(IS_HOSTED ? `The download for ${name} could not be reached (${error.message}). Please retry or include this message in tester feedback.` : `Local file unavailable: ${url} (${error.message})`);
    }
  }
  Object.assign(window, { EJS_player: '#game', EJS_core: state.core, EJS_gameUrl: state.romUrl, EJS_biosUrl: state.biosUrl || '', EJS_pathtodata: runtimeUrl(''), EJS_gameName: `${game.title}${query.get('variant') === 'simulation' ? ' Simulation' : ''}`, EJS_gameID: { umk3: 101, nfs: 102, gt2: query.get('variant') === 'simulation' ? 104 : 103, re3: 105, ac3: 106, gits: 107, gpolice2: 108 }[id], EJS_color: '#e18a54', EJS_backgroundColor: '#08090a', EJS_language: 'en-US', EJS_disableAutoLang: false, EJS_startOnLoaded: true, EJS_startButtonName: 'Start original game', EJS_threads: false, EJS_CacheLimit: 1024 * 1024 * 1024, EJS_defaultControls: defaultControls(id), EJS_defaultOptions: { 'save-state-location': 'browser' } });
  // This exact arcade/core combination returned a zero-size state in gameplay.
  // Keep broken actions out of its toolbar; PS1 uses the normal upstream saves.
  if (id === 'umk3') window.EJS_Buttons = { saveState: { visible: false }, loadState: { visible: false } };
  if (state.core === 'pcsx_rearmed') window.EJS_disableCue = false;
  window.EJS_ready = () => { message.hidden = true; status('ready', 'Emulator ready · loading game'); };
  window.EJS_onGameStart = () => { started = true; clearTimeout(timeout); stopDiagnostics(); message.hidden = true; status('started', 'Emulator running · click the game to focus controls'); };
  // Do not register save/load event callbacks: 4.2.3 treats their presence as
  // replacement handlers and would skip its built-in persistence behavior.
  timeout = setTimeout(() => { if (!started) status('waiting', 'Loading is taking longer than expected. Check the emulator message.'); }, 90000);
  status('loading', IS_HOSTED ? 'Downloading emulator and game data… First loads can take a few minutes.' : 'Loading local emulator and game data…');
  const script = document.createElement('script'); script.src = runtimeUrl('loader.js'); script.crossOrigin = 'anonymous'; script.onerror = () => fail(IS_HOSTED ? 'The emulator download failed. Please retry or send tester feedback.' : 'The local EmulatorJS loader is missing. Run npm run setup.'); document.body.append(script);
} catch (error) { fail(error.message); }
