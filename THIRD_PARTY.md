# Third-party software and notices

## R2 tester release preparation

The operator authorized distribution of the selected game files, firmware and
cover artwork for testing. These assets remain excluded from Git and source
exports. The separate R2 release plan includes the installed emulator runtime,
unminified modified frontend sources, original licenses, extracted core notices,
and upstream source archives with version/commit provenance. The hosted website
links to those notices and source downloads. This preparation does not change
ownership or licensing of games, firmware, artwork or third-party software.
See [R2-HOSTING.md](docs/R2-HOSTING.md) for the selected deployment procedure.

## EmulatorJS 4.2.3

[Official repository](https://github.com/EmulatorJS/EmulatorJS), [4.2.3 release](https://github.com/EmulatorJS/EmulatorJS/releases/tag/v4.2.3), [license](https://github.com/EmulatorJS/EmulatorJS/blob/v4.2.3/LICENSE).

The local installer copies the user-supplied official distribution to ignored `vendor/emulatorjs/`, retaining its GPL-3.0 license, README and unminified JavaScript sources. It applies one reproducible offline patch: replaces the optional `this.checkForUpdates()` invocation with `void 0` in both installed `src/emulator.js` and `emulator.min.js`. Version 4.2.3 otherwise tries a CDN update check on localhost and leaves a rejected fetch when offline. The patch does not alter emulation. Its implementation is in `scripts/setup.py`. This source repository does not redistribute those runtime binaries. The runtime is a separate iframe integration using documented globals and its own UI.

Only MAME 2003 Plus and PCSX ReARMed core packages are installed. Their license notices are retained in the upstream `.data` core archives (`license.txt`, `core.json`, `build.json`) and reports. Cores and bundled third-party libraries have their own licenses; GPL-3.0 on the EmulatorJS frontend does not relicense those components. MAME 2003 Plus includes historical MAME licensing restrictions. Review every upstream component and provide corresponding sources/notices as required before redistributing any bundled binary package. The default source export excludes all vendor files.

- [MAME 2003 Plus](https://github.com/libretro/mame2003-plus-libretro), including the `midwunit.c` UMK3 ROM metadata used by the setup script.
- [PCSX ReARMed](https://github.com/libretro/pcsx_rearmed).
- Other libraries inside the supplied EmulatorJS distribution retain their original notices and licenses.

The website source's MIT license does not grant rights to games, firmware, emulator dependencies or third-party trademarks.

## PS2 Web Recomp

[Official repository](https://github.com/snuri00/ps2-web-recomp), [MIT license](https://github.com/snuri00/ps2-web-recomp/blob/main/LICENSE). The upstream project additionally retains a BSD 2-clause notice for MPEG tables adapted from Play!. Its source and generated artifacts are not bundled with this repository. Follow upstream notices if locally building it. Generated game C++ and WebAssembly are translations of copyrighted game code and must remain private.

## Artwork and names

The procedural 3D hero and static SVG cabinet fallback were created for this website. They replace the original CSS cabinet.

The SVG cover illustrations were created for this site, with no downloaded box art, screenshots, fonts or remote image dependencies. They are illustrative library artwork, not actual game screenshots. Game titles, platform names and trademarks belong to their respective owners. This project has no affiliation with the publishers or emulator projects.


## User-supplied cover images

The five supplied PNG images are copied unchanged to ignored `private/covers/` for the local arcade only. They are excluded from Git and source exports and are not licensed by the project MIT license. They are user-supplied artwork, not a claim that each image is an official cover for the configured platform. The source-only site retains its original SVG fallbacks.

## Three.js 0.180.0

The hero uses the two minified ES modules from pinned npm package `three@0.180.0`, served locally in `public/lib/three/`. Its MIT notice is retained alongside them as `LICENSE`. Package tarball SHA-1: `b930cabfb524f6d36bf63e874b4d866888b50487`. [Official source/license](https://github.com/mrdoob/three.js/tree/r180), [renderer](https://threejs.org/docs/pages/WebGLRenderer.html), [raycaster](https://threejs.org/docs/pages/Raycaster.html). These redistributable modules and notice are included in source exports; private emulator/game binaries remain excluded.


## Original PAL cover scans

Three additional JPEG cover scans are installed privately for Ace Combat 3, Ghost in the Shell and G-Police: Weapons of Justice. They are original European retail front covers, not generated or reconstructed art. [COVERS.md](docs/COVERS.md) records the LaunchBox source galleries/assets and integrity hashes. They are excluded from Git and source exports, like the five existing supplied covers.
