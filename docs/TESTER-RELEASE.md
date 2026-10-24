# Public tester releases

Open **[Retro Arcade](https://lowo209.github.io/retro-arcade/)** in a browser,
choose an available game, and click **Launch game**. No installation is needed.
Games and the emulator download from Cloudflare R2 and run on the visitor's
device. First PlayStation downloads are roughly 500–750 MB, so allow a few
minutes on slower connections. The library shows the current availability.

The verified full release contains UMK3, Need for Speed: High Stakes, Gran
Turismo 2 (Arcade and separate Simulation discs), Resident Evil 3, Ace Combat 3,
Ghost in the Shell and G-Police: Weapons of Justice. All 85 hosted objects passed
public integrity, CORS and download checks on 24 October 2026.

Multiplayer uses two players on the same device. Click inside the running player
before using its controls. Progress stays in that browser profile at this
website address; use the emulator's export controls to keep a backup. UMK3 save
states are unavailable with the installed core. GT4 remains unavailable because
its separate browser build is not ready. The redesign is deferred.

Report problems through the **[tester issue form](https://github.com/lowo209/retro-arcade/issues/new?template=tester-feedback.yml)**,
including the game and mode, browser/device, steps and any error shown. The form
may require GitHub sign-in. The website collects no feedback, accounts, analytics
or device reports automatically.

The Pages workflow selects the playable build when `deploy/hosted-library.json`
is present. See [R2-HOSTING.md](R2-HOSTING.md) for hosting, verification and rollback
steps. Games, firmware, covers and emulator binaries stay in R2; only website
assets and public catalogue URLs enter Pages. The original interface preview
below remains the fallback when the verified manifest is absent.

## Original interface preview

Published 24 October 2026: **https://lowo209.github.io/retro-arcade/**. Source: [lowo209/retro-arcade](https://github.com/lowo209/retro-arcade). Feedback: [tester issue form](https://github.com/lowo209/retro-arcade/issues/new?template=tester-feedback.yml).

The first public release previews the existing interface: the interactive 3D cabinet, eight-entry library, search, platform filters, favorites, responsive layout and game-detail/control pages. The visual redesign is deferred.

Game playback belongs to the separate local arcade. The preview includes original SVG library illustrations in place of private cover scans. It contains no ROMs, discs, firmware, game-derived builds or EmulatorJS binaries. It makes no requests to the developer's local API or computer. Visitors need only a browser; no installation or game files are requested by this preview.

## Build and check locally

```powershell
npm test
npm run check
npm run build:preview -- --base=/retro-arcade/
npm run preview
```

Open `http://127.0.0.1:4173/retro-arcade/`. The regular playable arcade remains at `http://127.0.0.1:3000` via `npm start`. Keep their addresses distinct: browser favorites and saves are tied to the address. The generated `dist/` folder is ignored by Git.

The builder has a fixed website-asset allowlist. It validates its inputs, rejects linked sources and unexpected output files, and copies only those assets. It writes preview mode into the generated deployment module; `public/deployment.js` stays in local mode. HTML paths and module-resolved navigation support both repository subpaths and a domain root.

## GitHub publication

The repository is `lowo209/retro-arcade`, using its default `main` branch. GitHub Actions is configured as the Pages publishing source. The included workflow runs regression/source-boundary checks, builds the allowlisted `dist-playable/` (or fallback `dist/`), and uploads only that folder as the Pages artifact. Only pushes to main or a manual run deploy; pull requests run checks without deployment permissions.

Testers use the repository's tester-feedback issue form. No feedback, accounts, analytics or device reports are collected automatically by the website. GitHub hosts the issue form and may require its own sign-in. Screenshots are supplied deliberately by testers.

Source publication uses the source-only export allowlist, including `.github/` and the public `deploy/` manifest. Never upload the workspace or `private/` wholesale. The source-only version retains the local arcade code so the owner can develop and test it privately; the static hosted player is deployed separately from its R2 assets.

GitHub Pages serves static files; the local Node server and private mounts do not run there. The owner confirmed distribution permission for the tester assets, which the hosted player loads from the separate public R2 bucket. GT4 additionally needs a working build for the supplied disc edition. See [R2-HOSTING.md](R2-HOSTING.md) for the selected deployment and [PUBLIC-ARCADE.md](PUBLIC-ARCADE.md) for the earlier hosting assessment.

References: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
