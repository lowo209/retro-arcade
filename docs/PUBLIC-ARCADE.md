# Public, link-only arcade: what is possible

Checked 24 October 2026 against the downloaded PS2 Web Recomp source and its [official README](https://github.com/snuri00/ps2-web-recomp).

The requested experience is **open a link → choose a game → play**, without asking visitors to install an emulator, WSL, Python, Node or development tools, and without asking them to bring a disc image. That is the product target. It is not the current deployment state.

## Developer work and visitor requirements are different

PS2 Web Recomp's developer compiles an exact game disc into a browser build once. A hosting service then sends its HTML, JavaScript, WebAssembly, data and requested disc sectors to visitors. Visitors run the code in their browser. Downloading and caching web assets is still necessary, as for any website; it does not require an emulator installation.

WSL2/Linux tools, CMake, Ninja, clang and Emscripten belong on the **build machine**, not on visitors' computers. They are not required to serve an already successful build. Upstream documents Linux and macOS builds; WSL2 is our proposed Windows route, not an upstream-tested native Windows build.

That makes install-free play technically possible on **supported browsers and hardware**, rather than on every device. The runtime depends on SharedArrayBuffer isolation and needs a working WebGPU adapter for practical 3D racing. A browser exposing `navigator.gpu` does not by itself prove an adapter can run this game's shaders correctly or fast enough. The software-renderer fallback is not a promise of usable racing performance.

The [official Chrome WebGPU overview](https://developer.chrome.com/docs/web-platform/webgpu/overview) also describes platform/GPU-dependent availability. Upstream's demo is a particular PAL GT4 build on a particular device, not a test of every browser, the supplied US disc, phones or low-end machines.

## The downloaded source is not a ready GT4 port

Inspected folder:

```text
C:/Users/Loren/Downloads/ps2-web-recomp-main/ps2-web-recomp-main/
```

Snapshot identification: README SHA-256 `4d0dcffe655fc3f2e8e5e80c9161ba8467253794b2e398b8ae06af7df07da31e`.

It contains `recomp/`, `runtime/`, `web/`, `host/`, `scripts/` and CMake sources. No `ps2web.html`, game `.wasm`, `boot.txt`, or ISO was found in that download. The `web/shell.html` file is a build template, not a ready game page. `scripts/port.sh` translates the game executable, performs exploration runs and produces `build/web-<name>/`. Simply uploading the GitHub folder will not produce a playable game.

The actual shell defaults to a server URL `disc.iso` (or a `?disc=` URL). Its file input imports a **memory-card `.ps2` file**, not a game ISO. It is not a ready-made public “bring any ISO” emulator, and it is not doing all the game recompilation inside the visitor's browser.

The supplied US disc identifies `SCUS_973.28`, while the documented upstream demonstration uses PAL. Build and test this exact US executable before claiming support. WSL remains uninstalled on this computer and the documented compiler tools were not available on PATH. No compiled GT4 module has been produced or tested here.

## The distribution requirement

The source runtime's MIT license covers its own code. It does not provide a GT4 distribution license. In its **Legal** section, upstream explicitly says the generated C++ and built WebAssembly are translations of the game's executable and should remain on the owner's computer; it also says to keep the disc server private.

A link-only site would send the game's generated executable and ISO sectors to visitors. Hiding the download button, using a private object-storage bucket behind a proxy, compiling once on a server, or making users log in does not avoid that transfer. Even “visitors bring their own ISO” would still distribute the translated game executable if the same generated module were public.

For the requested public commercial-game catalogue, obtain the relevant permission/licences for the game content and compiled derivatives, plus the other components and artwork being served. A permission to publish the runtime source is not that permission. The original project brief also explicitly requires keeping games, firmware and game-derived artifacts private. This task has therefore **not uploaded any ISO, ROM, BIOS, supplied cover, game-derived module or source checkout containing those assets**.

An open public website for the original code and content we can distribute is a separate deliverable. It would not, by itself, make the private commercial games available from a link. The current local server is intentionally bound to `127.0.0.1` and rejects public Host headers; it is not a public production server.

## Concrete deployment path once the content is authorized

1. Build the supplied exact GT4 edition on a developer/build machine; retain an exact source revision or snapshot and local build logs.
2. Verify actual races, controls, sound, saves, speed and graphics on the intended desktop/mobile device matrix. Offer a useful unsupported-device message where needed; do not label untested devices compatible.
3. Package the entire browser output, including workers/worklets and other dependencies, with the authorized disc data. Keep executable and disc versions together. A PAL module and US disc are not interchangeable.
4. Serve over **HTTPS**, with correct WebAssembly MIME types, byte-range GET/HEAD support for the multi-gigabyte ISO, and the COOP/COEP headers documented by upstream. If assets span domains, configure the corresponding CORS/CORP policy consistently. The existing local server demonstrates these HTTP behaviors, but is not configured for public exposure.
5. Use authorized storage/CDN capacity for the game assets. Disc streaming can avoid downloading the entire ISO upfront; bandwidth and browser asset downloads still exist. No claim is made that a generic static-site upload supports this file size or byte-range behavior.
6. Start with a small authorized test audience and measured browser results, then expand. WSL and the compiler toolchain stay off visitors' machines.

If broad device support is more important than running the game on the visitor's GPU, a separately authorized server-streaming service is another architecture. It would run the game on server hardware and stream video/input to the browser, with per-session compute and latency considerations. That is a different product from this local browser-execution integration and has not been substituted for it.

## What was done in this update

- Resident Evil 3: Nemesis (original PS1 US release) added to the local library, private asset routes, import script, controls and save configuration.
- Existing private games and firmware remain private. No public game deployment has been performed.
- A source-only export remains suitable for reviewing/publishing the website's original code, with illustrative fallback artwork and no private game files.
