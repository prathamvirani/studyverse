# Phase 09 — Personal Study Player

Date: 2026-10-03. Status: **IN_PROGRESS — COMPLETION BLOCKED BY INHERITED DEPENDENCY AUDIT**. Functional implementation and validation are finished and available for review; the umbrella completion gate remains unresolved. No acceptance or later-phase authorization is claimed.

The current inherited repository was preserved as the implementation baseline, including accepted Phase 08 and the refresh work awaiting review. The complete umbrella/Phase 09 specifications and relevant room/workspace/media/RTC/persistence/security/companion architecture and reports were read before implementation. Baseline hashes and inherited evidence backups are in `.local/validation/phase09/`. No repository reset, commit, database reset or unrelated dependency upgrade was performed.

## Implemented

- Private Study Player tab in the existing Media panel; one draggable/resizable private video tile, visible minimized presentation, controller-only companion, local resume/start-over, rate/seek/play/pause, local recents and listening settings.
- One personal playback owner shared by all controls. Reopen/reload restores canonical identity, progress, supported rate, volume/mute and safe tile geometry. Close releases its renderer; minimize retains the same visible instance. Phone open uses the existing fullscreen presentation at widths up to 360px.
- Typed provider registration for personal YouTube, public Vimeo and practical public same-origin direct MP4/WebM. Unknown/private/signed/portal links fail without replacing a valid selection or proxying credentials.
- Device-local IndexedDB history and preferences with bounded/debounced writes, safe canonicalization, history deduplication/cap, persistence controls and clear-local-data action. Early-close, delayed-provider and clear/unmount races have regression coverage.
- Independent personal volume/mute, local room-music ducking and opt-in personal voice ducking from existing authorized RTC activity. Shared queue/mix authority, ambience, microphone and device volumes remain distinct.
- Explicit selected public YouTube promotion through existing authorized room control/suggestion/review flows. Only the public video ID and existing command/revision fields are transmitted.
- Progressive local MediaSession controls where supported, with owner-bound action handlers and teardown.

## Architecture/modules added or changed

The [personal player architecture](../architecture/PERSONAL_STUDY_PLAYER.md) documents the full ownership, adapter, persistence, privacy and lifecycle contract.

New modules: `@study/personal-media`, SDK personal-media ports, shared canonical YouTube identity contract, personal YouTube adapter, Vimeo adapter, direct-media adapter, app registration/model, personal panel/video/control components and local MediaSession helper.

Existing extensions: optional title/abort/rate metadata on the accepted YouTube provider port; generic Media panel contribution host; a local effective duck gain on the existing room provider; read-only authorized RTC activity access; RoomPage registration/disposal; app package/workspace lock, feature switch and scoped provider headers. RoomShell, WorkspaceHost, RTC/capture/publication owners, ambience engine, server room-media schemas and migrations retain their accepted architecture. Static negative cases reject core-to-personal, shared-to-personal, feature-to-provider and SDK-to-provider dependencies.

### Supported providers and capabilities

| Provider        | Implemented playback                                                                     | Rate                                                             | Private resume                                            | Promotion                                      | Measured live boundary                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| YouTube         | Existing visible IFrame API player; public normalized identity; play/pause/seek/duration | Provider-advertised options                                      | Local canonical ID/position/rate                          | Existing control or suggestion, public ID only | Actual embed advanced, one iframe, no app page exceptions                                                         |
| Vimeo           | Public numeric visible Player SDK embed; play/pause/seek/title/duration                  | 1× only; publisher-dependent speed is not universally advertised | Local identity/position; deterministic adapter regression | Unsupported                                    | Actual SDK/iframe/title/duration loaded; sample returned provider PlaybackError/401 responses and did not advance |
| Direct MP4/WebM | Public same-origin HTTPS native video, browser format support                            | 0.5–2×                                                           | Local canonical path/position/rate                        | Unsupported                                    | Actual generated VP8 WebM decoded at 320px and advanced in Chromium                                               |

The Vimeo live observation is **not** a successful playback/resume certificate. Deterministic Vimeo tests verify the adapter/control/persistence lifecycle, while unavailable provider playback remains a clear local error. No credentials or signed provider CDN URL are imported into application state to bypass the restriction. Direct media is deliberately same-origin; arbitrary cross-origin files, university portals, signed URLs, HLS/DASH/transcoding and credential proxies are outside this implementation.

