import { GAMES, controlsForGame, escapeHTML as esc, loadLibrary, FEEDBACK_URL, IS_HOSTED, siteUrl } from './catalog.js';
const id = new URLSearchParams(location.search).get('id');
const game = GAMES.find(g => g.id === id);
const content = document.querySelector('#game-content');
let state, currentVariant = 'primary', sessionStarted = false, startupTimer;
const keyLabel = key => ({ 'up arrow': '↑', 'down arrow': '↓', 'left arrow': '←', 'right arrow': '→', enter: 'Enter', 'decimal point': 'Num .' }[key] || key.replace('numpad ', 'Num ').toUpperCase());
function controlLabel(control) {
  const platformLabels = id === 'umk3'
    ? { 0: 'Action B', 1: 'Action Y', 2: 'Insert coin', 8: 'Action A', 9: 'Action X', 10: 'Action L', 11: 'Action R' }
    : { 0: 'Cross ×', 1: 'Square □', 2: 'Select', 8: 'Circle ○', 9: 'Triangle △', 10: 'L1', 11: 'R1' };
  const racingLabels = (id === 'nfs' || id === 'gt2') ? { 0: 'Cross × / throttle, confirm', 1: 'Square □ / brake', 4: 'D-pad up / menu up', 5: 'D-pad down / menu down', 6: 'Left / steer left', 7: 'Right / steer right' } : {};
  return racingLabels[control.id] || platformLabels[control.id] || control.label;
}
function controls(player = 1) {
  const target = document.querySelector('#control-rows');
  if (!target) return;
  target.innerHTML = controlsForGame(id).map(c => `<tr><td>${esc(controlLabel(c))}</td><td><kbd>${keyLabel(c[`p${player}`])}</kbd></td></tr>`).join('');
  document.querySelector('#control-player').textContent = `Player ${player}`;
  document.querySelector('#control-hint').innerHTML = controlHint(player);
  document.querySelectorAll('[data-player]').forEach(b => { const active = Number(b.dataset.player) === player; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
}
function controlHint(player) {
  if (id === 'nfs' || id === 'gt2') return player === 1
    ? '<kbd>W</kbd> throttle / confirm · <kbd>S</kbd> brake · <kbd>A</kbd> / <kbd>D</kbd> steer.<br>Menus: <kbd>I</kbd> / <kbd>K</kbd> up / down; <kbd>A</kbd> / <kbd>D</kbd> left / right. <kbd>U</kbd> is Triangle (back in NFS).'
    : '↑ throttle / confirm · ↓ brake · ← / → steer.<br>Menus: <kbd>Num 8</kbd> / <kbd>Num 5</kbd> up / down. <kbd>Num 4</kbd> is Triangle. Enable Num Lock.';
  if (id === 're3') return '<kbd>W</kbd> / <kbd>S</kbd> forward / back · <kbd>A</kbd> / <kbd>D</kbd> turn.<br>The original tank controls follow Jill’s facing direction. <kbd>J</kbd> / <kbd>K</kbd> / <kbd>U</kbd> / <kbd>I</kbd> are Cross / Circle / Square / Triangle.';
  if (id !== 'umk3') return '<kbd>WASD</kbd> directional pad · <kbd>J</kbd> / <kbd>K</kbd> / <kbd>U</kbd> / <kbd>I</kbd> are Cross / Circle / Square / Triangle.<br><kbd>Q</kbd> / <kbd>E</kbd> are L1 / R1. <kbd>Enter</kbd> is Start; <kbd>5</kbd> is Select. Actions follow the game’s controller preset.';
  return player === 1
    ? '<kbd>WASD</kbd> move · <kbd>J</kbd> / <kbd>K</kbd> / <kbd>U</kbd> / <kbd>I</kbd> / <kbd>Q</kbd> / <kbd>E</kbd> actions.<br><kbd>5</kbd> insert coin · <kbd>Enter</kbd> start.'
    : 'Arrow keys move · numpad keys are the action buttons (enable Num Lock).<br>Top-row <kbd>6</kbd> inserts a coin · top-row <kbd>0</kbd> starts Player 2.';
}
function launchScreen() {
  const ready = state.ready;
  const alternate = id === 'gt2' && state.alternate;
  if (IS_HOSTED) return `<div class="launch-screen"><span class="launch-symbol" aria-hidden="true">${ready ? '◈' : '⌁'}</span><h2>${ready ? 'Ready for another round?' : 'Coming later.'}</h2><p>${esc(ready ? 'Launch the game, then click inside the player to use your keyboard. First downloads can take a few minutes.' : state.reason)}</p><div class="launch-actions">${ready ? '<button class="button primary" id="launch">Launch game <span>▶</span></button>' : `<a class="button secondary" href="${siteUrl('#library')}">Back to library ↗</a>`}${alternate?.ready ? '<button class="button secondary" id="launch-alternate">Try Simulation disc ↗</button>' : ''}</div>${alternate?.ready ? '<p class="launch-note">The main launch uses the European Arcade disc. The US Simulation disc has its own saves.</p>' : ''}<p class="launch-note">${ready ? `Runs on your device · ${Math.ceil((state.downloadBytes || 0) / 1000000)} MB game download · No installation` : 'This game is not part of the playable tester release.'}</p></div>`;
  return `<div class="launch-screen"><span class="launch-symbol" aria-hidden="true">${ready ? '◈' : game.experimental ? '⌁' : '↯'}</span><h2>${ready ? 'Ready for another round?' : game.experimental ? 'The next lap is experimental.' : 'Your classic needs a little setup.'}</h2><p>${esc(ready ? game.experimental ? 'A local PS2 Web Recomp build was found. This build still needs gameplay, sound, controller and performance testing.' : 'The local emulator and game files are in place. Launch the original game, then click inside the player to use your keyboard.' : state.reason)}</p><div class="launch-actions">${ready ? `<button class="button primary" id="launch">${game.experimental ? 'Try experimental build' : 'Launch game'} <span>▶</span></button>` : '<a class="button secondary" href="#game-setup">View setup instructions <span>↓</span></a>'}${alternate?.ready ? '<button class="button secondary" id="launch-alternate">Try Simulation disc ↗</button>' : ''}</div>${alternate ? `<p class="launch-note">Simulation disc detected${alternate.ready ? '' : ' · ' + esc(alternate.reason.replace(/\.$/, ''))}. ${state.ready ? 'The main launch uses the European Arcade disc.' : 'Arcade Mode requires its own disc.'}</p>` : ''}<p class="launch-note">${game.experimental ? 'Requires WebGPU and cross-origin isolation.' : 'Real emulation · Local files · No external application'}</p></div>`;
}
function requirementsList(requirements = []) {
  if (!requirements.length) return '';
  return `<ul class="requirements-list">${requirements.map(item => `<li class="${item.present ? 'present' : 'missing'}"><span aria-hidden="true">${item.present ? '✓' : '○'}</span>${esc(item.label)}<small>${item.present ? 'Installed' : 'Needed'}</small></li>`).join('')}</ul>`;
}
function playModeNote() {
  if (game.singlePlayer) return `<p>${esc(game.title)} is single player. Use Player 1 or one assigned gamepad.</p>`;
  if (game.experimental) return '<p>Your US GT4 disc must be compiled and tested separately. No gameplay or multiplayer support is claimed until that build works.</p>';
  return '<p>Local multiplayer uses two emulated controllers. Assign Player 1 and Player 2 in the emulator’s Controls menu, then enter the game’s own two-player mode.</p>';
}
function renderPreview() {
  document.title = `${game.title} — Tester preview`;
  document.querySelector('.local-indicator').innerHTML = '<i></i> TESTER PREVIEW';
  document.querySelector('nav a[href$="#setup"]').textContent = 'Tester guide';
  content.innerHTML = `<div class="game-heading"><div><p class="eyebrow">${esc(game.platform.toUpperCase())} / ${game.year} / ${esc(game.genre.toUpperCase())}</p><h1>${esc(game.title)}</h1><p>${esc(game.players)}</p></div><span class="status-badge experimental"><i></i>Interface preview</span></div><section class="preview-game info-box" aria-label="Game preview"><img src="${siteUrl(`assets/${game.cover}.svg`)}" alt="Original library illustration for ${esc(game.title)}" width="240" height="288"><div><p class="eyebrow">PUBLIC TESTER BUILD</p><h2>Explore the arcade.</h2><p>${esc(game.description)}</p><p>Game playback is available in the local build. This public preview includes the interface and control guide; it does not serve commercial game discs or firmware.</p><a class="button primary" href="${siteUrl('#library')}">Back to the library ↗</a><p><a href="${esc(FEEDBACK_URL)}" target="_blank" rel="noopener noreferrer">Report a problem or share an idea ↗</a></p></div></section><div class="player-details"><section class="detail-section"><h2>What to test here</h2><p>Check navigation, layout, text readability and keyboard focus on your device. Try the player tables to see how the planned controls are presented.</p><p>GT4 remains experimental in the local project. Game compatibility and multiplayer are tested separately from this interface preview.</p></section><aside><section class="detail-section"><h2>Know your controls</h2>${game.experimental ? '<p>Experimental PS2 build. Its controls depend on the locally compiled game.</p>' : '<p class="control-hint" id="control-hint"></p><div class="controls-tabs" role="group" aria-label="Keyboard controls"><button class="active" data-player="1" aria-pressed="true">Player 1</button><button data-player="2" aria-pressed="false">Player 2</button></div><table class="control-table"><thead><tr><th>Action</th><th id="control-player">Player 1</th></tr></thead><tbody id="control-rows"></tbody></table>'}</section></aside></div>`;
  controls();
  if (game.singlePlayer) document.querySelector('[data-player="2"]').hidden = true;
  document.querySelectorAll('[data-player]').forEach(button => button.addEventListener('click', () => controls(Number(button.dataset.player))));
}
function render() {
  document.title = `${game.title} — Retro Arcade`;
  content.innerHTML = `<div class="game-heading"><div><p class="eyebrow">${esc(game.platform.toUpperCase())} / ${game.year} / ${game.genre.toUpperCase()}</p><h1>${game.title}</h1><p>${game.engine} &nbsp; · &nbsp; ${game.players}</p></div><span class="status-badge ${game.experimental ? 'experimental' : state.ready ? 'ready' : ''}"><i></i>${game.experimental ? 'Experimental · Unverified' : state.ready ? 'Ready to launch' : 'Setup needed'}</span></div><section class="player-shell" aria-label="Game player"><div class="player-topbar"><span><i class="live-dot"></i> ORIGINAL GAME / LOCAL SESSION</span><button id="fullscreen">⛶ Fullscreen</button></div><div class="player-stage" id="player-stage">${launchScreen()}</div><div class="player-bottombar"><span id="player-status" role="status" aria-live="polite">${state.ready ? 'Waiting for launch' : 'Waiting for local setup'}</span><span id="session-tools">Keyboard + controller support</span></div></section><div id="player-message" class="inline-message" role="status"></div><div class="player-details"><div><section class="detail-section"><h2>${game.heading || (id === 'umk3' ? 'Back in the arena.' : id === 're3' ? 'One last escape.' : 'Back in the driver’s seat.')}</h2><p>${game.long}</p>${playModeNote()}</section><section class="detail-section" id="game-setup"><h2>Local setup</h2><div class="info-box"><p class="eyebrow">${state.ready ? 'FILES DETECTED' : 'WHAT THIS GAME NEEDS'}</p><code>${esc(game.filename)}</code>${requirementsList(state.requirements)}<p>${esc(state.ready ? 'The required local files are installed and will load automatically.' : game.missing)}</p>${game.experimental ? '<p>Full build steps: <a href="/guides/gt4.html">GT4 setup guide</a>. Use the upstream browser build, kept in your private directory.</p>' : id !== 'umk3' ? '<p>A verified retail PS1 BIOS is shared by these PCSX ReARMed games. Supported files: <code>scph1001.bin</code>, <code>scph5501.bin</code> or <code>scph5502.bin</code> in <code>private/bios/</code>. The checksum is checked; no firmware is downloaded.</p>' : '<p>From the project terminal: <code>npm run setup -- --source "C:\\Users\\Loren\\Downloads\\Retro Games"</code></p>'}<p><button class="text-button" id="recheck">Recheck files ↻</button></p></div></section><section class="detail-section"><h2>Saves & progress</h2><p>${id === 'umk3' ? 'Save states are unavailable for UMK3 in the installed MAME 2003 Plus build: its save operation returned a zero-size state in gameplay testing. The broken save/load buttons are hidden. Do not rely on persistent arcade progress.' : game.experimental ? 'PS2 Web Recomp stores its slot 1 memory card in browser storage. Use its Export card and Import card buttons to keep a .ps2 backup.' : 'Use the emulator’s bottom toolbar to save and load states, and its save menu to export game saves. Choose browser storage in Settings if you want local save states; download a backup before clearing browser data. Return to the same website address in the same browser profile.'}</p><p class="safety-note">Readiness checks verify files and dependencies. Actual game compatibility, audio, speed and two-player support must be checked in gameplay.</p></section></div><aside><section class="detail-section"><h2>Know your controls</h2>${game.experimental ? '' : '<p class="control-hint" id="control-hint"></p>'}${game.experimental ? '<p>Arrows: D-pad · I J K L: left stick<br>Z: Cross · X: Circle · A: Square · S: Triangle<br>Q / W / 1 / 2: shoulders<br>Enter: Start · Backspace: Select · F: fullscreen</p><p>Upstream gamepad support includes analog triggers. Two-player gameplay is unverified.</p>' : '<div class="controls-tabs" role="group" aria-label="Keyboard controls"><button class="active" data-player="1" aria-pressed="true">Player 1</button><button data-player="2" aria-pressed="false">Player 2</button></div><table class="control-table"><thead><tr><th>Action</th><th id="control-player">Player 1</th></tr></thead><tbody id="control-rows"></tbody></table><p>These are shared defaults for new visitors. Saved controls in this browser take precedence. In the emulator toolbar, open Controls → Reset to use this layout; game saves are kept. You can customize keys there too. Use the selected player table above. Configure connected gamepads in the emulator.</p>'}<p id="gamepad-status" class="gamepad-status">Connect a controller and press a button to detect it.</p></section></aside></div>`;
  controls();
  if (game.singlePlayer) document.querySelector('[data-player="2"]').hidden = true;
  document.querySelectorAll('[data-player]').forEach(button => button.addEventListener('click', () => controls(Number(button.dataset.player))));
  document.querySelector('#launch')?.addEventListener('click', () => launch());
  document.querySelector('#launch-alternate')?.addEventListener('click', () => launch('simulation'));
  document.querySelector('#fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector('#player-stage').requestFullscreen(); }
    catch { document.querySelector('#player-message').textContent = 'Fullscreen was not available. Try the fullscreen button inside the emulator.'; }
  });
  document.querySelector('#recheck')?.addEventListener('click', () => location.reload());
  if (IS_HOSTED) {
    document.querySelector('.local-indicator').innerHTML = '<i></i> PLAYABLE TEST';
    document.querySelector('nav a[href$="#setup"]').textContent = 'Tester guide';
    document.querySelector('#game-setup').remove();
    document.querySelector('.player-topbar > span').innerHTML = '<i class="live-dot"></i> ORIGINAL GAME / TESTER SESSION';
    const description = document.querySelector('.player-details .detail-section > p');
    description.textContent = game.experimental ? 'Gran Turismo 4 needs a separate browser build. It is not available in this tester release.' : game.long.replace(/The supplied /g, 'The ').replace(/Your supplied US PlayStation disc is installed locally\./, 'This is the US PlayStation release.').replace(/running locally/g, 'running in your browser');
    const report = document.createElement('p');
    report.innerHTML = `<a href="${esc(FEEDBACK_URL)}" target="_blank" rel="noopener noreferrer">Report a problem or share feedback ↗</a> · <a href="${siteUrl('software.html')}">Emulator licenses and source</a>`;
    description.after(report);
    if (!state.ready) {
      document.querySelector('.game-heading .status-badge').innerHTML = '<i></i>Coming later';
      document.querySelector('#player-status').textContent = 'Unavailable in this release';
    }
  }
  updateGamepads();
}
function launch(variant = 'primary') {
  if (sessionStarted) return;
  if (game.experimental && (!window.crossOriginIsolated || !navigator.gpu)) { document.querySelector('#player-message').textContent = 'This build needs WebGPU and cross-origin isolation. Open the arcade in Chrome or Edge at http://127.0.0.1:3000 with hardware acceleration available.'; return; }
  sessionStarted = true; currentVariant = variant;
  const frame = document.createElement('iframe');
  frame.title = `${game.title}${variant === 'simulation' ? ' — Simulation Mode' : ''}`;
  frame.allow = 'autoplay; fullscreen; gamepad'; frame.allowFullscreen = true;
  frame.src = game.experimental ? state.playerUrl : siteUrl(`frame.html?id=${id}${variant === 'simulation' ? '&variant=simulation' : ''}`);
  const exit = document.createElement('button');
  exit.className = 'fullscreen-exit'; exit.textContent = '⛶ Exit fullscreen';
  exit.addEventListener('click', async () => { try { await document.exitFullscreen(); } catch { document.querySelector('#player-message').textContent = 'Use Esc or the browser’s fullscreen control to exit.'; } });
  document.querySelector('#player-stage').replaceChildren(frame, exit);
  document.querySelector('#player-status').textContent = IS_HOSTED ? 'Downloading game data…' : 'Loading local runtime…';
  document.querySelector('#session-tools').innerHTML = '<button class="text-button" id="restart-session">Restart session ↻</button>';
  document.querySelector('#restart-session').addEventListener('click', () => { frame.remove(); location.reload(); });
  startupTimer = setTimeout(() => { document.querySelector('#player-message').textContent = IS_HOSTED ? 'First downloads can take several minutes. Keep this player open. If loading fails, restart the session and send feedback with the error shown.' : 'Still loading? Check the message inside the player. If it is blank, check the ROM set and local core files, then restart the session. First boots can take a minute.'; }, 90000);
  if (game.experimental) frame.addEventListener('load', () => { document.querySelector('#player-status').textContent = 'Experimental page loaded · gameplay unverified'; clearTimeout(startupTimer); });
}
window.addEventListener('message', event => {
  const frame = document.querySelector('iframe');
  if (event.origin !== location.origin || event.source !== frame?.contentWindow || event.data?.type !== 'retro-arcade-status') return;
  document.querySelector('#player-status').textContent = event.data.message;
  if (event.data.phase === 'started' || event.data.phase === 'error') { clearTimeout(startupTimer); document.querySelector('#player-message').textContent = event.data.phase === 'error' ? event.data.message : currentVariant === 'simulation' ? 'Simulation Mode uses its own saves. Choose the main launch for the Arcade disc and its two-player modes.' : ''; }
});
function updateGamepads() {
  const element = document.querySelector('#gamepad-status');
  if (!element) return;
  try { const pads = [...navigator.getGamepads()].filter(Boolean); element.textContent = pads.length ? `${pads.length} controller${pads.length > 1 ? 's' : ''} detected. Assign players in the emulator’s Controls menu.` : 'Connect a controller and press a button to detect it.'; } catch { element.textContent = 'Gamepad detection is unavailable in this browser.'; }
}
window.addEventListener('gamepadconnected', updateGamepads); window.addEventListener('gamepaddisconnected', updateGamepads);
setInterval(updateGamepads, 3000);
try {
  if (!game) throw new Error('That game is not in this library. Use Back to library to choose a classic.');
  const library = await loadLibrary(); state = library.games.find(g => g.id === id); if (!state) throw new Error('The library did not return this game.'); if (library.preview) renderPreview(); else render();
} catch (error) { content.innerHTML = `<div class="info-box"><h1>Could not open game</h1><p>${esc(error.message)}</p><a class="button secondary" href="${siteUrl('')}">Back to library</a></div>`; }
