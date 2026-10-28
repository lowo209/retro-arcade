# Playable tester hosting

The selected setup is GitHub Pages for the website and Cloudflare R2 **Standard**
for the operator-authorized game files, BIOS, covers and emulator distribution.
The operator confirmed permission to distribute these assets for testing.
The website is an interactive 3D arcade cabinet with a cover carousel and a
toggleable CRT effect. Eleven titles are ready locally; GT4 has no browser build
and stays unavailable. GT2 also has a separate Simulation disc. Multiplayer means
two players on the same device; CTR's four-player multitap mode is not certified.

## Cost and access

The owner selected a maximum of EUR 1 per month. A Workers Free download gateway
targets zero visitor-traffic charges: see [COST-LIMIT.md](COST-LIMIT.md). Its daily
request cutoff stops new downloads if exhausted. Keep the direct R2 endpoint
disabled so it cannot bypass the cutoff. This is a website-traffic safeguard,
not an account-wide currency cap. An email budget alert alone is not a cap.

The verified release is 7,590,899,528 bytes (about 7.59 GB), including emulator
source archives and notices, across 93 objects. This adds four disc ZIPs and four
real retail covers to the previous 85-object release; its unchanged objects are
reused under the same release prefix rather than copied. R2 Standard currently includes
10 GB-month, one million Class A operations and ten million Class B operations
per month, account-wide. Internet egress is free. Above the allowance, prices are
$0.015/GB-month, $4.50/million Class A and $0.36/million Class B operations.
Billing units round up. This is an expected $0 small-test setup, not a spending cap.
Other buckets, retained releases and unfinished multipart uploads consume storage.

The original release used a public `r2.dev` development URL. The current manifest
uses `https://retro-arcade-downloads.lorenzwohlesser9.workers.dev/` instead. The
gateway reads the private bucket; do not enable a direct R2 URL or custom bucket
domain. The tester website remains public, rather than invite-only.

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
3. Leave the bucket's public development URL disabled and custom domains absent.
   Use the deployed Workers Free gateway as the public asset origin. The R2
   binding exposes write/delete methods, but the reviewed gateway only reads.
4. With a Python installation that includes pip, prepare the emulator source
   bundle and then generate the release plan with the actual public bucket URL:

   ```powershell
   python -m pip install --target .local/python-deps boto3 py7zr
   python scripts/bundle-r2-sources.py
   node scripts/prepare-r2.mjs --public-url=https://retro-arcade-downloads.lorenzwohlesser9.workers.dev/
   ```

   The script hashes only explicit game/firmware/cover mounts plus the emulator
   distribution and the prepared source/notices bundle under `.local/r2-extra/`.
   No large file copies or uploads occur. It writes ignored local plans and a
   pending manifest. GT4's ISO and private configuration are excluded.
5. After uploading, run `npm run build:gateway`. Review and deploy the generated
   `.local/r2-release/gateway-worker.mjs` to the named Worker with only the
   `ASSETS` R2 binding. Keep Workers Free, Logs and Traces disabled, and avoid
   paid integrations. The gateway supplies CORS for the Pages and local preview
   origins. CORS is browser compatibility configuration, not authentication.

## Upload without exposing credentials

The owner creates an R2 S3 API key with **Object Read & Write**, limited to this
bucket. The owner approves credential creation in Cloudflare. Do not use an
account-wide administrative token, paste keys into chat, put them in a command
line or commit them. Use a short expiry or revoke the upload key after upload
and verification. This release uses a bucket-only key expiring after 24 hours;
stop the local uploader after verification to release its in-memory credentials.

Before uploading any files, the uploader now lists existing objects and checks
for incomplete multipart uploads. It refuses a projected bucket total above
9 GB, unknown/incomplete listings or unfinished uploads needing review. This
includes retained releases; it never deletes old objects automatically. Keep
uploads exclusive, since concurrent writers and other buckets remain outside
this point-in-time check.

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
multipart checksum rules; the public gateway does not expose custom S3 metadata. It also
checks JavaScript content type and browser CORS access, byte ranges and actual first
bytes for each game, firmware and core package, and a browser preflight. It writes
an ignored `library.verified.json` only after every check succeeds.

Build locally with this verified manifest, then launch representative arcade and
PS1 games in a browser through the gateway. Check GT2's separate Simulation launch, graphics
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
The full release replaces that manifest after all 93 objects pass checks.

The four additions are Mortal Kombat 4 (PAL), the supplied PAL Uncensored Silent
Hill modification, the supplied US Everything Unlocked Tekken 3 modification,
and European PAL EDC CTR. Tekken retains all three supplied tracks. CTR's ZIP
includes the matching, exact-disc SBI subchannel data; the local readiness check
rejects a missing or malformed matching SBI. Disc/SBI provenance is documented in
[FILES.md](FILES.md), and real retail cover sources are in [COVERS.md](COVERS.md).
Readiness and successful remote file checks do not certify a modification's
behavior or replace game-level testing.

To preview the playable output locally, set `PREVIEW_DIRECTORY=dist-playable` and
`PREVIEW_PORT=4174`, then run `npm run preview`. The project prefix is read from
the build metadata. Start the separate original local arcade with `npm start`
on port 3000 when needed; public playback does not depend on it running.

## Updates and rollback

Keep release keys versioned. Do not overwrite cached game/core objects with changed
bytes. Review retained storage before uploading a second release; remove an old
release only after confirming no active site points to it and obtaining approval
for any irreversible object deletion. Interrupted SDK uploads abort on failure,
but inspect incomplete multipart uploads after a forced process shutdown.

To restore the interface preview, remove `deploy/hosted-library.json` from the
source and deploy that change. This does not remove R2 objects or cancel billing.
The local server's loopback bind and private-file protections remain intact.
Keep the direct R2 URL disabled during rollback; never bypass the request cutoff.
