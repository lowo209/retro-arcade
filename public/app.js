import { GAMES, escapeHTML as esc, loadLibrary, IS_PREVIEW, FEEDBACK_URL, siteUrl } from './catalog.js';

const grid = document.querySelector('#game-grid');
const feedback = document.querySelector('#library-feedback');
const favoriteStorageKey = 'retro-arcade-favorites-v1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const precisePointer = matchMedia('(hover: hover) and (pointer: fine)');
let library = null, filter = 'all';
let favorites = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(favoriteStorageKey) || '[]');
  if (Array.isArray(saved)) favorites = new Set(saved.filter(id => GAMES.some(g => g.id === id)));
} catch { /* The library also works without browser storage. */ }

function render(animate = true) {
  grid.classList.toggle('without-entry-motion', !animate);
  const search = document.querySelector('#search').value.trim().toLowerCase();
  const visible = GAMES.filter(game => {
    const state = library?.games.find(s => s.id === game.id);
    const matches = filter === 'all' || filter === game.platform
      || (filter === 'favorites' && favorites.has(game.id))
      || (filter === 'ready' && state?.ready && !game.experimental);
    return matches && `${game.title} ${game.genre} ${game.platform}`.toLowerCase().includes(search);
  });
  grid.innerHTML = visible.map((game, index) => {
    const state = library?.games.find(s => s.id === game.id);
    const ready = state?.ready, favorite = favorites.has(game.id);
    const cover = state?.coverUrl || siteUrl(`assets/${game.cover}.svg`);
    const action = IS_PREVIEW ? 'View game details' : ready ? 'Open player' : game.experimental ? 'Explore the project' : 'View setup';
    const badge = IS_PREVIEW ? 'Interface preview' : game.experimental ? 'Experimental' : ready ? 'Ready to launch' : library ? 'Setup needed' : 'Checking files';
    const gameUrl = siteUrl(`game.html?id=${game.id}`);
    return `
      <article class="game-card" data-game="${game.id}" style="--card-index:${index}">
        <div class="cover-shell">
          <a class="cover-link" href="${gameUrl}" aria-label="Open ${esc(game.title)}">
            <img class="cover-backdrop" src="${cover}" alt="" aria-hidden="true" width="600" height="720">
            <img class="game-cover" src="${cover}" alt="${state?.coverUrl ? 'Cover art' : 'Library artwork'} for ${esc(game.title)}" width="600" height="720">
            <span class="platform-badge">${game.platform === 'Arcade' ? '▦' : '▵'} ${game.platform}</span>
            <span class="cover-reveal" aria-hidden="true">
              <span class="reveal-label">${game.genre.toUpperCase()} / ${game.year}</span>
              <span class="reveal-action">${action}<span>${ready ? '▶' : '↗'}</span></span>
            </span>
            <span class="cover-arrow" aria-hidden="true">↗</span>
          </a>
          <button class="favorite-button ${favorite ? 'is-favorite' : ''}" data-favorite="${game.id}" aria-pressed="${favorite}" aria-label="${favorite ? 'Remove' : 'Add'} ${esc(game.title)} ${favorite ? 'from' : 'to'} favorites" title="${favorite ? 'Remove from favorites' : 'Add to favorites'}">${favorite ? '♥' : '♡'}</button>
        </div>
        <div class="game-card-content">
          <div class="game-meta"><span>${game.year} <i>·</i> ${game.genre}</span><span>${game.players}</span></div>
          <h3><a href="${gameUrl}">${game.title}</a></h3>
          <p>${game.description}</p>
          <div class="card-bottom">
            <span class="status-badge ${game.experimental ? 'experimental' : ready ? 'ready' : ''}"><i></i>${badge}</span>
            <a class="card-play ${ready ? 'available' : ''}" href="${gameUrl}">${IS_PREVIEW ? 'View' : ready ? 'Play' : game.experimental ? 'Explore' : 'Set up'} <span>${ready ? '▶' : '↗'}</span></a>
          </div>
        </div>
      </article>`;
  }).join('');
  const empty = document.querySelector('#empty-results');
  empty.hidden = visible.length > 0;
  empty.textContent = filter === 'favorites' && !search ? 'Your favorites live here. Tap a heart on any game to add it.' : 'No classics found. Try another title or filter.';
  document.querySelector('#favorites-count').textContent = favorites.size;
  attachCardMotion();
}

