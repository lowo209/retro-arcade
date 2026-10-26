import { GAMES, controlsForGame, escapeHTML as esc, loadLibrary, IS_PREVIEW, IS_HOSTED, FEEDBACK_URL, siteUrl } from './catalog.js';
import { initArcadeCabinet } from './arcade-cabinet.js';
import { createArcadeSession } from './arcade-session.js';
import { loadDisplaySettings, saveDisplaySettings } from './display-settings.js';

const $ = selector => document.querySelector(selector);
const screen = $('#cabinet-screen'), browser = $('#browser-panel'), rail = $('#game-rail');
const menu = $('#arcade-menu'), sessionHost = $('#session-container');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const favoriteKey = 'retro-arcade-favorites-v1';
const githubUrl = 'https://github.com/lowo209/retro-arcade';
const requestedGame = new URLSearchParams(location.search).get('game');
let selectedId = GAMES.some(g => g.id === requestedGame) ? requestedGame : GAMES[0].id;
let library = null, libraryError = '', filter = 'all', search = '', visibleGames = [...GAMES];
let favorites = new Set(), view = 'attract', menuTab = 'library', controlPlayer = 1;
let settingsTab = 'display';
let menuFocus = null, menuAfterEnter = null, scrollTimer = null, toastTimer = null;
let cabinet, entering = false, gamepadTimer = null, padPrevious = new Set(), padRepeat = 0;
let displaySettings = loadDisplaySettings();
let displaySettingsStatus = '';
document.body.dataset.crt = displaySettings.crtEnabled ? 'on' : 'off';
try { const saved = JSON.parse(localStorage.getItem(favoriteKey) || '[]'); if (Array.isArray(saved)) favorites = new Set(saved.filter(id => GAMES.some(g => g.id === id))); } catch { /* Storage is optional. */ }
const selectedGame = () => GAMES.find(g => g.id === selectedId) || GAMES[0];
const stateFor = id => library?.games?.find(g => g.id === id);
const inSession = () => view === 'playing';
const isMenuOpen = () => !menu.hidden;
const icon = platform => platform === 'Arcade' ? '▦' : platform === 'PlayStation 2' ? 'Ⅱ' : '△○×□';
const coverFor = game => stateFor(game.id)?.coverUrl || siteUrl(`assets/${game.cover}.svg`);

function toast(message) {
  clearTimeout(toastTimer); const target = $('#arcade-feedback'); target.textContent = message; target.hidden = false;
  toastTimer = setTimeout(() => { target.hidden = true; }, 3500);
}
function setView(next) {
  view = next; document.body.dataset.view = next;
  $('.attract-start').inert = next !== 'attract';
  const playing = next === 'playing'; browser.hidden = playing; sessionHost.hidden = !playing;
  $('#open-search').hidden = playing;
  if (next === 'browser') $('#system-label').textContent = 'READY';
  if (next === 'attract') { screen.hidden = true; screen.inert = true; }
  else if (next === 'browser' || playing) { screen.hidden = false; screen.inert = false; }
  cabinet?.setScreenMode(playing ? 'playing' : next === 'attract' ? 'idle' : 'browser');
  updatePadPolling();
}
function enterArcade() {
  if (view !== 'attract' || entering) return;
  entering = true; document.body.dataset.view = 'entering'; view = 'entering';
  $('.attract-start').inert = true;
  $('#enter-arcade').disabled = true; cabinet.enter();
}
function finishEntering() {
  if (view !== 'entering') return;
  entering = false; setView('browser'); $('#enter-arcade').disabled = false;
  requestAnimationFrame(() => { centerSelected(false); screen.focus({ preventScroll: true }); });
  if (menuAfterEnter) { const tab = menuAfterEnter; menuAfterEnter = null; openMenu(tab); }
}
function leaveArcade() {
  closeMenu({ restore: false }); session.stop(); entering = false;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  setView('attract'); cabinet.exit(); $('#enter-arcade').disabled = false; $('#enter-arcade').focus({ preventScroll: true });
}
const session = createArcadeSession(sessionHost, {
  fullscreenTarget: screen,
  onExit() { setView('browser'); centerSelected(false); $('#launch-game').focus({ preventScroll: true }); $('#system-label').textContent = 'READY'; },
  onMenu() { openMenu('controls'); },
  onStatus({ phase }) { $('#system-label').textContent = phase === 'started' ? 'PLAYING' : phase === 'error' ? 'ERROR' : 'LOADING'; },
});
cabinet = initArcadeCabinet($('#arcade-cabinet'), {
  crtEnabled: displaySettings.crtEnabled,
  onStart: enterArcade,
  onCamera({ phase, rect }) {
    if (rect && rect.width > 0 && rect.height > 0) for (const [name, value] of Object.entries(rect)) screen.style.setProperty(`--screen-${name}`, `${value}px`);
    if (phase === 'browser' && view === 'entering') finishEntering();
  },
  onControl(id) {
    if (view !== 'browser' || isMenuOpen()) return;
    if (id === 'left' || id === 'right') moveSelection(id === 'left' ? -1 : 1);
    if (id === 'buttonA') launch();
    if (id === 'buttonB') toggleFavorite();
    if (id === 'buttonC') openMenu('game');
  },
});
screen.inert = true;

