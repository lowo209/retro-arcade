import { GAMES, siteUrl } from './catalog.js';

// Keep previously shared tester links working inside the cabinet.
const id = new URLSearchParams(location.search).get('id');
const game = GAMES.find(item => item.id === id);
location.replace(siteUrl(game ? `?game=${encodeURIComponent(game.id)}` : ''));
