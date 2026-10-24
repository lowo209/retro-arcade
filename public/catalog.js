import { IS_PREVIEW, HOSTED_LIBRARY_URL, EMULATOR_DATA_URL } from './deployment.js';
export { IS_PREVIEW, FEEDBACK_URL } from './deployment.js';
export const IS_HOSTED = !!HOSTED_LIBRARY_URL;

// Resolve from this module so both the local root and /repository/ Pages URLs work.
export const siteUrl = (path, moduleUrl = import.meta.url) => {
  const url = new URL(path.replace(/^\/+/, ''), new URL('./', moduleUrl));
  return url.pathname + url.search + url.hash;
};
export const runtimeUrl = path => EMULATOR_DATA_URL
  ? new URL(path, EMULATOR_DATA_URL).href
  : siteUrl(`vendor/emulatorjs/data/${path}`);

export const GAMES = [
  { id: 'umk3', title: 'Ultimate Mortal Kombat 3', short: 'UMK3', platform: 'Arcade', year: '1995', genre: 'Fighting', players: '1–2 players', cover: 'umk3', description: 'Finish what you started. The ultimate showdown from the golden age of the arcade.', long: 'The original Midway arcade game, running locally through EmulatorJS and MAME 2003 Plus. Insert a coin, choose your fighter, and take on the CPU or a friend.', engine: 'EmulatorJS · MAME 2003 Plus', missing: 'Add a complete UMK3 rev 1.2 set compatible with MAME 2003 Plus. Run the supplied setup script to package the loose files by checksum.', filename: 'private/roms/umk3/umk3.zip' },
  { id: 'nfs', title: 'Need for Speed: High Stakes', short: 'HIGH STAKES', platform: 'PlayStation', year: '1999', genre: 'Racing', players: '1–2 players', cover: 'nfs', description: 'Exotic cars. Open roads. A little trouble in the rear-view mirror.', long: 'The original PlayStation release, with CPU races, police pursuits and local split-screen. Your supplied US PlayStation disc is installed locally. The PC edition is kept separate.', engine: 'EmulatorJS · PCSX ReARMed', missing: 'Supply the PlayStation edition as PBP or a ZIP containing the CUE and all referenced BIN tracks. Add the supported US PS1 BIOS too.', filename: 'private/roms/nfs/high-stakes.zip (or .pbp)' },
  { id: 'gt2', title: 'Gran Turismo 2', short: 'GRAN TURISMO 2', platform: 'PlayStation', year: '1999', genre: 'Racing', players: '1–2 players', cover: 'gt2', description: 'The real driving simulator. Find your line, then chase the perfect lap.', long: 'The supplied European PAL Arcade Mode disc provides the original arcade racing and two-player split-screen modes. The US Simulation disc remains a separate launch option with its own saves; the two discs are different editions.', engine: 'EmulatorJS · PCSX ReARMed', missing: 'Add the Arcade Mode disc as PBP or a ZIP of CUE + BIN tracks, plus a supported verified PS1 BIOS. The Simulation disc is a different disc.', filename: 'private/roms/gt2/gt2-arcade.zip (or .pbp)' },
  { id: 'gt4', title: 'Gran Turismo 4', short: 'GRAN TURISMO 4', platform: 'PlayStation 2', year: '2004', genre: 'Racing', players: 'Multiplayer unverified', cover: 'gt4', experimental: true, description: 'A new frontier for a driving icon. Browser recompilation, in the making.', long: 'PS2 Web Recomp translates the disc executable to WebAssembly and draws with WebGPU. A disc image is only the starting point: your exact edition must be built locally first.', engine: 'PS2 Web Recomp · WebAssembly / WebGPU', missing: 'The local build is not installed. This machine has no WSL environment. Follow docs/GT4.md to build your supplied US disc with the upstream Linux tools; the demonstrated upstream GT4 release is PAL.', filename: 'private/gt4/web/ps2web.html + related build files' },
  { id: 're3', title: 'Resident Evil 3: Nemesis', short: 'RESIDENT EVIL 3', platform: 'PlayStation', year: '1999', genre: 'Survival horror', players: '1 player', singlePlayer: true, cover: 're3', description: 'One last escape from Raccoon City. Every street could be your last.', long: 'The original US PlayStation release of Resident Evil 3: Nemesis, played through EmulatorJS and PCSX ReARMed. This is a single-player game with fixed camera angles, survival controls and its original save system.', engine: 'EmulatorJS · PCSX ReARMed', missing: 'Add the US PS1 disc as a ZIP containing its CUE and every referenced BIN track, or as PBP. It uses the shared verified PS1 BIOS.', filename: 'private/roms/re3/re3-nemesis.zip (or .pbp)' },
  { id: 'ac3', title: 'Ace Combat 3: Electrosphere', short: 'ACE COMBAT 3', platform: 'PlayStation', year: '2000', genre: 'Flight combat', players: '1 player', singlePlayer: true, heading: 'Take to the skies.', cover: 'cover-fallback', description: 'Supersonic dogfights on the edge of tomorrow. Lock on and break away.', long: 'The original European PAL PlayStation release of Ace Combat 3: Electrosphere. This is the single-disc international edition, with its own campaign; it is distinct from the two-disc Japanese release. The supplied disc includes English, French, German, Spanish and Italian.', engine: 'EmulatorJS · PCSX ReARMed', missing: 'Add the European disc as CUE + BIN ZIP or PBP and a supported verified retail PS1 BIOS.', filename: 'private/roms/ac3/electrosphere.zip (or .pbp)' },
  { id: 'gits', title: 'Ghost in the Shell', short: 'GHOST IN THE SHELL', platform: 'PlayStation', year: '1997', genre: 'Action', players: '1 player', singlePlayer: true, heading: 'Welcome to Section 9.', cover: 'cover-fallback', description: 'Take the Fuchikoma into the city. Walls are just another way forward.', long: 'The original European PAL Ghost in the Shell for PlayStation. Pilot the Fuchikoma through its single-player campaign with the original 3D action and animated sequences, running through the existing PS1 emulator.', engine: 'EmulatorJS · PCSX ReARMed', missing: 'Add the European disc as CUE + BIN ZIP or PBP and a supported verified retail PS1 BIOS.', filename: 'private/roms/gits/ghost-in-the-shell.zip (or .pbp)' },
  { id: 'gpolice2', title: 'G-Police: Weapons of Justice', short: 'G-POLICE 2', platform: 'PlayStation', year: '1999', genre: 'Vehicle combat', players: '1 player', singlePlayer: true, heading: 'Back on patrol.', cover: 'cover-fallback', description: 'Patrol the skies and streets of a restless colony. Bring the firepower.', long: 'The supplied European PAL PlayStation release of G-Police: Weapons of Justice, the sequel to G-Police. Its original single-player missions put you in futuristic air and ground vehicles. Controls follow the game’s selected controller preset.', engine: 'EmulatorJS · PCSX ReARMed', missing: 'Add the European disc as CUE + BIN ZIP or PBP and a supported verified retail PS1 BIOS.', filename: 'private/roms/gpolice2/weapons-of-justice.zip (or .pbp)' },
];
export const CONTROLS = [
  { id: 0, label: 'B / Cross · Arcade button', p1: 'j', p2: 'numpad 1', pad: 'BUTTON_2' },
  { id: 1, label: 'Y / Square · Arcade button', p1: 'u', p2: 'numpad 4', pad: 'BUTTON_4' },
  { id: 2, label: 'Select / Insert coin', p1: '5', p2: '6', pad: 'SELECT' },
  { id: 3, label: 'Start', p1: 'enter', p2: '0', pad: 'START' },
  { id: 4, label: 'Up', p1: 'w', p2: 'up arrow', pad: 'DPAD_UP' },
  { id: 5, label: 'Down', p1: 's', p2: 'down arrow', pad: 'DPAD_DOWN' },
  { id: 6, label: 'Left', p1: 'a', p2: 'left arrow', pad: 'DPAD_LEFT' },
  { id: 7, label: 'Right', p1: 'd', p2: 'right arrow', pad: 'DPAD_RIGHT' },
  { id: 8, label: 'A / Circle · Arcade button', p1: 'k', p2: 'numpad 2', pad: 'BUTTON_1' },
  { id: 9, label: 'X / Triangle · Arcade button', p1: 'i', p2: 'numpad 5', pad: 'BUTTON_3' },
  { id: 10, label: 'L1 · Arcade button', p1: 'q', p2: 'numpad 7', pad: 'LEFT_TOP_SHOULDER' },
  { id: 11, label: 'R1 · Arcade button', p1: 'e', p2: 'numpad 9', pad: 'RIGHT_TOP_SHOULDER' },
  { id: 12, label: 'L2', p1: 'r', p2: 'numpad 0', pad: 'LEFT_BOTTOM_SHOULDER' },
  { id: 13, label: 'R2', p1: 'f', p2: 'decimal point', pad: 'RIGHT_BOTTOM_SHOULDER' },
];