function centerSelected(animate = true) {
  const tile = rail.querySelector(`[data-game="${selectedId}"]`); if (!tile) return;
  rail.scrollTo({ left: tile.offsetLeft - (rail.clientWidth - tile.offsetWidth) / 2, behavior: animate && !reducedMotion.matches ? 'smooth' : 'instant' });
}
function selectGame(id, { center = true, animate = true, focus = false } = {}) {
  if (!visibleGames.some(g => g.id === id)) return;
  selectedId = id;
  for (const tile of rail.querySelectorAll('[data-game]')) {
    const active = tile.dataset.game === id; tile.classList.toggle('is-selected', active); tile.setAttribute('aria-pressed', String(active)); tile.tabIndex = active ? 0 : -1;
  }
  renderSelection(); if (center) centerSelected(animate);
  if (focus) rail.querySelector(`[data-game="${id}"]`)?.focus({ preventScroll: true });
}
function moveSelection(direction, { focus = false } = {}) {
  if (!visibleGames.length) return;
  const index = Math.max(0, visibleGames.findIndex(g => g.id === selectedId));
  selectGame(visibleGames[(index + direction + visibleGames.length) % visibleGames.length].id, { focus });
}
function renderSelection() {
  const game = selectedGame(), state = stateFor(game.id), favorite = favorites.has(game.id);
  const index = visibleGames.findIndex(g => g.id === selectedId);
  $('#selection-position').textContent = index < 0 ? '00' : String(index + 1).padStart(2, '0');
  $('#selection-total').textContent = String(visibleGames.length).padStart(2, '0');
  $('#selected-game').hidden = !visibleGames.length;
  $('#selected-title').textContent = game.title;
  $('#selected-meta').innerHTML = `<span>${esc(game.platform)}</span><i>·</i><span>${esc(game.year)}</span><i>·</i><span>${esc(game.players)}</span>`;
  const favoriteButton = $('#toggle-favorite'); favoriteButton.textContent = favorite ? '♥' : '♡';
  favoriteButton.classList.toggle('is-favorite', favorite); favoriteButton.setAttribute('aria-pressed', String(favorite));
  favoriteButton.setAttribute('aria-label', `${favorite ? 'Remove' : 'Add'} ${game.title} ${favorite ? 'from' : 'to'} favorites`);
  const ready = state?.ready && !game.experimental;
  $('#launch-game').disabled = !library || !!libraryError;
  $('#launch-game').classList.toggle('is-unavailable', !ready);
  $('#launch-label').textContent = !library ? 'LOADING' : IS_PREVIEW ? 'PREVIEW' : ready ? 'PLAY' : 'DETAILS';
  $('#launch-game').setAttribute('aria-label', `${ready ? 'Play' : 'View information for'} ${game.title}`);
  screen.style.setProperty('--selected-cover', `url("${coverFor(game)}")`);
  if (isMenuOpen() && (menuTab === 'game' || menuTab === 'settings')) renderMenu();
}
function renderLibrary({ center = true } = {}) {
  visibleGames = GAMES.filter(game => (filter === 'all' || filter === game.platform || filter === 'favorites' && favorites.has(game.id)) && `${game.title} ${game.genre} ${game.platform}`.toLowerCase().includes(search.toLowerCase()));
  if (!visibleGames.some(g => g.id === selectedId) && visibleGames.length) selectedId = visibleGames[0].id;
  rail.innerHTML = visibleGames.map(game => {
    const state = stateFor(game.id), selected = game.id === selectedId;
    const status = IS_PREVIEW ? 'PREVIEW' : game.experimental ? 'SOON' : state?.ready ? '' : library ? 'UNAVAILABLE' : 'LOADING';
    return `<div class="game-slot" role="listitem"><button type="button" class="game-tile ${selected ? 'is-selected' : ''} ${state?.ready ? 'is-ready' : ''}" data-game="${game.id}" aria-pressed="${selected}" aria-label="Select ${esc(game.title)}${status ? ` — ${status.toLowerCase()}` : ''}" tabindex="${selected ? '0' : '-1'}"><span class="tile-cover"><img src="${esc(coverFor(game))}" alt="${esc(game.title)} cover" width="300" height="360"><span class="tile-platform">${icon(game.platform)}</span><span class="tile-favorite" ${favorites.has(game.id) ? '' : 'hidden'}>♥</span><span class="tile-shine"></span></span><span class="tile-caption"><span>${esc(game.short)}</span>${status ? `<small>${status}</small>` : ''}</span></button></div>`;
  }).join('');
  $('#empty-results').hidden = visibleGames.length > 0;
  $('#empty-message').textContent = search ? `Nothing matches “${search}”.` : filter === 'favorites' ? 'Your favorite games will appear here.' : 'No games in this selection.';
  $('#previous-game').disabled = $('#next-game').disabled = visibleGames.length < 2;
  $('#favorites-count').textContent = favorites.size;
  for (const button of document.querySelectorAll('[data-filter]')) { const active = button.dataset.filter === filter; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); }
  const ready = library?.games?.filter(g => g.ready && !g.experimental).length || 0;
  $('#library-status').textContent = libraryError ? 'Connection lost. Open Collection to retry.' : !library ? 'Loading games…' : IS_PREVIEW ? 'Preview' : `${ready} games ready`;
  renderSelection(); if (center) requestAnimationFrame(() => centerSelected(false));
}
async function refreshLibrary() {
  libraryError = ''; $('#room-status').textContent = 'CONNECTING';
  try { library = await loadLibrary(); $('#room-status').textContent = IS_PREVIEW ? 'PREVIEW' : 'ONLINE'; }
  catch (error) { libraryError = error.message || 'The library is unavailable.'; $('#room-status').textContent = 'CONNECTION LOST'; toast('Library unavailable. Open the menu to retry.'); }
  renderLibrary(); if (isMenuOpen()) renderMenu();
}
function toggleFavorite() {
  if (!visibleGames.length) return;
  const game = selectedGame(), had = favorites.has(game.id);
  if (had) favorites.delete(game.id); else favorites.add(game.id);
  let saved = true; try { localStorage.setItem(favoriteKey, JSON.stringify([...favorites])); } catch { saved = false; }
  renderLibrary(); toast(`${had ? 'Removed from' : 'Added to'} favorites${saved ? '' : ' · this visit only'}.`);
}
function launch(variant = 'primary') {
  if (!visibleGames.length || !library || libraryError) return;
  const game = inSession() ? menuGame() : selectedGame(), state = stateFor(game.id), chosen = variant === 'simulation' ? state?.alternate : state;
  if (!chosen?.ready || IS_PREVIEW || game.experimental && !state?.playerUrl) { openMenu('game'); return; }
  closeMenu({ restore: false }); setView('playing'); session.start(game, state, variant);
}

