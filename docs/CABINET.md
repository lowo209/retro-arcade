# The arcade machine is the website

Press Start on the cabinet or press Enter. A camera move squares up to the CRT, then the real interactive website appears inside its display. The cover carousel, game player and menus all share this screen; there is no separate landing-page library.

The opening view is the machine and a single **Start** button. Corner branding,
wall captions, serial copy and promotional screen text are removed. A gamepad's
A or Start button can enter too; a held button cannot also launch a game when
the camera settles.

## Browse and play

- Click the arrows, scroll the cover rail, swipe, or use Left/Right to choose a game. Enter or Play Game launches it inside the CRT. Favorites keep their existing browser storage key.
- The launcher remembers the last selected title. A valid shared `?game=` link takes priority. **Recent** lists successfully started games in most-recent-first order; browsing or failed downloads do not add a title. History stays in this browser and can be cleared in Settings → Saves & Help without changing game saves or favorites.
- The launcher keeps its main screen to covers, the selected title and Play. Search lives in Collection; optional game details retain GT2's separate Arcade and Simulation disc choices. Longer explanations are linked to GitHub.
- **Settings → Controls** holds the selected game's keyboard layouts for each player and controller guidance. **Saves & Help** keeps a short save reminder and links to instructions, feedback and licenses.
- **Settings → Display → CRT effect** switches the scanlines, phosphor texture, glass reflection and edge shading on or off. The rounded charcoal bezel remains visible in either mode, including fullscreen. The choice defaults on and is saved separately from favorites and game saves; blocked browser storage keeps the change for the current visit. It also controls the starting cabinet's painted CRT texture. The effect is static, with no flicker animation, image tint or extra render loop.
- A connected gamepad uses its D-pad or left stick to browse, A to select/play, X for favorites and Start for the menu. In the menu, directions move focus, A activates and B returns. Actual game input stays with the emulator and its saved mappings.
- Back to Games unloads the iframe. Restart replaces it. The power button leaves the screen and pulls the camera back to the full cabinet. Existing game.html?id= links select the correct game in the cabinet and still require an explicit Start/play gesture.

## Rendering and accessibility

The procedural Three.js scene includes the cabinet shell, edge trim, lit marquee, speaker slots, fasteners, sloped control deck, movable joystick and individual buttons, coin door, contact shadow and arcade-room lights. It uses the pinned local Three.js distribution, canvas textures and existing artwork; no remote 3D model or font service is needed.

initArcadeCabinet exposes enter, exit, setScreenMode and dispose. Its onCamera callback reports the screen rectangle in stage-relative CSS pixels after rendering and on resize. The app places actual accessible HTML over the monitor after the camera settles. Portrait layouts expand this display into a usable framed CRT while keeping the cabinet behind it.

Rendering is event-driven and settles to idle; the cabinet does not continuously animate beside an active emulator. Reduced motion skips camera travel. WebGL failure leaves the static cabinet and a working Start path into the same game browser. Menus contain focus, restore it on close, and make the covered browser/player inert. Browser keyboard shortcuts are inactive during gameplay.

createArcadeSession owns a single iframe and accepts status only from that current, same-origin frame. Stop, replacement, restart, page exit and disposal remove the old frame. Save IDs, game files, BIOS and emulator bindings are unchanged. Build-time version queries keep the first-party module graph consistent after deployment; Three.js and R2 game assets retain their original URLs.

Gameplay expands the CRT into a centered monitor and uses the whole inner glass
for the player. A translucent icon dock floats above the image without reserving
toolbar space. It remains available on touch and keyboard focus. Loading and
error messages are visible only when needed; the running status panel disappears
after startup. Portrait touch devices keep extra height for the emulator's touch
controls, and portrait Settings expands for a usable scrolling panel.

See VERIFICATION.md for actual checks and hardware limits.