// Only the keyboard changes. Keep upstream RetroPad IDs and gamepad labels.
// Racing needs a separate profile: the original PS1 games use face buttons
// for pedals, so binding W to D-pad up alone would not accelerate a car.
export function controlsForGame(id) {
  const racing = id === 'nfs' || id === 'gt2';
  const overrides = racing ? {
    0: { p1: 'w', p2: 'up arrow' },
    1: { p1: 's', p2: 'down arrow' },
    4: { p1: 'i', p2: 'numpad 8' },
    5: { p1: 'k', p2: 'numpad 5' },
    8: { p1: 'j', p2: 'numpad 2' },
    9: { p1: 'u', p2: 'numpad 4' },
  } : {};
  return CONTROLS.map(control => ({ ...control, ...overrides[control.id] }));
}

export function defaultControls(id) {
  const analog = { 14: 'LEFT_STICK', 15: 'RIGHT_STICK', 16: 'LEFT_STICK_X:+1', 17: 'LEFT_STICK_X:-1', 18: 'LEFT_STICK_Y:+1', 19: 'LEFT_STICK_Y:-1', 20: 'RIGHT_STICK_X:+1', 21: 'RIGHT_STICK_X:-1', 22: 'RIGHT_STICK_Y:+1', 23: 'RIGHT_STICK_Y:-1' };
  return Object.fromEntries([0, 1, 2, 3].map(player => [player, {
    ...Object.fromEntries(controlsForGame(id).map(c => [c.id, { value: player < 2 ? c[`p${player + 1}`] : '', value2: c.pad }])),
    ...Object.fromEntries(Object.entries(analog).map(([index, pad]) => [index, { value: '', value2: pad }])),
  }]));
}
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export async function loadLibrary() {
  if (IS_PREVIEW) return {
    preview: true, runtime: false, bios: false, biosName: null,
    games: GAMES.map(game => ({ id: game.id, ready: false, experimental: !!game.experimental,
      requirements: [], romUrl: null, biosUrl: null,
      reason: 'This public interface preview does not include game playback.' })),
  };
  const response = await fetch(siteUrl(HOSTED_LIBRARY_URL || 'api/library'), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(IS_HOSTED ? 'The tester library is temporarily unavailable. Please retry.' : 'The local server could not check your files.');
  return response.json();
}