function keyLabel(value) { return ({ 'up arrow': '↑', 'down arrow': '↓', 'left arrow': '←', 'right arrow': '→', enter: 'ENTER', 'decimal point': 'NUM .' }[value] || value.replace('numpad ', 'NUM ').toUpperCase()); }
function controlLabel(control, id) {
  const labels = id === 'umk3' ? { 0: 'Action B', 1: 'Action Y', 2: 'Insert coin', 8: 'Action A', 9: 'Action X', 10: 'Action L', 11: 'Action R' } : { 0: 'Cross ×', 1: 'Square □', 2: 'Select', 8: 'Circle ○', 9: 'Triangle △', 10: 'L1', 11: 'R1' };
  return (id === 'nfs' || id === 'gt2') && ({ 0: 'Throttle / confirm', 1: 'Brake', 4: 'Menu up', 5: 'Menu down', 6: 'Steer left', 7: 'Steer right' })[control.id] || labels[control.id] || control.label;
}
function menuGame() { return inSession() && session.current?.game || selectedGame(); }
function openMenu(tab = 'library') {
  if (tab === 'controls') { tab = 'settings'; settingsTab = 'controls'; }
  if (tab === 'help' || tab === 'about') { tab = 'settings'; settingsTab = 'saves'; }
  if (view === 'attract' || view === 'entering') { menuAfterEnter = tab; if (view === 'attract') enterArcade(); return; }
  if (menu.hidden) menuFocus = document.activeElement;
  menuTab = tab; menu.hidden = false; $('#open-menu').setAttribute('aria-expanded', 'true');
  browser.inert = true; sessionHost.inert = true; $('.screen-system-bar').inert = true; $('.room-hud').inert = true; renderMenu();
  (tab === 'library' ? $('#search') : menu.querySelector(`[data-menu-tab="${tab}"]`) || $('#close-menu'))?.focus({ preventScroll: true });
}
function closeMenu({ restore = true } = {}) {
  if (menu.hidden) return;
  menu.hidden = true; $('#open-menu').setAttribute('aria-expanded', 'false'); browser.inert = false; sessionHost.inert = false; $('.screen-system-bar').inert = false; $('.room-hud').inert = false;
  if (restore) { if (menuFocus?.isConnected && !menuFocus.closest('[hidden]')) menuFocus.focus({ preventScroll: true }); else if (inSession()) session.focus(); else $('#open-menu').focus({ preventScroll: true }); }
}
function renderMenu() {
  for (const button of menu.querySelectorAll('[data-menu-tab]')) { const active = button.dataset.menuTab === menuTab; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); }
  const game = menuGame(), state = stateFor(game.id), content = $('#menu-content');
  if (game.singlePlayer) controlPlayer = 1;
  $('#menu-resume').textContent = inSession() ? 'RESUME ↗' : 'BACK ↗';
  $('#menu-title').textContent = ({ library: 'COLLECTION', game: game.short, settings: 'SETTINGS' })[menuTab];
  if (menuTab === 'library') {
    content.innerHTML = `<label class="console-search"><span aria-hidden="true">⌕</span><input type="search" id="search" placeholder="Search games…" aria-label="Search games" value="${esc(search)}" autocomplete="off"></label><div id="search-results" class="menu-results"></div>${search ? '<button type="button" class="menu-text-button" data-menu-action="clear-search">CLEAR ×</button>' : ''}${libraryError ? `<p class="menu-warning">${esc(libraryError)}</p><button type="button" class="menu-text-button" data-menu-action="refresh">↻ RETRY</button>` : ''}`;
    renderSearchResults();
  }
  if (menuTab === 'game') {
    const ready = state?.ready && !game.experimental;
    content.innerHTML = `<p class="menu-eyebrow">${esc(game.platform)} / ${esc(game.year)} / ${esc(game.players)}</p><h3>${esc(game.title)}</h3><div class="menu-tag-row"><span>${esc(game.genre)}</span>${state?.downloadBytes ? `<span>${Math.ceil(state.downloadBytes / 1e6)} MB</span>` : ''}</div>${!ready ? `<p class="menu-warning">${esc(IS_PREVIEW ? 'Preview only. Playback is disabled.' : state?.reason || game.missing)}</p>` : ''}${!IS_HOSTED && !IS_PREVIEW && !ready ? `<code class="menu-file">${esc(game.filename)}</code>` : ''}${game.id === 'gt2' && state?.alternate?.ready ? '<div class="disc-options"><button type="button" data-menu-action="play">▶ ARCADE <small>European · split-screen</small></button><button type="button" data-menu-action="simulation">▶ SIMULATION <small>US · separate saves</small></button></div>' : ready ? '<button type="button" class="menu-play-button" data-menu-action="play">PLAY ▶</button>' : ''}<button type="button" class="menu-text-button" data-menu-action="controls">CONTROLS ↗</button>`;
  }
  if (menuTab === 'settings') {
    const tabs = `<div class="settings-tabs" role="group" aria-label="Settings section">${[['display', 'DISPLAY'], ['controls', 'CONTROLS'], ['saves', 'SAVES & HELP']].map(([id, label]) => `<button type="button" data-settings-tab="${id}" aria-pressed="${settingsTab === id}" class="${settingsTab === id ? 'is-active' : ''}">${label}</button>`).join('')}</div>`;
    let panel = '';
    if (settingsTab === 'display') panel = `<label class="display-setting" for="crt-effect"><span class="display-setting-copy"><strong>CRT effect</strong><small id="crt-effect-description">Scanlines & glass texture</small></span><span class="display-setting-toggle"><input type="checkbox" role="switch" id="crt-effect" aria-describedby="crt-effect-description" ${displaySettings.crtEnabled ? 'checked' : ''}><span aria-hidden="true"></span></span></label><p class="display-settings-status" id="display-settings-status" role="status" aria-live="polite">${esc(displaySettingsStatus)}</p>`;
    if (settingsTab === 'controls') panel = `<p class="menu-eyebrow">${esc(game.short)}</p><div class="control-player-switch"><button type="button" data-control-player="1" aria-pressed="${controlPlayer === 1}" class="${controlPlayer === 1 ? 'is-active' : ''}">PLAYER 1</button>${!game.singlePlayer ? `<button type="button" data-control-player="2" aria-pressed="${controlPlayer === 2}" class="${controlPlayer === 2 ? 'is-active' : ''}">PLAYER 2</button>` : ''}</div><div class="console-controls">${controlsForGame(game.id).map(control => `<div><span>${esc(controlLabel(control, game.id))}</span><kbd>${esc(keyLabel(control[`p${game.singlePlayer ? 1 : controlPlayer}`]))}</kbd></div>`).join('')}</div>${game.id === 're3' ? '<p class="menu-fine">Tank controls: forward follows Jill’s direction.</p>' : ''}<p class="menu-fine">Click the game to use your keyboard. For a gamepad, connect it and assign it in the emulator’s Controls menu. Saved mappings take priority.</p><details class="settings-details"><summary>Launcher shortcuts</summary><p>← → browse · Enter plays · F favorites · / searches · Esc opens Settings.<br>Gamepad: D-pad / stick browse · A plays · X favorites · Start opens Settings.</p></details>`;
    if (settingsTab === 'saves') panel = `<p>Save, load and export from the game’s toolbar. Saves stay in this browser; export a backup before clearing browser data.</p>${game.id === 'umk3' ? '<p class="menu-warning">UMK3 save states are unavailable.</p>' : ''}<a class="menu-link" href="${githubUrl}#readme" target="_blank" rel="noopener noreferrer">HOW IT WORKS ↗</a><a class="menu-link" href="${siteUrl('guides/browser.html')}" target="_blank" rel="noopener noreferrer">PICTURE & SOUND HELP ↗</a>${FEEDBACK_URL ? `<a class="menu-link" href="${esc(FEEDBACK_URL)}" target="_blank" rel="noopener noreferrer">REPORT A PROBLEM ↗</a>` : ''}<a class="menu-link" href="${siteUrl('software.html')}" target="_blank" rel="noopener noreferrer">LICENSES ↗</a>`;
    content.innerHTML = tabs + panel + (inSession() ? '<div class="settings-session-actions"><button type="button" class="menu-text-button" data-menu-action="back">← GAMES</button><button type="button" class="menu-text-button" data-menu-action="restart">↻ RESTART</button><button type="button" class="menu-text-button" data-menu-action="fullscreen">⛶ FULLSCREEN</button></div>' : '');
  }
}
function renderSearchResults() {
  const target = $('#search-results'); if (!target) return;
  const results = GAMES.filter(game => `${game.title} ${game.genre} ${game.platform}`.toLowerCase().includes(search.toLowerCase()));
  target.innerHTML = results.length ? results.map(game => `<button type="button" data-search-game="${game.id}"><img src="${esc(coverFor(game))}" alt="" width="40" height="46"><span>${esc(game.title)}<small>${esc(game.platform)} / ${esc(game.year)}</small></span><b>↗</b></button>`).join('') : '<p class="menu-fine">No games found. Try another title.</p>';
}

