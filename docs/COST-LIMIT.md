# Download cost safeguard

The owner selected a maximum of EUR 1 per month on 28 October 2026. The design
targets zero visitor-download charges by stopping traffic at a free quota.
This is a quota safeguard for this website, not an account-wide currency cap.

## Deployment design

- GitHub Pages continues to host the cabinet website.
- A Cloudflare **Workers Free** gateway serves only the release's explicit
  object allowlist from the existing Standard R2 bucket. Each request performs
  zero or one R2 read; it never uploads, lists, deletes, retries or falls back
  to an unrestricted public origin. Large game responses stream directly.
- Workers Free allows 100,000 requests per day, resetting at 00:00 UTC. When
  exhausted, Cloudflare stops further Worker requests with error 1027. Even
  across 32 UTC date boundaries, one R2 read per request stays below 3.2 million
  reads, within R2 Standard's 10 million free monthly read operations.
- Keep the bucket's public `r2.dev` URL disabled and custom domains absent.
  Otherwise an old direct object URL could bypass the gateway entirely.
- Keep Workers on Free, disable Workers Logs/observability, and do not enable
  paid build integrations, Logpush or other metered bindings for this gateway.
- Existing bucket storage is 7,590,899,528 bytes. Future uploads must consider
  retained objects, not just the new release: refuse an upload projected above
  9 GB and stop if unfinished multipart uploads need review. No old objects are
  automatically deleted to make space.

If the daily request quota is exhausted, already downloaded games can keep
running. New downloads may be unavailable until the next UTC day. The website
must not silently bypass this limit through its old R2 URL.

## Scope and operator changes

These bounds depend on the deployed code making at most one R2 operation per
request, the direct public endpoint remaining disabled and Workers remaining
on Free. Other Cloudflare products, unrelated account activity, direct S3 API
use, manual uploads and future plan/configuration changes are outside this
safeguard. The account's free R2 allowances are shared across buckets.

An R2 binding exposes write/delete methods as well as reads. The deployed
gateway code uses only reads; the binding itself is not a read-only permission.
No S3 credential is embedded in the gateway or website.

Budget alerts can provide a secondary warning, but they only send email and do
not stop spending. A dollar alert threshold is not an exact EUR spending cap.

## Deployment checks

1. Confirm the account shows Workers **Free / Current plan** and no paid upgrade.
2. Generate and review the allowlisted gateway bundle with `npm run build:gateway`.
   Run `npm test` and `npm run test:upload-budget`.
3. Deploy the reviewed gateway, connect only `retro-arcade-testers`, and disable
   observability. Confirm only the intended R2 binding exists.
4. Verify the gateway's public lengths, ETags, CORS, MIME types, byte ranges and
   representative browser launches, then deploy the website using its verified URL.
5. Disable direct R2 public access and verify the old object URLs fail while the
   gateway still works. Check account usage and record proof of the final settings.

Repeat these checks after changing the gateway, release allowlist or access
settings. Never restore the direct public endpoint as a download fallback.

The verified manifest uses
`https://retro-arcade-downloads.lorenzwohlesser9.workers.dev/releases/tester-v1/`.
Gateway source is generated from the local upload plan with `npm run build:gateway`;
the generated bundle contains only public object keys, sizes, MIME types and ETags.
Rebuild and deploy that allowlist before publishing a release with new keys.

Official references checked 28 October 2026:
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/),
[Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/),
[budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/).
