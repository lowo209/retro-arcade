# Shared keyboard defaults

Retro Arcade supplies `EJS_defaultControls` before loading EmulatorJS 4.2.3. Every new visitor receives the same profile for each game. The [official control-mapping reference](https://emulatorjs.org/docs4devs/control-mapping/) describes the player slots, RetroPad IDs, keyboard values and separate gamepad values. The installed runtime's `keyMap`, `setupKeys`, `loadSettings` and Control Settings Reset handler were also inspected; this integration uses their actual behavior.

## Player 1

| Input | UMK3 and Resident Evil 3 | Need for Speed and GT2 |
| --- | --- | --- |
| D-pad up / down | W / S | I / K (menus) |
| D-pad left / right | A / D | A / D (steering and menus) |
| Cross / arcade B | J | W (throttle and confirm) |
| Square / arcade Y | U | S (brake) |
| Circle / arcade A | K | J |
| Triangle / arcade X | I | U (back in NFS) |
| L1 / R1 | Q / E | Q / E |
| L2 / R2 | R / F | R / F |
| Select / coin | 5 | 5 |
| Start | Enter | Enter |

UMK3 has six action inputs on J, K, U, I, Q and E. Their exact attack assignments depend on the arcade core's mapping; the website does not invent attack labels. Resident Evil 3 keeps the original tank controls: W/S moves Jill forward/back relative to her facing direction, and A/D turns her. This does not change the game's camera or control system.

The racing profile maps W/S to the original PlayStation face-button pedals. It does not send W simultaneously to D-pad up, because that would make one key trigger two different actions. Use I/K for vertical menu navigation, A/D for horizontal navigation, and W to confirm. This targets the original default in-game controller assignment; a different assignment selected inside a game can change what its face buttons do.

## Player 2

Use arrow keys for directions in UMK3, with numpad 1/2/4/5 for B/A/Y/X, numpad 7/9 for L1/R1, numpad 0/decimal for L2/R2, top-row 6 for coin and top-row 0 for Start. Enable Num Lock. For racing, up/down arrows become throttle/brake, left/right arrows steer, numpad 8/5 navigate menus vertically, numpad 2 is Circle and numpad 4 is Triangle. Cross and Square are the up/down arrows. The top-row digits and numpad digits are distinct keys.

No keyboard key is shared between the two players in either profile. Gamepads retain all existing digital and analog bindings. Smaller keyboards without a numpad can use gamepads or customize Player 2 in Controls. Resident Evil 3 remains single player.

## Existing browser settings and saves

EmulatorJS loads saved control settings for each game after its defaults. Custom controls therefore continue to work. Existing visitors may still have the earlier arrow-key layout saved. Open the emulator toolbar's **Controls → Reset** to adopt the new defaults for that game. This reset changes controller bindings, not game saves. Do not clear all browser storage merely to change keys. Settings and saves keep their existing game IDs and names.

The profiles configure the EmulatorJS games only. GT4's PS2 Web Recomp runtime has its own controls, which remain experimental and unchanged until there is a built game to test.

## Manual verification sequence

The following are test steps, not claims that they passed:

- **UMK3:** boot, reset Controls if needed, insert P1 coin with 5 and start with Enter; select a fighter with WASD and an action key; verify movement, crouch/jump and all six actions. Insert P2 coin with 6, start with top-row 0, then verify P2 arrows/numpad and simultaneous independent inputs.
- **NFS:** reset Controls if needed. Use I/K and A/D to navigate, W to confirm and U to go back. Start a single race with default in-game controls; hold W to accelerate, A/D to steer, and S to brake. Test P2 separately in the game's two-player mode if both pads are available.
- **GT2:** the requested Arcade disc is still missing. The separate supplied Simulation disc can test menus using I/K, A/D and W, then default race pedals/steering with WASD where a race is available. Do not claim that the Simulation disc verifies Arcade or split-screen.
- **RE3:** reset Controls if needed, use WASD to choose New Game and J to confirm. Verify tank movement/turning and the original face/shoulder actions in a safe early scene. Do not claim that this remapping changes the original game to modern camera-relative controls.

Automated checks cover keyboard conflicts across players, isolated profile objects, retained gamepad/analog labels, correct racing pedals and compatibility of key names with the installed 4.2.3 runtime. Gameplay, physical controllers, sound and simultaneous keyboard rollover require actual testing.


## Added single-player PS1 games

Ace Combat 3, Ghost in the Shell and G-Police: Weapons of Justice use the same base keyboard profile as RE3: WASD is the D-pad, J/K/U/I is Cross/Circle/Square/Triangle, Q/E is L1/R1 and R/F is L2/R2. Enter starts/pauses and 5 is Select. These map to the original controller inputs; flight/vehicle actions depend on each game's preset. Their pages hide Player 2 and keep separate save IDs 106/107/108. GT2's new European Arcade disc uses the existing racing profile and ID 103; its US Simulation option keeps ID 104.
