# Playable tester hosting

The selected setup is GitHub Pages for the website and Cloudflare R2 **Standard**
for the operator-authorized game files, BIOS, covers and emulator distribution.
The operator confirmed permission to distribute these assets for testing.
The redesign is deferred. Seven games are ready locally; GT4 has no browser build
and stays unavailable. Multiplayer means two players on the same device.

## Cost and access

The prepared release is 4,805,262,832 bytes (about 4.81 GB), including emulator
source archives and notices, across 85 objects. R2 Standard currently includes
10 GB-month, one million Class A operations and ten million Class B operations
per month, account-wide. Internet egress is free. Above the allowance, prices are
$0.015/GB-month, $4.50/million Class A and $0.36/million Class B operations.
Billing units round up. This is an expected $0 small-test setup, not a spending cap.
Other buckets, retained releases and unfinished multipart uploads consume storage.

Use the free `r2.dev` public development URL initially. It is rate-limited and is
intended for testing. A production release should use a custom domain and revisit
traffic, caching and access requirements. The link is public, not invite-only.

Official references: [pricing](https://developers.cloudflare.com/r2/pricing/),
[public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[CORS](https://developers.cloudflare.com/r2/buckets/cors/),
[uploads](https://developers.cloudflare.com/r2/objects/upload-objects/).

## Activation and bucket

1. The owner signs in and completes R2's billing activation, including accepting
   the displayed terms and overage authorization. The dashboard showed $0 due
   now and $0/month plus additional usage on 24 October 2026. Do not buy a paid
   Workers plan or domain for this tester release.
2. Create an R2 bucket such as `retro-arcade-testers`, Standard storage class,
   default jurisdiction. Do not reuse a bucket containing unrelated private data.
3. Enable its public development URL and record that public URL. Enabling it makes
   every object in this bucket accessible to anyone who knows an object URL.
4. With a Python installation that includes pip, prepare the emulator source
   bundle and then generate the release plan with the actual public bucket URL:

   ```powershell
   python -m pip install --target .local/python-deps boto3 py7zr
   python scripts/bundle-r2-sources.py
   node scripts/prepare-r2.mjs --public-url=https://pub-REPLACE.r2.dev/
   ```

   The script hashes only explicit game/firmware/cover mounts plus the emulator
   distribution and the prepared source/notices bundle under `.local/r2-extra/`.
   No large file copies or uploads occur. It writes ignored local plans and a
   pending manifest. GT4's ISO and private configuration are excluded.
5. In bucket Settings, add the CORS policy from `.local/r2-release/cors.json`.
   This permits GET/HEAD from the Pages origin and the local hosted-build test
   origin. CORS is browser compatibility configuration, not access control.

## Upload without exposing credentials

The owner creates an R2 S3 API key with **Object Read & Write**, limited to this
bucket. The owner approves credential creation in Cloudflare. Do not use an
account-wide administrative token, paste keys into chat, put them in a command
line or commit them. Revoke the upload key after upload and verification.

`scripts/upload-r2.py` provides a loopback-only form for entering the S3 Access
Key ID and Secret Access Key directly. It holds credentials only in memory, uses
the official boto3 SDK over HTTPS, uploads in 32 MiB multipart chunks, and verifies
remote length and SHA-256 metadata. A restart skips matching completed objects;
it refuses to overwrite a different object at an existing release key.

Install boto3 into the ignored `.local/python-deps` folder with a Python
installation that includes pip, then run:

```powershell
python scripts/upload-r2.py --account YOUR_CLOUDFLARE_ACCOUNT_ID --bucket retro-arcade-testers
```

Open its printed `http://127.0.0.1:4321` URL, enter the bucket-scoped S3 credentials,
and press Start upload. Do not close that Python process until the upload finishes.
The form checks Host, Origin and a session CSRF token. It never writes keys to
disk, returns them to the browser or logs SDK request/credential details.

The separate source bundle retains frontend 4.2.3, core build scripts 2.0.2,
RetroArch, PCSX ReARMed and MAME 2003 Plus archives, with commit provenance and
hashes in `sources/provenance.json`. Core timestamps come from their installed
reports. Frontend sources include the reproducible disabled-update-check patch.
Core notices and original license files are available beside the runtime.

## Verify before enabling playback on Pages

```powershell
node scripts/verify-r2.mjs
```

The authenticated uploader verifies every object's SHA-256 metadata. The public
verifier checks every object's length and ETag, matching R2's single-PUT or 32 MiB
multipart checksum rules; `r2.dev` does not expose custom S3 metadata. It also
checks JavaScript content type and browser CORS access, byte ranges and actual first
bytes for each game, firmware and core package, and a browser preflight. It writes
an ignored `library.verified.json` only after every check succeeds.

Build locally with this verified manifest, then launch representative arcade and
PS1 games in a browser through R2. Check GT2's separate Simulation launch, graphics
error guidance, controls, feedback, saves, restart and mobile layout. First PS1
loads are 500–750 MB and can take several minutes. A successful file check does
not certify gameplay, sound, gamepads or all games on every device.

Only after these checks, copy the public manifest to `deploy/hosted-library.json`.
This tracked file contains public URLs and catalogue fields, never credentials
or local paths. `npm run build:pages` then emits `dist-playable/`; without that
file it emits the existing interface preview in `dist/`. The Pages workflow uses
the builder's output directory. Game binaries remain outside Git and Pages.

A staged release may include only completed, verified game uploads. Games still
uploading have `ready: false`, no download URL, and an explanatory message; every
runtime, source, firmware and cover prerequisite must still pass verification.
The full release replaces that manifest after all 85 objects pass checks.

To preview the playable output locally, set `PREVIEW_DIRECTORY=dist-playable` and
`PREVIEW_PORT=4174`, then run `npm run preview`. The project prefix is read from
the build metadata. The original local arcade remains on port 3000.

## Updates and rollback

Keep release keys versioned. Do not overwrite cached game/core objects with changed
bytes. Review retained storage before uploading a second release; remove an old
release only after confirming no active site points to it and obtaining approval
for any irreversible object deletion. Interrupted SDK uploads abort on failure,
but inspect incomplete multipart uploads after a forced process shutdown.

To restore the interface preview, remove `deploy/hosted-library.json` from the
source and deploy that change. This does not remove R2 objects or cancel billing.
The local server's loopback bind and private-file protections remain intact.
