# Phase 10 — Spotify & Apple Music Provider Integrations

Date reviewed: **2026-10-03 (Asia/Kuala_Lumpur)**.

Status: **IN_PROGRESS — PENDING SECURE APPLE INTEGRATION**. This is a feasibility/security checkpoint, not an implemented or accepted phase. Phase 11 has not started.

## Owner authorization and continuation gate

The owner authorized source development through Phase 10 → Phase 11, despite Phase 09's inherited dependency-audit completion gate. This exception permits sequencing only. It does not accept Phase 09, resolve its audit, waive provider/security requirements, or change previous evidence. Phase 09's report/history remain unchanged, including the recorded seven high dependency findings; that audit count is inherited evidence, not a fresh audit result.

After the provider review, the owner explicitly selected **“Keep Phase 10 pending secure Apple integration”** instead of accepting external-link fallbacks as Phase 10 delivery. Consequently, Phase 10 is not structurally complete and its Phase 11 continuation gate is not satisfied. No Phase 11 or Phase 12 work is authorized to start at this checkpoint. The original Phase 11 authorization is conditional on resolving the Phase 10 gate; no additional owner acceptance is claimed.

## Work completed

- Read the umbrella, coordination/history, Phase 09–11 specifications, current personal-player architecture/report and relevant modular/security/media/room/productivity/social/RTC guidance.
- Reviewed current official Spotify/Apple documentation and terms, distinguishing provider capabilities from capabilities permitted for this application.
- Inspected the current official MusicKit JS source and public configuration reference, without executing authorization or playback.
- Recorded a capability matrix, policy decisions and the unresolved Apple credential-storage requirement below.

**Product implementation: not completed.** No provider adapter, account-link flow, token endpoint/vault, browser SDK initialization, external-link substitute, or provider-shared playback was added. There is no misleading Connect button or claimed playback success.

## Spotify policy and access review

