# Public tester releases

The Pages workflow now supports a playable R2-backed release when
`deploy/hosted-library.json` is present. See [R2-HOSTING.md](R2-HOSTING.md) for
current hosting and verification steps. The interface-only release below is
retained as the fallback when that verified manifest is absent.

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

The repository is `lowo209/retro-arcade`, using its default `main` branch. GitHub Actions is configured as the Pages publishing source. The included workflow runs regression/source-boundary checks, builds the allowlisted `dist/`, and uploads only that folder as the Pages artifact. Only pushes to main or a manual run deploy; pull requests run checks without deployment permissions.

Testers use the repository's tester-feedback issue form. No feedback, accounts, analytics or device reports are collected automatically by the website. GitHub hosts the issue form and may require its own sign-in. Screenshots are supplied deliberately by testers.

Source publication uses the source-only export allowlist, including `.github/`. Never upload the workspace or `private/` wholesale. The source-only version retains the local arcade code so the owner can develop and test it privately; only the static interface preview is deployed.

GitHub Pages serves static files; the current Node server and private game mounts cannot run there. Link-only commercial-game playback is a later release requiring a suitable hosting design and authorized game/firmware distribution. GT4 additionally needs a working build for the supplied disc edition. See [PUBLIC-ARCADE.md](PUBLIC-ARCADE.md).

References: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
