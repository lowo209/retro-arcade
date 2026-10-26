import { GAMES, IS_PREVIEW, IS_HOSTED, FEEDBACK_URL, siteUrl } from './catalog.js';

const PHASES = new Set(['loading', 'ready', 'waiting', 'started', 'error']);
const SESSION_VERSION = new URL(import.meta.url).searchParams.get('v');
const graphicsError = message => /webgl|GLctx|GL\.contexts|graphics context|hardware acceleration/i.test(message);

/**
 * One game, one iframe. The cabinet owns the surrounding browser and menus.
 * Pass the primary library state; this module selects GT2's alternate disc.
 */
export function createArcadeSession(container, {
  onStatus = () => {}, onExit = () => {}, onMenu = () => {}, fullscreenTarget = container,
} = {}) {
  if (!container?.replaceChildren) throw new TypeError('A session container is required.');
  let current = null, frame = null, timer = null, disposed = false;
  let statusElement = null, statusPanel = null, noteElement = null, fullscreenButton = null;
  let restartButton = null, stage = null;

  const detail = (phase, message) => ({ phase, message, game: current?.game || null, variant: current?.variant || 'primary' });
  function report(phase, message) {
    const text = String(message || '').slice(0, 4096);
    if (statusElement) statusElement.textContent = text;
    // Loading and failures stay visible; a running game owns the whole display.
    if (statusPanel) statusPanel.hidden = phase === 'started';
    container.dataset.phase = phase;
    onStatus(detail(phase, text));
  }
  function note(message = '', { help = false, feedback = false } = {}) {
    if (!noteElement) return;
    noteElement.replaceChildren();
    if (message) {
      const text = document.createElement('span');
      text.textContent = message;
      noteElement.append(text);
    }
    if (help) {
      const link = document.createElement('a');
      link.className = 'arcade-session-help';
      link.href = siteUrl('guides/browser.html');
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = 'Graphics help ↗';
      noteElement.append(link);
    }
    if (feedback && FEEDBACK_URL) {
      const link = document.createElement('a');
      link.className = 'arcade-session-help';
      link.href = FEEDBACK_URL;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = 'Report a problem ↗';
      noteElement.append(link);
    }
    noteElement.hidden = !noteElement.childNodes.length;
  }
  function button(label, symbol, action) {
    const element = document.createElement('button');
    element.type = 'button';
    element.setAttribute('aria-label', label);
    element.title = label;
    element.textContent = symbol;
    element.addEventListener('click', action);
    return element;
  }
  function refreshFullscreen() {
    if (!fullscreenButton) return;
    const active = !!document.fullscreenElement;
    const label = active ? 'Exit fullscreen' : 'Enter fullscreen';
    fullscreenButton.setAttribute('aria-label', label);
    fullscreenButton.setAttribute('aria-pressed', String(active));
    fullscreenButton.title = label;
  }
  function renderChrome(game, variant) {
    container.classList.add('arcade-session');
    const toolbar = document.createElement('div');
    toolbar.className = 'arcade-session-toolbar';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Game session controls');
    toolbar.append(button('Back to games', '←', () => stop({ notify: true })));
    const title = document.createElement('span');
    title.className = 'arcade-session-title';
    title.textContent = `${game.short || game.title}${variant === 'simulation' ? ' / SIM' : ''}`;
    title.title = `${game.title}${variant === 'simulation' ? ' — Simulation Mode' : ''}`;
    toolbar.append(title);
    const actions = document.createElement('div');
    actions.className = 'arcade-session-actions';
    actions.append(button('Open game menu', '≡', () => onMenu(detail(container.dataset.phase, statusElement?.textContent || ''))));
    restartButton = button('Restart game', '↻', restart);
    fullscreenButton = button('Enter fullscreen', '⛶', fullscreen);
    actions.append(restartButton, fullscreenButton);
    toolbar.append(actions);
    stage = document.createElement('div');
    stage.className = 'arcade-session-stage';
    Object.assign(stage.style, { position: 'relative', minHeight: '0', minWidth: '0', flex: '1', overflow: 'hidden' });
    statusPanel = document.createElement('div');
    statusPanel.className = 'arcade-session-footer';
    statusElement = document.createElement('span');
    statusElement.className = 'arcade-session-status';
    statusElement.setAttribute('role', 'status');
    statusElement.setAttribute('aria-live', 'polite');
    statusPanel.append(statusElement);
    noteElement = document.createElement('div');
    noteElement.className = 'arcade-session-note';
    noteElement.hidden = true;
    container.replaceChildren(toolbar, stage, statusPanel, noteElement);
    refreshFullscreen();
  }
  function showError(message, { preview = false } = {}) {
    if (timer) clearTimeout(timer);
    timer = null;
    const error = document.createElement('div');
    error.className = 'arcade-session-error';
    error.setAttribute('role', 'alert');
    const title = document.createElement('strong');
    title.textContent = preview ? 'Interface preview' : 'Unable to launch';
    const description = document.createElement('p');
    description.textContent = String(message);
    error.append(title, description);
    stage.replaceChildren(error);
    frame?.remove(); frame = null;
    note('', { help: graphicsError(message), feedback: !preview });
    report(preview ? 'preview' : 'error', message);
    return false;
  }
  function start(game, state, variant = 'primary') {
    if (disposed) return false;
    stop();
    const canonical = GAMES.find(item => item.id === game?.id);
    if (!canonical) {
      current = { game: { id: '', title: 'Unknown game' }, state: null, variant: 'primary' };
      renderChrome(current.game, 'primary');
      restartButton.disabled = true;
      return showError('Choose a game from the library.');
    }
    current = { game: canonical, state, variant };
    renderChrome(canonical, variant);
    if (IS_PREVIEW || state?.preview) {
      restartButton.disabled = true;
      return showError('Game playback is not enabled in this interface preview.', { preview: true });
    }
    if (!['primary', 'simulation'].includes(variant) || (variant === 'simulation' && canonical.id !== 'gt2')) {
      restartButton.disabled = true;
      return showError('This disc option is not available for this game.');
    }
    const selected = variant === 'simulation' ? state?.alternate : state;
    if (!selected?.ready) {
      restartButton.disabled = true;
      return showError(selected?.reason || (IS_HOSTED ? 'This game is not available in the tester release.' : 'The required local files are not installed.'));
    }
    if (canonical.experimental && (!window.crossOriginIsolated || !navigator.gpu)) {
      return showError('This experimental build needs WebGPU and cross-origin isolation.');
    }
    const frameQuery = new URLSearchParams({ id: canonical.id });
    if (variant === 'simulation') frameQuery.set('variant', 'simulation');
    if (SESSION_VERSION) frameQuery.set('v', SESSION_VERSION);
    let source = siteUrl(`frame.html?${frameQuery}`);
    if (canonical.experimental) {
      try {
        const player = new URL(selected.playerUrl, location.href);
        if (!selected.playerUrl || player.origin !== location.origin) throw new Error('Unsupported experimental player.');
        source = player.href;
      } catch { return showError('The experimental browser build is unavailable.'); }
    }
    frame = document.createElement('iframe');
    frame.className = 'arcade-session-frame';
    frame.title = `${canonical.title}${variant === 'simulation' ? ' — Simulation Mode' : ''}`;
    frame.allow = 'autoplay; fullscreen; gamepad';
    frame.allowFullscreen = true;
    frame.setAttribute('tabindex', '0');
    Object.assign(frame.style, { display: 'block', width: '100%', height: '100%', minWidth: '0', minHeight: '0', border: '0' });
    frame.src = source;
    stage.replaceChildren(frame);
    const ownedFrame = frame;
    frame.addEventListener('load', () => {
      if (ownedFrame !== frame) return;
      if (canonical.experimental) {
        clearTimeout(timer); timer = null;
        report('ready', 'Experimental build loaded · gameplay unverified');
      }
    });
    report('loading', IS_HOSTED ? 'Downloading game data…' : 'Loading game…');
    timer = setTimeout(() => {
      if (ownedFrame !== frame) return;
      note(IS_HOSTED ? 'First downloads can take several minutes. Keep this screen open.' : 'Still loading? Check the emulator message, then try Restart.');
      report('waiting', 'Still loading…');
    }, 90000);
    // Focus only at the explicit launch gesture. A later "started" message must
    // not steal focus if the visitor opened the cabinet menu while downloading.
    frame.focus();
    return true;
  }
  function receive(event) {
    if (!frame || event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'retro-arcade-status') return;
    const { phase, message } = event.data;
    if (!PHASES.has(phase) || typeof message !== 'string') return;
    if (phase === 'started' || phase === 'error') {
      clearTimeout(timer); timer = null;
    }
    if (phase === 'error') {
      // Preserve the emulator's specific error in its iframe as well as the
      // compact status. The visitor can read it and report it before retrying.
      note('', { help: graphicsError(message), feedback: true });
    } else if (phase === 'started') note('');
    report(phase, message);
  }
  function stop({ notify = false } = {}) {
    const previous = current ? detail('stopped', '') : null;
    clearTimeout(timer); timer = null;
    frame?.remove(); frame = null;
    current = null;
    stage = statusElement = statusPanel = noteElement = fullscreenButton = restartButton = null;
    container.replaceChildren();
    delete container.dataset.phase;
    if (notify && previous) onExit(previous);
  }
  function restart() {
    if (!current || disposed) return false;
    const { game, state, variant } = current;
    return start(game, state, variant);
  }
  async function fullscreen() {
    if (disposed || !current) return false;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await fullscreenTarget.requestFullscreen();
      refreshFullscreen();
      return true;
    } catch {
      note('Fullscreen is unavailable. Try the emulator’s fullscreen control.');
      return false;
    }
  }
  function pagehide() { stop(); }
  function dispose() {
    if (disposed) return;
    stop(); disposed = true;
    window.removeEventListener('message', receive);
    window.removeEventListener('pagehide', pagehide);
    document.removeEventListener('fullscreenchange', refreshFullscreen);
  }
  window.addEventListener('message', receive);
  window.addEventListener('pagehide', pagehide);
  document.addEventListener('fullscreenchange', refreshFullscreen);
  return {
    start, stop, restart, fullscreen, dispose,
    focus() { frame?.focus(); },
    get active() { return !!frame; },
    get frame() { return frame; },
    get current() { return current ? { ...current } : null; },
  };
}