// Decorative pointer response; keyboard/touch navigation never depends on it.
function attachCardMotion() {
  for (const card of grid.querySelectorAll('.game-card')) {
    let bounds, pending = 0;
    card.addEventListener('pointerenter', () => { bounds = card.getBoundingClientRect(); });
    card.addEventListener('pointermove', event => {
      if (!precisePointer.matches || reducedMotion.matches || !bounds) return;
      cancelAnimationFrame(pending);
      const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
      pending = requestAnimationFrame(() => {
        card.style.setProperty('--pointer-x', `${x * 100}%`);
        card.style.setProperty('--pointer-y', `${y * 100}%`);
        card.style.setProperty('--tilt-x', `${(0.5 - y) * 3}deg`);
        card.style.setProperty('--tilt-y', `${(x - 0.5) * 3}deg`);
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(pending);
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  }
}

grid.addEventListener('click', event => {
  const button = event.target.closest('[data-favorite]');
  if (!button) return;
  const id = button.dataset.favorite;
  if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
  let persisted = true;
  try { localStorage.setItem(favoriteStorageKey, JSON.stringify([...favorites])); }
  catch { persisted = false; }
  const game = GAMES.find(g => g.id === id);
  feedback.textContent = `${game.title} ${favorites.has(id) ? 'added to' : 'removed from'} favorites.${persisted ? '' : ' Browser storage is unavailable; this change lasts for this visit.'}`;
  render(false);
  const replacement = grid.querySelector(`[data-favorite="${id}"]`);
  if (replacement) replacement.focus({ preventScroll: true });
  else document.querySelector('[data-filter="favorites"]').focus({ preventScroll: true });
});

async function refresh() {
  const status = document.querySelector('#library-status');
  status.textContent = IS_PREVIEW ? 'Loading the preview…' : 'Checking local files…';
  try {
    library = await loadLibrary();
    if (library.preview) { status.textContent = `Interface preview · ${GAMES.length} classics`; render(); return; }
    const ready = library.games.filter(g => g.ready && !g.experimental).length;
    status.textContent = `${ready} ready to launch · ${GAMES.length} classics`;
    const bios = document.querySelector('#bios-check');
    bios.textContent = library.bios ? `PS1 BIOS installed · ${library.biosName}` : 'PS1 BIOS needed · scph1001.bin, scph5501.bin or scph5502.bin';
    bios.classList.toggle('installed', library.bios);
    const byId = Object.fromEntries(library.games.map(game => [game.id, game]));
    const notes = {
      umk3: `Arcade rev 1.2 ROM set · ${byId.umk3.romUrl ? 'installed' : 'needed'}. No PlayStation BIOS is used.`,
      nfs: `PS1 BIN + matching CUE, or PBP · ${byId.nfs.romUrl ? 'disc installed' : 'disc needed'}. Uses the shared US PS1 BIOS.`,
      gt2: `European PAL Arcade Mode disc · ${byId.gt2.romUrl ? 'installed' : 'still needed for split-screen'}.${byId.gt2.alternate ? ' Simulation disc installed separately.' : ''}`,
      gt4: `${byId.gt4.discPresent ? 'ISO detected.' : 'Your PS2 ISO is needed.'} ${byId.gt4.ready ? 'Experimental browser build found.' : 'A local PS2 Web Recomp browser build is still needed.'}`,
      re3: `US PS1 BIN + CUE, or PBP · ${byId.re3.romUrl ? 'disc installed' : 'disc needed'}. Single player; uses the shared US PS1 BIOS.`,
      ...Object.fromEntries(['ac3', 'gits', 'gpolice2'].map(id => [id, `European PAL BIN + CUE, or PBP · ${byId[id].romUrl ? 'disc installed' : 'disc needed'}. Single player; uses the shared verified PS1 BIOS.`])),
    };
    for (const [id, text] of Object.entries(notes)) {
      const note = document.querySelector(`[data-file-note="${id}"]`);
      if (note) note.textContent = text;
    }
  } catch { status.textContent = 'Library check failed — is npm start running?'; }
  render();
}
if (IS_PREVIEW) {
  document.title = 'Retro Arcade — Tester preview';
  document.querySelector('.local-indicator').innerHTML = '<i></i> TESTER PREVIEW';
  document.querySelector('.hero-description').innerHTML = 'One library. Decades of great games.<br>Explore the cabinet and help shape the arcade.';
  document.querySelector('.hero-notes').innerHTML = '<span>◉ Interactive cabinet</span><span>⌁ Responsive library</span><span>↗ Interface preview</span>';
  document.querySelector('[data-filter="ready"]').remove();
  document.querySelector('.file-guide').remove();
  const notice = document.createElement('aside'); notice.className = 'preview-notice';
  notice.innerHTML = '<strong>TESTER PREVIEW</strong><span>Try the cabinet, search, filters and favorites. Game playback is available in the local build.</span>';
  document.querySelector('main').prepend(notice);
  document.querySelector('#setup').innerHTML = `<div class="setup-intro"><span class="small-icon">↗</span><div><p class="eyebrow muted">HELP SHAPE THE ARCADE</p><h2>Take a look.<br>Make it better.</h2><p>This release tests the interface. Original library illustrations stand in for private cover scans. Commercial game files and firmware are kept out of the public build.</p><a class="button secondary" href="${esc(FEEDBACK_URL)}" target="_blank" rel="noopener noreferrer">Send tester feedback ↗</a></div></div><div class="setup-steps"><article><span>01</span><div><h3>Try the cabinet</h3><p>Press START, move the joystick, press the buttons and open the library from the CRT.</p></div></article><article><span>02</span><div><h3>Explore the collection</h3><p>Search, filter by platform, save favorites and check the game pages on your phone or computer.</p></div></article><article><span>03</span><div><h3>Tell us what you find</h3><p>Include the page, your browser, your device and what you expected. Screenshots help. Game playback is outside this preview.</p></div></article></div>`;
  document.querySelectorAll('a[href$="#setup"]').forEach(link => link.textContent = 'Tester guide');
  document.querySelector('#about-dialog').innerHTML = '<button class="dialog-close" aria-label="Close about dialog">×</button><p class="eyebrow">EARLY ACCESS / INTERFACE PREVIEW</p><h2>Help build your next arcade.</h2><p>Test the interactive cabinet, library, favorites, search, responsive layout and game-detail pages. Game playback is available in the separate local build.</p><p>This public preview contains original library illustrations and website code. It includes no commercial game discs, firmware or private cover scans. Game and platform names belong to their respective owners. The project is independent of the publishers.</p><p>Favorites are kept in this browser. There is no account, analytics or automatic feedback upload.</p>';
}
document.querySelector('#search').addEventListener('input', () => render());
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => {
    const active = b === button; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active);
  });
  render();
}));
document.querySelector('#refresh-library')?.addEventListener('click', refresh);
document.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
    event.preventDefault(); document.querySelector('#search').focus();
  }
});
const dialog = document.querySelector('#about-dialog');
document.querySelector('#about-button').addEventListener('click', () => dialog.showModal());
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
document.querySelectorAll('[data-game-count]').forEach(element => element.textContent = element.dataset.gameCount === 'padded' ? String(GAMES.length).padStart(2, '0') : GAMES.length);
render();
refresh();

// The library stays usable if WebGL or the optional 3D module is unavailable.
import('./arcade-cabinet.js').then(({ mountCabinet }) => mountCabinet(document.querySelector('#arcade-cabinet'))).catch(() => {});