The [Developer Policy](https://developer.spotify.com/policy), particularly sections III–IV, restricts games, integration with another service's streams, overlapping Spotify content with other audio, visual synchronization and commercial streaming applications. Premium is required for music streaming. Study Space includes games and concurrent RTC/ambience/other-provider media. **Application-specific inference:** personal scope alone does not resolve these restrictions; this combination needs provider clarification/approval before an API/SDK integration can be enabled. No Spotify account linking or playback is shipped. Room synchronization and music-based games are omitted.

The [Developer Terms](https://developer.spotify.com/terms) treat controlling a background Spotify application as streaming too. Remote device control is therefore not an assumed workaround. Metadata-only integration is not assumed exempt from application restrictions. No token, profile, library or device information is collected.

Reviewed authentication: [authorization code with PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow) and [redirect URI requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri). A future permitted integration must bind server-generated, single-use state and PKCE to the authenticated actor/session, minimize scopes and enforce an exact configured redirect URI. Spotify requires HTTPS except explicit loopback IP exceptions; its reference rejects `localhost` redirect URIs. These flows are **requirements for future implementation**, not completed security controls.

Access/quotas: [quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) describes Premium for the development app owner and up to five allowlisted users. Public scaling requires approved extended access. The [July 23, 2026 update](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates) supersedes the earlier one-client-ID limit with up to 25, shares development quota across a developer's apps, and distinguishes quota exhaustion in 429 responses. The [February migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) must be read alongside the [March update](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security), which postponed endpoint-access changes for existing integrations. Do not assume one uniform endpoint set across new/existing/extended apps. [Rate limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits) are separate from quota and require bounded requests/backoff rather than unbounded retries. No numeric universal rate ceiling is claimed.

## Apple Music policy, authentication and storage review

[MusicKit](https://developer.apple.com/musickit/) supports authorized personal web playback. The current [Program License Agreement §3.3.6(D)](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/) requires user-initiated full-song playback and truthful play/pause/skip controls, prohibits indirect monetization of Apple Music access, restricts content synchronization unless documented permission exists, and requires the supported, standalone MusicKit library. This review establishes no permission for Study Space room synchronization. That behavior remains omitted.

[Developer tokens](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens) use ES256 with the MusicKit private key, key ID and team ID, issued-at/expiry claims, and a maximum lifetime of 15,777,000 seconds. Origin restrictions are recommended for web clients. The signing private key must remain server-side; a short-lived developer token cannot replace user authorization. Apple rate-limits requests using developer tokens and returns 429; a universal numeric quota or Spotify-style public-user allowlist was not established by the reviewed Apple sources.

[User authentication](https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit) uses a separate Music User Token for subscriber-specific data. MusicKit on the Web manages it; Study Space identity authentication is a different concern. Full playback depends on subscriber authorization, subscription/content availability and browser/provider support, not merely a developer token.

The official [MusicKit JS v3 configuration reference](https://js-cdn.music.apple.com/musickit/v3/docs/index.html?path=/story/reference-javascript-musickit--page) lists developerToken, app, bitrate and storefrontId, without a documented credential-persistence switch. Read-only inspection of the current [official SDK](https://js-cdn.music.apple.com/musickit/v3/musickit.js) found its StoreKit credential owner defaults to localStorage and its user-token validation path writes the token there. The application requirement forbids provider-token persistence in browser-readable storage. Encrypting a server copy would not remove that browser copy.

**Unresolved requirement:** identify a supported authorization/playback integration that keeps provider credentials out of prohibited browser persistence, and validate it. No such supported configuration was identified in this review. This is **not proof that Apple offers no possible solution**. Private StoreKit options, global storage patches, modified/re-hosted SDKs, opaque-origin authentication workarounds or immediate deletion after a credential has already persisted are not accepted solutions here.

Local source-inspection evidence: `.local/validation/phase10/provider-source-inspection.json`; reproducible read-only script: `.local/validation/phase10/review-evidence.mjs`. The evidence records fetched URLs, timestamps, byte counts, hashes and boolean source observations, with no SDK re-hosting or credential values. It is static inspection, not a live login test or browser storage trace.

## Provider capability matrix

All capabilities in this table are **provider-level candidates**, not implemented Study Space functionality. Both integrations currently have no registration or routes.

| Capability            | Spotify provider capability / qualification                         | Apple Music provider capability / qualification                            |
| --------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Account linking       | OAuth authorization code/PKCE; application policy clearance pending | MusicKit user authorization; supported credential-storage solution pending |
| Metadata/library      | Scoped Web API; app-mode endpoint access varies                     | Catalog API; personalized library requires Music User Token                |
| Search                | Web API, app access/quota dependent                                 | Catalog/library API, authorization and storefront dependent                |
| Current playback      | Web API and SDK state for authorized user                           | Local MusicKit instance state; no universal other-device inventory claimed |
| Remote device control | Connect/Web API, eligible active unrestricted device                | Not established for this web integration                                   |
| Browser playback      | Web Playback SDK, Premium and compatible DRM/browser                | MusicKit JS, authorization/subscription and compatible browser             |
| Seek                  | Web API/SDK, track/device restrictions                              | MusicKit local seek, content restrictions                                  |
| Play/pause/skip       | Web API/SDK; actual disallow flags respected                        | MusicKit local standard controls; user initiates playback                  |
| Queue                 | Web API queue endpoints, access dependent                           | MusicKit local setQueue/playNext/playLater                                 |
| Playback rate         | No supported arbitrary music-rate control established               | No supported arbitrary music-rate control established                      |
| Volume/mute           | SDK local volume; remote devices advertise supports_volume          | Local MusicKit volume; browser/device limits require validation            |
| Device requirement    | SDK browser device or an eligible Connect device                    | Compatible local web player, not a remote-device promise                   |
| Subscription          | Premium for streaming; development owner Premium                    | Apple Music subscription for full authorized catalog playback              |
| Room-sync eligibility | Not enabled; no approval for this product established               | Not enabled; no documented permission established                          |
| Commercial/public app | Streaming commercial restrictions; extended access approval         | Music access cannot be indirectly monetized; program/identity terms apply  |
| Shipped here          | None                                                                | None                                                                       |

Playback/control references: [Spotify SDK reference](https://developer.spotify.com/documentation/web-playback-sdk/reference), [Web API playback](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback), [device capability flags](https://developer.spotify.com/documentation/web-api/reference/get-a-users-available-devices), and [MusicKit JS instance](https://js-cdn.music.apple.com/musickit/v3/docs/index.html?path=/story/reference-javascript-musickit-instance--page). Technical availability does not establish contractual eligibility or successful live playback.

## Architecture, data and configuration

Future permitted adapters must register under Phase 09's provider-neutral personal-player contract, independently disable, isolate outages, and share the existing single player/tile/controller family. Core, RoomShell, WorkspaceHost, RTC, capture, room media and Pomodoro ownership remain unchanged. No direct Pomodoro→game coupling or concrete game imports were introduced; games have not been implemented.

- Database migrations: **none**. No database, migration ledger, volume, identity or development state was reset or changed.
- Configuration/environment changes: **none**. No new required secret names or default secrets were introduced.
- Persistent provider token model: **not implemented**. Any later server persistence requires application-owned authenticated encryption, actor-scoped access, unlink/revocation and safe token lifecycle handling. Do not describe that intended model as delivered.
- No deployment, SSH, live DNS, OAuth console or Vultr action occurred. No secrets were requested or rotated.

## Validation and live-provider status

Executed: bounded official-source fetch/inspection, Prettier check on the three changed documents, `git diff --check`, and the checkpoint integrity comparison: **805 baseline files unchanged**, with only the two coordination files modified and this report added. The previous history and coordination text are preserved verbatim beneath the new entries. Product source, migrations, historical reports and references have no differences. Evidence: `.local/validation/phase10/integrity.json`. No product source changed, so application unit/service/browser/build suites were not rerun. Phase 09's older test totals are not presented as Phase 10 validation.

Not executed: account linking/callback/unlink/refresh, token encryption/lifecycle, hostile-client authorization/privacy tests, provider disable/outage tests or live playback. There is no provider implementation to test yet. No provider credentials or accounts were used; live validation is **not attempted**, rather than falsely attributed only to absent credentials. Broader final validation after Phase 11 is not reached.

## Blockers and deferred work

1. **Secure Apple integration pending:** supported credential handling and its runtime/storage/security tests remain required.
2. **Spotify product-policy clearance pending:** the app's mixed-media/game use is not established as permitted; no API/SDK behavior is enabled.
3. **Inherited completion gate:** Phase 09's known high dependency audit remains unresolved; no fresh audit or resolution is claimed.

Account linking/playback, encrypted persistent-token migration if needed, independent provider switches and the required deterministic/integration/hostile/privacy/live validations remain **undelivered Phase 10 work**, not optional polish. External-link fallbacks were not substituted after the owner's response. Room synchronization is intentionally omitted. Phase 11 activities and every Phase 12+ feature remain unstarted.

Ready for next phase: **NO**. Keep Phase 10 active and pending; do not mark COMPLETE or ACCEPTED, and do not begin Phase 11 while this continuation gate remains unsatisfied.
