# Retro Arcade

**Tester release:** the GitHub Pages build is an interface preview with the 3D cabinet, collection, search, filters, favorites and control guides. Game playback remains in the local build. See [TESTER-RELEASE.md](docs/TESTER-RELEASE.md) for preview/build/deployment steps.

[Open the public tester preview](https://lowo209.github.io/retro-arcade/) · [Send tester feedback](https://github.com/lowo209/retro-arcade/issues/new?template=tester-feedback.yml)

If every game fails with a WebGL/GLctx error in Firefox, see the local [browser graphics guide](public/guides/browser.html). The player now checks graphics availability before loading a disc and reports caught emulator startup errors.

A private browser arcade with a charcoal and orange library, an interactive 3D hero cabinet, your supplied local covers, hover/focus card effects, favorites, search and filters, individual game pages, fullscreen, two keyboard layouts, gamepad detection, emulator controls and saves. Built with HTML, CSS, JavaScript, locally bundled Three.js and a small Node.js server. No framework, package installation, build step, CDN or native game launcher is required to run the installed site.

For the requested **public, link-only site with no visitor installations**, see [PUBLIC-ARCADE.md](docs/PUBLIC-ARCADE.md). The current playable arcade is local; no private game data has been deployed publicly.

The hero controls and implementation are described in [CABINET.md](docs/CABINET.md). [CONTROLS.md](docs/CONTROLS.md) lists shared WASD profiles and how to reset older bindings. For GT4's developer tools, start with [BUILD-ENVIRONMENT.md](docs/BUILD-ENVIRONMENT.md).

## Start on Windows 11

1. Open this folder in VS Code (**File → Open Folder**).
2. Open **Terminal → New Terminal**. Node.js 20+ and Python 3 are needed. Both are already available on the development computer. A fresh computer can use [Node.js](https://nodejs.org/) and [Python](https://www.python.org/downloads/windows/).
3. Install the supplied local files once:

   ```powershell
   npm run setup -- --source "C:\Users\Loren\Downloads\Retro Games"
   ```

   The default source is your `Downloads\Retro Games` folder, so `npm run setup` also works. If PowerShell blocks `npm.ps1`, use **npm.cmd** in place of **npm**. No `npm install` is necessary.
4. Start the local server:

   ```powershell
   npm start
   ```

5. Open **http://127.0.0.1:3000** in Chrome. Choose a game and click **Launch game**. If Chrome asks for a second interaction to unlock audio, click inside the emulator or its Start button. Keep the terminal open. **Ctrl+C** stops the server.

Use that exact address and port every time so browser saves stay in the same storage. Do not double-click `index.html`, use `file://`, or replace this server with VS Code Live Server: the local API, private mounts, WebAssembly MIME types, HTTP Range requests and cross-origin isolation are supplied by `server.mjs`. Once the files are installed, Internet access is unnecessary; the local server still needs to be running.

## Current game status

Readiness in the interface is computed from the local files on every visit. It is **not** a claim that all game features have been tested. See [the verification log](docs/VERIFICATION.md) for actual results.

| Game | Integration | Supplied files and remaining requirements |
| --- | --- | --- |
| Ultimate Mortal Kombat 3 rev 1.2 | EmulatorJS 4.2.3 + `mame2003_plus` | All 26 supplied ROM parts match the MAME driver CRCs. Setup creates the ZIP with the names that core expects; it does not patch game bytes. |
| Need for Speed: High Stakes | EmulatorJS + `pcsx_rearmed` | Supplied PS1 US BIN/CUE (`SLUS_008.26`) and SCPH1001 BIOS installed. A real six-car race, keyboard acceleration/steering, and browser save/load states are verified. Audio, physical controllers, pursuits and split-screen remain unverified. Windows files cannot be used in this PS1 core. |
| Gran Turismo 2 | EmulatorJS + `pcsx_rearmed` | European PAL Arcade Mode disc is now installed (`SCES_023.80`). The existing US Simulation disc remains separate, with its save ID preserved. See the verification log for current gameplay checks. |
| Resident Evil 3: Nemesis | EmulatorJS + `pcsx_rearmed` | Supplied US PS1 BIN/CUE (`SLUS_009.23`) installed with the existing verified BIOS. Title menus, Easy Mode startup, the first in-game scene and short WASD input checks are verified. Single player; sustained play, saves and audio remain unverified. |
| Gran Turismo 4 | Experimental PS2 Web Recomp browser-build mount | Supplied **US ISO** referenced in ignored local config. No compiled browser build. WSL, CMake, Ninja and clang were not available. Upstream demonstrated PAL GT4; the US ISO needs its own build. See [GT4 steps](docs/GT4.md). |

We never fetch ROMs, BIOS files, game-derived C++ or WebAssembly, cracks or game executables. Source setup does not search download sites or launch the supplied PC game.

The new European **Ace Combat 3: Electrosphere**, **Ghost in the Shell** and **G-Police: Weapons of Justice** discs are installed, with original PAL front covers and single-player pages. RE3 remains the existing US installation. There are now 8 library entries; GT4 is still experimental. Cover provenance is in [COVERS.md](docs/COVERS.md).

## Add or replace your files

All game files go under ignored `private/`. The server does not provide uploads or a per-session ROM picker. Copy files once, then click **Recheck local files** or reload the library.

```text
private/
  bios/scph1001.bin          # or supported scph5501.bin
  roms/
    umk3/umk3.zip
    nfs/high-stakes.zip       # CUE + BIN tracks, or high-stakes.pbp
    gt2/gt2-arcade.zip        # CUE + BIN tracks, or gt2-arcade.pbp
    gt2/gt2-simulation.zip    # optional US Simulation disc
    ac3/electrosphere.zip
    gits/ghost-in-the-shell.zip
    gpolice2/weapons-of-justice.zip
    re3/re3-nemesis.zip       # CUE + BIN tracks, or re3-nemesis.pbp
  gt4/web/                   # YOUR generated browser build, not in Git
  local.json                # private GT4 disc / build paths
vendor/emulatorjs/           # locally installed upstream runtime, not in Git
```

For a `.bin` + `.cue` PS1 dump, ZIP the CUE and **every track it references**, at the archive root, preserving track filenames. Do not rename just the BIN; the CUE contains those filenames. Name the ZIP as above. The setup script recognizes GT2 Arcade/Simulation, High Stakes/Road Challenge, RE3, Ace Combat 3, Ghost in the Shell and G-Police: Weapons of Justice CUE filenames. Explicit `--game` imports are listed in docs/FILES.md. PBP files can be copied manually to the paths above. The configured PCSX ReARMed core uses the shared verified retail BIOS for these US/PAL discs; region-specific requirements of other cores differ. The actual supplied 4.2.3 PCSX core metadata does not advertise CHD; this integration therefore requires CUE + BIN ZIP or PBP and does not mark a CHD alone as ready. CUE loading is explicitly enabled to preserve track layout and CD audio.

This integration accepts the US `scph1001.bin` (MD5 **924e392ed05558ffdb115408c263dccf**) or `scph5501.bin` (MD5 **490f666e1afb15b7362b406ed1cea246**), both 524,288 bytes. Your supplied SCPH1001 is verified and installed. Files are kept under their correct BIOS names; do not rename one revision to another. The app selects a verified dump automatically. Other regions need deliberate configuration and testing.

See [FILES.md](docs/FILES.md) for the exact files still needed and one-disc import commands. The same BIOS serves NFS, GT2 and Resident Evil 3.

Your supplied PNG covers and the three sourced PAL JPEG covers live in ignored `private/covers/` and are automatically mounted at the allowlisted cover URLs. The original SVGs remain the source-only fallbacks. Favorites stay in this browser's local storage. Cards have pointer tilt, a moving glow, cover zoom, an action reveal and equivalent keyboard-focus feedback; reduced-motion preferences disable the movement.

## Controls and two players

Click inside the running player first. Player 1 uses **WASD** for directions in UMK3/RE3 and **J K U I Q E** for actions, **Enter** for Start and **5** for coin/Select. Racing uses **W/S** throttle/brake, **A/D** steering and **I/K** menu up/down; W confirms. Player 2 has a separate arrow/numpad profile. See both on-page tables and [CONTROLS.md](docs/CONTROLS.md). RE3 is single player and retains its original tank controls. Saved browser mappings take precedence; **Controls → Reset** adopts the new defaults without clearing game saves.

Connect USB/Bluetooth gamepads before launch and press a button on each so Chrome detects them. The emulator's **Controls** menu assigns Player 1/2 devices and button mappings. Enter the game's own two-player mode: start Player 2 in UMK3, or choose split-screen in the PS1 game's Arcade/race menus. Physical controller behavior and full two-player play are not assumed just because controllers are detected. GT4 uses upstream's own input handling; see its guide.

Use the page's **Fullscreen** button or the emulator's fullscreen control. Esc leaves fullscreen. **Restart session** returns to the launch screen and unloads the iframe. Normal navigation also destroys the emulator iframe so games do not run behind the library.

## Saves

**UMK3 limitation:** the installed MAME 2003 Plus build returned a zero-size state during a real fight and its metadata reports no save-file support. Save/load state buttons are hidden for UMK3. Do not expect persistent UMK3 progress with this build.

EmulatorJS exposes its own save-state, load-state, save-file export/import and settings controls. The integration defaults save-state storage to **browser**. Use that toolbar to save, then load the same slot; export backups using the emulator menu. These core-dependent features need game-level verification. Do not assume progress was saved merely because the game page loaded.

Browser saves are tied to the browser profile, address and port. Private browsing, clearing site data or changing `127.0.0.1` to `localhost` can remove or separate them. Download backups before clearing data. GT4's own build stores a PS2 memory card and offers **Export card / Import card**. Saves never go to a cloud service.

## Troubleshooting

- **Setup needed:** the game page names the missing file. `npm run check` also prints the local status. Refresh after copying new files.
- **UMK3 reports missing ROMs:** use the complete rev 1.2 set matching MAME 2003 Plus. Setup matches each part by CRC and correct size and packages known aliases under core-compatible names. It does not download missing parts. Do not extract the final `umk3.zip` before launch.
- **Blank player / core error:** confirm `vendor/emulatorjs/data/loader.js` and the selected core files exist; rerun setup from an official **4.2.3** release. The supplied folder is already that version. CSP intentionally disallows external CDN fallbacks. F12 → Console contains the underlying emulator error.
- **Sound is silent:** interact with the player, unmute Chrome/site audio and check the emulator volume. Physical audio output must still be checked by the user.
- **Keyboard does nothing:** click the game canvas and consult the emulator Controls menu. Saved mappings override the supplied defaults.
- **Slow emulation:** close other heavy tabs and use the default core settings first. GT4 needs WebGPU and hardware acceleration for useful 3D performance; do not expect its software fallback to race at full speed.
- **Port busy:** close the previous server. Or, in PowerShell, `$env:PORT=3001` followed by `npm start`; this uses a separate browser-save origin.
- **Wrong game edition:** the NFS Windows build, GT2 Simulation disc, and GT2 Arcade disc are not interchangeable. Rename nothing to disguise an incompatible edition.

## Project layout and checks

`public/` contains the website and original SVG fallbacks. User-supplied covers are kept in `private/covers/`. `server.mjs` serves only public assets, selected emulator files and explicit private game mounts. `scripts/setup.py` performs local installation; `tests/server.test.mjs` checks the server's private-file boundaries, readiness and byte-range behavior.

```powershell
npm test
npm run check
npm run export-source
```

The export command creates a source-only folder under ignored `exports/` using a fixed allowlist. It refuses symlinks and game/binary extensions. Review that folder before publishing source. No repository has been committed, pushed or published by setup. `.gitignore` excludes private games, BIOS, vendor dependencies, saves and generated artifacts, with extension rules as an extra safeguard. Do not force-add those files. Before any GitHub push, run `npm run check` and inspect `git status --short` / staged filenames.

The local server binds only to **127.0.0.1**, rejects foreign Host headers, and uses no telemetry or third-party network assets. Keep it local; do not expose game mounts to the Internet or publish a built private directory.

## Documentation and licenses

Implementation references: [EmulatorJS embedding](https://emulatorjs.org/docs/how-to-embed/), [options](https://emulatorjs.org/docs/options/), [control mapping](https://emulatorjs.org/docs4devs/control-mapping/), [PlayStation](https://emulatorjs.org/docs/systems/playstation/), [MAME 2003 Plus UMK3 driver](https://github.com/libretro/mame2003-plus-libretro/blob/master/src/drivers/midwunit.c), and [PS2 Web Recomp](https://github.com/snuri00/ps2-web-recomp). Research checked 23 October 2026; the integration uses the actual supplied 4.2.3 loader/source API rather than assuming every current option exists in that release.

Website code and original illustrations: MIT. Emulator dependencies retain their own licenses and are not part of that grant. See [THIRD_PARTY.md](THIRD_PARTY.md).