Provider references: [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference), [minimum provider requirements](https://developers.google.com/youtube/terms/required-minimum-functionality), [Vimeo Player SDK](https://github.com/vimeo/player.js), [HTMLMediaElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement), and [quoted Permissions-Policy origins](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy).

## Database migrations

- **None.** No personal server history/progress/preferences table, API or realtime operation was added.
- IndexedDB database remains `study-preferences-v1`, schema version **1**, existing `preferences` store. New key `personal-media.player.<user UUID>` uses record version **1**; no database upgrade/clearing is needed.
- A previous-v1-store test retains an unrelated existing preference. Invalid/stale/forged sources are revalidated; unsupported entries are discarded safely.
- Development-data, migration-file and historical-reference integrity checks are recorded in the final operating evidence below.

## Configuration/environment changes

- `NUXT_PUBLIC_PERSONAL_MEDIA_ENABLED=true` by default; documented in `.env.example` and passed to the Compose web service. False registers no personal owner, renderer, panel or timer. No provider account, secret, OAuth or backend feature flag is needed.
- CSP retains strict nonce/strict-dynamic script policy and COEP, scopes Vimeo script/frame origins, allows the fixed browser YouTube oEmbed origin and keeps direct media same-origin/blob. No arbitrary media/connect/frame origin is allowed.
- Provider playback/fullscreen/PiP/encrypted-media permissions are scoped to quoted YouTube/Vimeo origins. Camera, microphone and display-capture remain self-only. Vimeo SDK uses anonymous CORS to satisfy COEP; credentialless iframe support remains required under isolation.
- Internal `@study/personal-media` workspace dependency and lock link; **no external package added**. `validate:phase09` delegates to the existing regression chain and does not bypass audit or formatting gates.

## Privacy/security controls and verification

The personal module has no REST/WebSocket binding, presence contribution, server metadata request, analytic event or ordinary-client debug payload. Its preference store is account/device scoped. Providers receive only the user's explicitly selected normalized public identity through direct provider loading. Application privacy does not imply anonymity from that provider or protection from someone with access to the same device/browser.

The two-account browser test opens personal media for A while B joins the same room, inspects A's outbound API/WebSocket frames, B's local personal store and the real room-media snapshot, and proves the shared revision/state is unchanged by private playback, seek, rate, volume and geometry. B receives no personal identity/title/history/progress/mix/placement. Existing presence/room/service privacy regressions cover authorized projections; no new personal payload exists to query. Unknown personal-history/progress/preferences REST routes return 404 and the realtime name is rejected.

Explicit promotion sends only one supported public YouTube ID through existing room authority. Real service cases demonstrate member direct-control denial, valid suggestion and owner acceptance, owner direct play, cross-room denial, revoked membership/socket denial and strict rejection of forged user/role/provider/URL fields. Existing session/CSRF/Origin, owner-block, quota, epoch/version and serialized command controls remain authoritative.

Strict URL/source/history schemas reject credentials, malformed/insecure/foreign/unsupported input and sensitive query persistence. YouTube metadata is a fixed browser oEmbed request with omitted credentials, rejected redirects, 2.5s timeout and 32KB response bound; HTML is ignored. Vimeo private hash links and direct signed query links fail. Direct redirects remain constrained by media CSP. Provider content is not fetched/proxied by the backend. Rendered titles use escaped text. Deletion waits for old writes and prevents unmount/disposal from recreating history.

### Ducking and resource review

Room ducking is an independent local effective gain, default 20%, active only while personal media is playing audibly with ducking enabled. It multiplies configured room output once; no shared command or permanent volume mutation occurs. Pause/end/mute/zero-volume/close/disable restore output smoothly. Repeated transitions and final cleanup have unit/browser coverage.

Voice ducking defaults off and consumes only existing authorized connected/unmuted RTC microphone levels. Speaking uses the existing 0.02 threshold, 600ms hold and a 25% personal gain target. Unavailable/disconnected activity falls back to full personal volume. There is no new permission request, track capture, AudioContext or raw SFU social roster. Unit tests exercise activity/hold/gain recovery. Browser tests exercise unavailable fallback and actual authorized RTC activity with a synthetic published microphone: personal output ducks, restores on mute and makes no additional getUserMedia call. Native hardware voice/listening quality is not certified by those tests.

One owner/iframe survives alternate controls/minimize, companions have zero provider iframes, cancelled/late mounts are fenced, and close/disposal destroy the provider. The 200ms sampling timer and page/document listeners are removed on disposal; optional platform handlers are cleared. Active progress writes are bounded to five-second intervals, control/geometry writes debounce at 400ms, and history is capped at 30 identities. Metadata loads once per owner mount, with bounded YouTube network work. No new audio graph or room workspace host was introduced.

## Tests executed

Evidence logs: `.local/validation/phase09/`.

| Check                                       | Result                                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prerequisite architecture/security          | 34/34 passed after sequential rerun of initial architecture scan timeout                                                                                             |
| Focused final ownership/domain/architecture | 52/52 passed; includes cancelled play intent and provider/clear/early-close regressions                                                                              |
| Broad unit/integration regression           | **255/255 passed**, 42 files, 24.54s after final ownership/header corrections                                                                                        |
| Broad service regression                    | **84/84 passed**, six files, 67.27s, guarded `study_test` database                                                                                                   |
| Focused browser                             | Final **5/5 passed**, 41.4s; privacy/resume/mix/promotion, companion/responsive/clear, Vimeo, native decoded WebM and authorized voice activity                      |
| Appropriate broader browser                 | **41 passed / one capture timeout (42 cases, 9.1m)**; capture repair passed 1/1 and final personal file passed 5/5. This is not an uninterrupted green 42/42 run     |
| Typecheck                                   | Root and Nuxt passed after final ownership/header corrections                                                                                                        |
| Production build                            | API and Nuxt passed after final ownership/header corrections; Windows Nitro output 28.7MB / 10.6MB gzip                                                              |
| Lint / architecture                         | Passed, including final browser-test changes; architecture boundaries passed                                                                                         |
| Generated contracts                         | Match; existing wire schemas retained                                                                                                                                |
| Source/secret scans                         | Passed; no leaks found; scanner's existing >2MB historical image skip is recorded                                                                                    |
| Dependency audit                            | **Non-green: 11 total, 7 high / 2 moderate / 2 low / 0 critical**, inherited                                                                                         |
| Formatting                                  | Scoped check passed, excluding exactly the two unchanged inherited historical JSON exceptions                                                                        |
| Docker / data / evidence integrity          | Linux API/web images built; only web refreshed; **2/2 Docker checks passed**; all 22 development-table digests and inherited migration/reference/report hashes match |

Initial failures are retained separately: fake IndexedDB scheduling under overly broad fake timers was repaired; the initial focused browser run had two successful provider cases and two failures (over-broad speed selector, clear/unmount write race). Both were corrected and the entire four-case focused file passed. Early-close resume and pending play intent also received regression coverage. The live Vimeo probe found COEP script loading and malformed provider Permissions-Policy origins; anonymous CORS, quoted origins and scoped encrypted-media delegation were corrected and validated without relaxing isolation. Final Vimeo sample playback still reports the provider restriction described above. A local opt-in probe config initially needed an explicit repository web-server cwd; its rerun worked. None of these failed runs is reported as uninterrupted green evidence.

Review images and provider observations are described in [Phase 09 evidence](../references/phase09/README.md). Mock iframe screenshots show presentation only; actual provider and direct decoded-video observations are identified separately.

## Final operating evidence and acceptance mapping

The runtime false switch passed its separate production-browser check (1/1): no personal tab/renderer and no provider request were registered. Final actual personal YouTube playback advanced to approximately 1.11s with one iframe and no application page exceptions. The existing shared real-provider probe also observed two playing clients, the same minimized iframe and advancing playback. These bounded observations do not certify arbitrary provider availability or exact synchronization.

The broader run exercised personal/shared media, ambience, workspace, companions, room presence/lifecycle, backgrounds, real RTC/SFU/quality, authentication/CSRF and Nuxt assets. Its sole failure was the newly added companion image capture waiting for the existing about:blank document's unresolved fonts.ready promise. A bounded screenshot attempt confirmed that wait. The final test captures the actual Chromium framebuffer for that review image, preserving all control/one-owner assertions; the repaired case and the final five-case personal file passed. Original broad and scoped font-wait traces remain separate under .local/validation/phase09/. No full-browser aggregate green result is claimed.

Linux Docker API/web images built from source. Only the web container was refreshed; API, PostgreSQL, Redis, LiveKit and Caddy container IDs were preserved. All five configured healthchecks are healthy, Caddy is running, HTTPS / returns 200, and both Docker readiness/SFU-signaling checks passed. No volumes were reset and no migration was run.

The integrity seal verifies **332 inherited reference files, 20 migration SQL files and 22 historical reports** against the task-start hashes, with zero differences. All **22 development tables**, including the migration ledger, have identical row counts/content digests before and after. Inherited references and test-result metadata were restored after preserving this run's raw evidence. The final source overlay is confined to the Phase 09 files listed in .local/validation/phase09/integrity.json. The repository's inherited uncommitted work remains intact.

| Phase 09 functional criterion             | Evidence                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Close/reopen and resume supported media   | IndexedDB/early-close domain tests; personal browser close/reload at 43s; Vimeo fixture resume at 37s                         |
| Progress stays local                      | No personal transport/module; IndexedDB records and outbound REST/WebSocket inspection                                        |
| Another room user cannot query history    | Two-account browser state checks; 404 personal REST routes; rejected realtime operation; existing authorized projections      |
| Clean room-music ducking                  | Effective-gain domain transitions and browser 60% room output -> duck -> 60% restoration without shared revision/mix mutation |
| Unsupported/private source fails safely   | Canonicalization/rejection tests, nondestructive browser source error, live Vimeo restriction without credential proxy        |
| Add adapter without modifying player core | Registered independent fixture adapter, matcher failure isolation and architecture-negative tests                             |

All six functional criteria are demonstrated. The separate umbrella dependency-security gate below remains unsatisfied, so these results do not authorize a COMPLETE/ACCEPTED status or Phase 10.

## Known limitations and completion blocker

The umbrella's §64 requires **“no known high-severity dependency issues.”** The current full audit still reports seven high dependency findings, all from the inherited Nuxt CLI/listhen/node-forge chain. The latest registry release remains node-forge 1.4.0, and the [reviewed advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) lists no patched release. Npm's suggested forced Nuxt downgrade is incompatible with the accepted Nuxt 4 baseline. No audit suppression, unsupported toolchain fork, fabricated acceptance or unrelated broad downgrade was applied. This is a **completion gate**, even though functional Phase 09 criteria are implemented and tested. Production bundle source has no node-forge/listhen import; this narrows observed exposure but does not make the repository audit green. Final coordination remains IN_PROGRESS pending resolution of this gate.

Provider availability, autoplay, regional/publisher/account restrictions, ads/live seekability, DRM and browser codecs can limit playback/rate/resume. Vimeo speed is conservatively 1× and the live sample did not advance. Browsers without credentialless iframe support fail closed under existing COEP; no Firefox/Safari embedding capability is fabricated. MediaSession is progressive. Native Safari, hardware touch/mobile and screen-reader certification were unavailable. IndexedDB memory fallback and abrupt browser/device termination can limit restoration. History stays device-local and is not encrypted against access to this browser profile. Turning recent-history retention off also prevents restoring the selected identity/progress after page exit. The existing about:blank companion font-readiness promise did not settle in the headless capture environment; functional controls and the actual rendered framebuffer were verified, rather than claiming font-readiness certification.

Two inherited historical JSON formatting exceptions remain unchanged; they are outside Phase 09 source. The secret scanner's 2MB size limit skipped large historical images and an ignored local binary; it does not certify those oversized files. The audit/security gate and formatting exceptions mean `validate:phase09` is not claimed green as an aggregate command. Detailed checks above are the actual evidence.

## Deferred intentionally to later phases

Spotify/Apple Music/provider-account OAuth/libraries, cross-device sync, full embedded browsers, university credential proxies, extensions, messaging/scheduling, OBS ingest, native apps and Docker→Podman work were not started. Inherited minor refresh aesthetics remain deferred under the existing owner boundary.

## Ready for next phase

**NO.** The inherited high-severity dependency gate remains unresolved and owner review/acceptance is still required. Phase 10 was not started. Stop after Phase 09 delivery and report the unresolved gate; do not mark COMPLETE or ACCEPTED while it remains.
