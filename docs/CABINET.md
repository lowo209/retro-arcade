# The arcade machine is the website

Press Start on the cabinet or press Enter. A camera move squares up to the CRT, then the real interactive website appears inside its display. The cover carousel, game player and menus all share this screen; there is no separate landing-page library.

## Browse and play

- Click the arrows, scroll the cover rail, swipe, or use Left/Right to choose a game. Enter or Play Game launches it inside the CRT. Favorites keep their existing browser storage key.
- The menu holds search, game information, keyboard layouts for each player, controller guidance, save instructions, graphics help, feedback and licenses. GT2 has separate Arcade and Simulation disc options.
- **Settings → CRT effect** switches the scanlines, phosphor texture, glass reflection and edge shading on or off. The rounded molded bezel remains visible in either mode, including fullscreen. The choice defaults on and is saved separately from favorites and game saves; blocked browser storage keeps the change for the current visit. It also controls the starting cabinet's painted CRT texture. The effect is static, with no flicker animation or extra render loop.
- A connected gamepad uses its D-pad or left stick to browse, A to select/play, X for favorites and Start for the menu. In the menu, directions move focus, A activates and B returns. Actual game input stays with the emulator and its saved mappings.
- Back to Games unloads the iframe. Restart replaces it. The power button leaves the screen and pulls the camera back to the full cabinet. Existing game.html?id= links select the correct game in the cabinet and still require an explicit Start/play gesture.

## Rendering and accessibility

The procedural Three.js scene includes the cabinet shell, edge trim, lit marquee, speaker slots, fasteners, sloped control deck, movable joystick and individual buttons, coin door, contact shadow and arcade-room lights. It uses the pinned local Three.js distribution, canvas textures and existing artwork; no remote 3D model or font service is needed.

initArcadeCabinet exposes enter, exit, setScreenMode and dispose. Its onCamera callback reports the screen rectangle in stage-relative CSS pixels after rendering and on resize. The app places actual accessible HTML over the monitor after the camera settles. Portrait layouts expand this display into a usable framed CRT while keeping the cabinet behind it.

Rendering is event-driven and settles to idle; the cabinet does not continuously animate beside an active emulator. Reduced motion skips camera travel. WebGL failure leaves the static cabinet and a working Start path into the same game browser. Menus contain focus, restore it on close, and make the covered browser/player inert. Browser keyboard shortcuts are inactive during gameplay.

createArcadeSession owns a single iframe and accepts status only from that current, same-origin frame. Stop, replacement, restart, page exit and disposal remove the old frame. Save IDs, game files, BIOS and emulator bindings are unchanged. Build-time version queries keep the first-party module graph consistent after deployment; Three.js and R2 game assets retain their original URLs.

See VERIFICATION.md for actual checks and hardware limits.