$('#enter-arcade').addEventListener('click', enterArcade);
$('#room-help').addEventListener('click', () => openMenu('settings'));
$('#leave-arcade').addEventListener('click', leaveArcade);
$('#open-menu').addEventListener('click', () => openMenu('settings'));
$('#open-search').addEventListener('click', () => openMenu('library'));
$('#selected-info').addEventListener('click', () => openMenu('game'));
$('#browse-controls').addEventListener('click', () => openMenu('settings'));
$('#launch-game').addEventListener('click', () => launch());
$('#toggle-favorite').addEventListener('click', toggleFavorite);
$('#previous-game').addEventListener('click', () => moveSelection(-1));
$('#next-game').addEventListener('click', () => moveSelection(1));
$('#clear-filters').addEventListener('click', () => { filter = 'all'; search = ''; renderLibrary(); });
$('#close-menu').addEventListener('click', () => closeMenu());
$('#menu-resume').addEventListener('click', () => closeMenu());
rail.addEventListener('click', event => { const tile = event.target.closest('[data-game]'); if (tile) selectGame(tile.dataset.game); });
rail.addEventListener('dblclick', event => { const tile = event.target.closest('[data-game]'); if (tile) { selectGame(tile.dataset.game); launch(); } });
rail.addEventListener('scroll', () => {
  clearTimeout(scrollTimer); scrollTimer = setTimeout(() => {
    if (!visibleGames.length || view !== 'browser') return;
    const middle = rail.scrollLeft + rail.clientWidth / 2;
    const nearest = [...rail.querySelectorAll('[data-game]')].sort((a, b) => Math.abs(a.offsetLeft + a.offsetWidth / 2 - middle) - Math.abs(b.offsetLeft + b.offsetWidth / 2 - middle))[0];
    if (nearest && nearest.dataset.game !== selectedId) selectGame(nearest.dataset.game, { center: false });
  }, 140);
}, { passive: true });
rail.addEventListener('wheel', event => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) { event.preventDefault(); rail.scrollBy({ left: event.deltaY, behavior: 'instant' }); } }, { passive: false });
document.querySelector('.screen-filters').addEventListener('click', event => { const button = event.target.closest('[data-filter]'); if (button) { filter = button.dataset.filter; search = ''; renderLibrary(); } });
menu.addEventListener('input', event => { if (event.target.id === 'search') { search = event.target.value; filter = 'all'; renderLibrary({ center: false }); renderSearchResults(); } });
menu.addEventListener('change', event => {
  if (event.target.id !== 'crt-effect') return;
  displaySettings = { crtEnabled: event.target.checked };
  document.body.dataset.crt = displaySettings.crtEnabled ? 'on' : 'off';
  cabinet.setCrtEnabled(displaySettings.crtEnabled);
  const persisted = saveDisplaySettings(displaySettings);
  displaySettingsStatus = persisted ? 'Saved.' : 'This visit only. Browser storage is unavailable.';
  $('#display-settings-status').textContent = displaySettingsStatus;
});
menu.addEventListener('click', event => {
  const tab = event.target.closest('[data-menu-tab]'); if (tab) { menuTab = tab.dataset.menuTab; renderMenu(); return; }
  const settings = event.target.closest('[data-settings-tab]'); if (settings) { settingsTab = settings.dataset.settingsTab; renderMenu(); menu.querySelector(`[data-settings-tab="${settingsTab}"]`)?.focus({ preventScroll: true }); return; }
  const player = event.target.closest('[data-control-player]'); if (player) { controlPlayer = Number(player.dataset.controlPlayer); renderMenu(); menu.querySelector(`[data-control-player="${controlPlayer}"]`)?.focus({ preventScroll: true }); return; }
  const result = event.target.closest('[data-search-game]'); if (result) { if (inSession()) { session.stop(); setView('browser'); } selectedId = result.dataset.searchGame; search = ''; filter = 'all'; renderLibrary(); closeMenu(); centerSelected(false); return; }
  const action = event.target.closest('[data-menu-action]')?.dataset.menuAction;
  if (action === 'controls') openMenu('controls');
  if (action === 'back') { closeMenu({ restore: false }); session.stop({ notify: true }); }
  if (action === 'restart') { closeMenu({ restore: false }); session.restart(); }
  if (action === 'fullscreen') { closeMenu({ restore: false }); session.fullscreen().then(() => session.focus()); }
  if (action === 'play') launch();
  if (action === 'simulation') launch('simulation');
  if (action === 'refresh') refreshLibrary();
  if (action === 'clear-search') { search = ''; renderLibrary(); renderMenu(); $('#search').focus(); }
});
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (isMenuOpen()) {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); }
    if (event.key === 'Tab') {
      const focusable = [...menu.querySelectorAll('button:not(:disabled), input, a[href], summary, [tabindex="0"]')].filter(el => !el.hidden && el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === menu)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    return;
  }
  if (view === 'attract' && event.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { event.preventDefault(); enterArcade(); return; }
  if (view !== 'browser' || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); moveSelection(event.key === 'ArrowLeft' ? -1 : 1, { focus: true }); }
  if (event.key === 'Enter' && (!event.target.closest('button, a') || event.target.closest('[data-game]'))) { event.preventDefault(); launch(); }
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFavorite(); }
  if (event.key === '/' || event.key === 'Escape') { event.preventDefault(); openMenu(event.key === '/' ? 'library' : 'settings'); }
  if (event.key === 'Home' && visibleGames.length) { event.preventDefault(); selectGame(visibleGames[0].id, { focus: true }); }
  if (event.key === 'End' && visibleGames.length) { event.preventDefault(); selectGame(visibleGames.at(-1).id, { focus: true }); }
});
function updatePadPolling() {
  clearInterval(gamepadTimer); gamepadTimer = null; padPrevious.clear();
  if (view !== 'browser' || !navigator.getGamepads) return;
  gamepadTimer = setInterval(() => {
    if (document.hidden || view !== 'browser') return;
    const pad = [...navigator.getGamepads()].find(Boolean); if (!pad) return;
    const down = new Set(); pad.buttons.forEach((b, i) => { if (b.pressed) down.add(i); });
    if (isMenuOpen()) {
      const items = [...menu.querySelectorAll('button:not(:disabled), input, a[href], summary')].filter(el => !el.hidden && el.getClientRects().length);
      const direction = down.has(12) || down.has(14) || pad.axes[1] < -.55 || pad.axes[0] < -.55 ? -1 : down.has(13) || down.has(15) || pad.axes[1] > .55 || pad.axes[0] > .55 ? 1 : 0;
      if (direction && items.length && performance.now() > padRepeat) { const current = items.indexOf(document.activeElement); items[(current + direction + items.length) % items.length].focus({ preventScroll: false }); padRepeat = performance.now() + 230; }
      if (down.has(0) && !padPrevious.has(0) && menu.contains(document.activeElement) && (document.activeElement.tagName !== 'INPUT' || ['checkbox', 'radio', 'button'].includes(document.activeElement.type))) document.activeElement.click();
      if (down.has(1) && !padPrevious.has(1)) closeMenu();
      padPrevious = down; return;
    }
    const horizontal = down.has(14) || pad.axes[0] < -.55 ? -1 : down.has(15) || pad.axes[0] > .55 ? 1 : 0;
    if (horizontal && performance.now() > padRepeat) { moveSelection(horizontal); padRepeat = performance.now() + 250; }
    if (down.has(0) && !padPrevious.has(0)) launch();
    if (down.has(2) && !padPrevious.has(2)) toggleFavorite();
    if (down.has(9) && !padPrevious.has(9)) openMenu('settings');
    padPrevious = down;
  }, 100);
}
window.addEventListener('pagehide', () => { clearInterval(gamepadTimer); clearTimeout(scrollTimer); clearTimeout(toastTimer); session.dispose(); cabinet.dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
window.addEventListener('resize', () => { if (view === 'browser') requestAnimationFrame(() => centerSelected(false)); });
renderLibrary(); refreshLibrary();
