# Gran Turismo 4: experimental browser integration

For the new goal of **public link-only play without visitor installations**, read [PUBLIC-ARCADE.md](PUBLIC-ARCADE.md). Build tools are developer-side requirements. The public content-distribution and device-compatibility requirements are separate from installing this local integration.

Investigated 23 October 2026 against the [actual upstream README](https://github.com/snuri00/ps2-web-recomp), [port script](https://github.com/snuri00/ps2-web-recomp/blob/main/scripts/port.sh), [web build script](https://github.com/snuri00/ps2-web-recomp/blob/main/scripts/build_web.sh), [web shell](https://github.com/snuri00/ps2-web-recomp/blob/main/web/shell.html) and [range server](https://github.com/snuri00/ps2-web-recomp/blob/main/scripts/serve.py).

## What is implemented here

Retro Arcade embeds a **real local generated browser build** at `/experimental/gt4/ps2web.html` when `ps2web.html`, `ps2web.js`, `ps2web.wasm`, `ps2web.data` and the configured disc exist. The private build directory is mounted under that URL; its relative `disc.iso` URL maps to the configured private disc. The server supplies `application/wasm`, single-byte-range GET/HEAD support, COOP `same-origin`, COEP `require-corp` and CORP `same-origin`, as needed for WebAssembly, SharedArrayBuffer and disc streaming. All build files remain private and ignored by Git. The frontend checks WebGPU availability and cross-origin isolation before embedding the page.

This is an integration point, **not a compiled port or verified GT4 session**. No placeholder gameplay, video or native PCSX2 launcher is used. The ISO alone cannot be loaded by EmulatorJS or interpreted as a browser build.

## Actual blockers on this computer

- `wsl --list --quiet` reports **Windows Subsystem for Linux is not installed**.
- CMake, Ninja, clang and a Unix bash were not found on PATH.
- Node 20, Python 3 and Git are present; they are sufficient for the arcade website, but not the upstream game compilation toolchain.
- The supplied disc is a US GT4 ISO. Upstream's documented GT4 demonstration uses a PAL release. The US executable must be translated and tested itself; a PAL-generated module cannot be assumed compatible.

The local ISO's actual `SYSTEM.CNF` was inspected: boot ID **SCUS_973.28**, video mode **NTSC**. This confirms its region independently of the folder name.

Upstream documents Linux x86-64 and macOS Apple silicon build flows. It does not document a native Windows build. **WSL2 with Ubuntu is the practical Windows build route inferred from those Linux tools**, not a claim of upstream-tested Windows support. Installing WSL may require administrator access, virtualization and a restart; this project has not installed it or changed OS settings.

## Build in WSL2 after installing it

In an administrator PowerShell, install WSL if desired, then complete Ubuntu's first-run setup:

```powershell
wsl --install -d Ubuntu
```

After any requested restart, open an Ubuntu terminal. Install the upstream prerequisites and keep the source checkout on the Linux filesystem for compilation speed:

```bash
sudo apt update
sudo apt install git cmake ninja-build clang python3 p7zip-full
mkdir -p ~/retro-arcade-tools
cd ~/retro-arcade-tools
git clone https://github.com/snuri00/ps2-web-recomp.git
cd ps2-web-recomp
git rev-parse HEAD   # record the exact upstream revision used
scripts/port.sh gt4-us "/mnt/c/Users/Loren/Downloads/Retro Games/Gran_Turismo_4_PS2_ISO_USA/Gran_Turismo_4_PS2_ISO_USA/Game Files/Gran Turismo 4.iso"
```

You have since downloaded the source already. To reuse that exact snapshot instead of cloning it again, copy it to a new build directory inside WSL after installing the tools:

```bash
mkdir -p ~/retro-arcade-builds
# Choose a new destination; do not overwrite an existing build checkout.
cp -a "/mnt/c/Users/Loren/Downloads/ps2-web-recomp-main/ps2-web-recomp-main" ~/retro-arcade-builds/ps2-web-recomp
cd ~/retro-arcade-builds/ps2-web-recomp
scripts/port.sh gt4-us "/mnt/c/Users/Loren/Downloads/Retro Games/Gran_Turismo_4_PS2_ISO_USA/Gran_Turismo_4_PS2_ISO_USA/Game Files/Gran Turismo 4.iso"
```

The downloaded ZIP has no Git commit metadata or generated game build. Record its origin/version separately if using it, and keep all generated code and disc data private. This command has not been run: WSL and the compiler toolchain are still missing.

These are the upstream `port.sh` command shape and prerequisites. The first run installs Emscripten in its checkout and obtains wgpu-native; Internet is needed for those **development dependencies**. No BIOS download is required by the documented high-level runtime. The script extracts the disc executable, emits game-derived C++, runs headless exploration to discover indirect functions and vector programs, then builds the browser module. Those internal headless build runs are upstream's documented compilation process; playing from Retro Arcade still uses only the browser build. Do not use `--native-only` or a `ps2run --window` launcher as a replacement for the website.

Do not copy upstream example binaries, somebody else's generated modules or a different edition's build. If the script reports unimplemented syscalls, missing IOP functions or translation errors for your edition, retain its logs locally and treat the port as unsupported until fixed. Do not label it playable because compilation alone succeeded.

## Connect a successful build

In Ubuntu, copy the **entire** generated web directory, including any worker, worklet, shader or ancillary files, to the ignored web folder:

```bash
cp -a build/web-gt4-us/. "/mnt/c/Users/Loren/Documents/ChatGPT/Retro-Games/private/gt4/web/"
```

The existing ignored `private/local.json` already references the supplied ISO without making a second 5 GB copy. For another location, edit it in VS Code:

```json
{
  "gt4": {
    "disc": "C:/path/to/your/private/Gran Turismo 4.iso",
    "buildDirectory": "private/gt4/web"
  }
}
```

Run `npm start` on Windows, open `http://127.0.0.1:3000`, refresh GT4's page and try the experimental build in Chrome. The upstream alternate server for testing the standalone build is:

```bash
python3 scripts/serve.py build/web-gt4-us games/gt4-us/disc.iso
```

That serves at `http://localhost:8620/`; saves there belong to a different origin from Retro Arcade. Use only for diagnosing the upstream build.

## Verification required before claiming support

Check title screen, menus, an actual race, CPU opponents, graphics correctness, sound effects/music, sustained performance and browser-console errors on this machine. Record Chrome version, GPU, game region, build commit and resolution. Then check keyboard and physical gamepad input, triggers, save/reload/export/import and two-player split-screen. The website's fullscreen button does not prove these work. All these GT4 checks remain **unverified** until the toolchain and build are available.

Upstream maps arrows to D-pad, I/J/K/L to the left stick, Z to Cross, X to Circle, A to Square, S to Triangle, Q/W/1/2 to shoulders, Enter to Start, Backspace to Select, F to fullscreen. Its Gamepad API integration handles analog triggers and vibration where exposed. Its browser memory card is stored locally; Export card and Import card use `.ps2` backups. No two-player guarantee is made by this integration.

Generated C++, extracted executables, ISO and generated WebAssembly remain copyrighted game-derived data: keep the whole tool checkout and build private. Only this website's source and documented integration are suitable for a source repository.
