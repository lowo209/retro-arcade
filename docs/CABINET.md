# Interactive hero cabinet

The existing hero column now contains a procedural Three.js 0.180.0 cabinet. The charcoal/orange palette, typography, navigation and library keep their existing design. The supplied RE3 cover is installed unchanged at ignored `private/covers/re3.png`; the original RE3 illustration remains the source-only fallback.

## Use the cabinet

- Move a mouse over the surrounding space for a restrained view change. Hover and hold individual arcade buttons: each cap moves into its own housing. The view stays fixed while a control is held.
- Drag the joystick ball. Travel is limited to a circular gate; releasing, cancelling a pointer or leaving the browser returns it to centre. Touch devices have a larger grip target; swiping elsewhere on the canvas can scroll the page.
- Press the physical or HTML **START** button. The CRT powers up, checks its memory/controls and shows the library prompt. Clicking its screen follows the existing `#library` anchor. This is an interactive illustration, not an emulator or substitute game.
- The **＋** button toggles a slightly closer camera. It starts off.
- Open **Keyboard controls** for HTML alternatives to all four buttons and the joystick. Use Tab, Enter/Space and the joystick's arrow keys. The library link remains available without JavaScript or WebGL.

## Construction and lifecycle

`public/arcade-cabinet.js` constructs extruded side panels with continuous edge trim, a lower enclosure, sloped deck, recessed tilted CRT with convex glass, marquee, speaker slots, fasteners, joystick, four separate lathed caps, START button, coin door and kick plate. The cabinet rests on a contact shadow. No model, generated image, external font or remote texture is needed. Text and restrained scanlines use local canvas textures.

Three.js is pinned in `public/lib/three/` with its MIT notice. No CDN or build step is required. Ray picking respects solid surfaces; labels inherit their parent control. Held controls never become cabinet-rotation gestures. Game bindings are separate: see [CONTROLS.md](CONTROLS.md).

Rendering wakes for input, resize, boot and settling, then stops when still. Pixel ratio is capped at 1.5, shadows use a 1024 texture and the CRT updates only when its content changes. Off-screen/hidden tabs pause. Reduced motion disables mouse-follow, animated boot and animated input transitions. Back/forward cache resumes the scene. Teardown releases animation frames, listeners, observers, textures, geometry, materials, shadow resources and the renderer. WebGL creation/context failure restores the static SVG and ordinary library link.

Actual test results and hardware limits are in [VERIFICATION.md](VERIFICATION.md).
