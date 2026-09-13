# Phase 08 — Room Media, Ambience & Shared Mix

2026-09-13. **Status: AWAITING_REVIEW — implementation and validation complete.** Phase 07 is accepted. Phase 08 is not accepted. Phase 09 is not started.

Implemented: a secondary Media dock panel, shared YouTube queue/play/pause/seek/rate, compatible YouTube Music URL normalization, independently mixed original ambience, local listening preferences, suggestions, server-owned media permission settings, durable owner baseline, ephemeral participant/FFA overrides, owner keep/restore/review and empty-room reset. Visual playback uses one user-opened draggable/resizable workspace tile. Existing room hierarchy remains intact.

Architecture: `@study/room-media`, versioned contracts and SDK provider/occupancy ports, API/browser composition modules, the YouTube IFrame adapter and a private presence occupancy event. HTTPS/WebSocket carry control state only; clients stream from YouTube directly. See [architecture](../architecture/ROOM_MEDIA.md) for the full sync algorithm, storage and authority rules.

Persistence: new `room-media/0001_room_media` migration owns `room_media.baselines`; all prior migrations are preserved. Only owner-approved state and permission settings persist in PostgreSQL. Session changes/suggestions/controller/version live in the single API process. Restart creates a new epoch and restores the durable baseline. Account/device mix and personal ambience use IndexedDB with memory fallback; no private player history or credentials persist.

Ambience sources: project-original rain/white/pink/brown procedural noise, no external recordings. [Provenance](../../packages/features/room-media/provenance.json) records all four sources. Shared layer gains and per-user levels are distinct; changing local volume/mute/personal ambience never sends a shared command. Voices remain independent.

Authority: normal everyone/suggestions/moderators/owner policy and separate owner-absent FFA/moderators/preserve policy. Only the owner changes permanent media settings or approves a baseline. Non-owner changes never silently overwrite it. Owner return shows changer identities and baseline/current comparisons. Keep current promotes; Restore mine restores; zero occupancy clears temporary state. Server-private validated leases prevent hidden presence from manufacturing owner absence. Current sessions, membership, owner blocks, CSRF/Origin, roles, strict provider IDs, versions and rates remain enforced.

Browser/provider limits: YouTube requires an explicitly enabled, visible embed. Closing/minimizing/hiding pauses local playback. Autoplay, ads, geography, publisher restrictions, live media and buffering can prevent synchronization. Credentialless iframe support is required to preserve the app’s strict COEP isolation; provider sign-in cookies are unavailable in that embed. Provider errors remain local; controllers explicitly select/remove unavailable or ended items. No auto-skip consensus or media proxy is claimed. See the validation evidence below for the real-provider probe outcome, separate from deterministic mock synchronization tests.

Configuration: `ROOM_MEDIA_ENABLED` (default true; requires social presence), scoped YouTube CSP/iframe permissions/referrer configuration, no provider keys or new external npm dependencies. Existing single-process authority and 65-second unexpected-disconnect lease bound remain; horizontal authority is not implemented.

## Validation

Pre-implementation baseline: 176 unit/integration/security/architecture tests passed. Final `npm run validate:phase08` **passed, exit 0: 280 tests, no skips**, including the complete Phase 00–07 chain. Evidence: `.local/validation/phase08-validation-complete.log`.

| Check                                                          | Result                                |
| -------------------------------------------------------------- | ------------------------------------- |
| Unit, HTTP/integration, provider/security and architecture     | 186 passed                            |
| Real PostgreSQL/Redis service regressions                      | 67 passed                             |
| HTTPS Chromium, including existing real SFU scenarios          | 25 passed                             |
| Refreshed Docker/Caddy/LiveKit readiness                       | 2 passed                              |
| Formatting, lint/boundaries, package/API and Nuxt types        | Passed                                |
| Generated OpenAPI/JSON Schema drift, source security, Gitleaks | Passed                                |
| Dependency audit                                               | Passed; zero reported vulnerabilities |
| API and Nuxt production builds                                 | Passed                                |

New coverage includes timestamp play/pause/seek/rate and late joins, drift tolerance and buffering, queue removal/selection, stale epoch/version conflicts and simultaneous writers, all authority modes, owner-baseline promotion/restoration, private presence and immediate empty/rejoin reset, durable restart recovery, local/shared mix separation, preference persistence, original ambience provenance, strict provider identifiers, forged roles/IDs, CSRF/Origin/sessions, removed membership, blocks, suggestion quotas and disabled operations. Architecture tests follow the YouTube adapter and enforce the new feature's SQL ownership.

Browser tests use the real API/leases and an explicitly labeled deterministic provider mock for two-client synchronization. They also verify local mix isolation, reload/recovery, keyboard focus, a single workspace embed, CSP/COEP and desktop/tablet/320px rendering. Separately, the real YouTube probe in the full chain reported Playing at approximately 10.25 seconds; it records actual provider state, not a mock result. Detailed evidence is `.local/validation/phase08-real-youtube.json` and `phase08-real-youtube.png`. External provider availability remains variable.

A separate **real two-client YouTube check passed** after the full chain, without provider mocks. Both isolated browsers streamed the same public YouTube sample directly, rendered actual decoded video frames and remained playing for five consecutive observations after the second client joined. Following initial buffering, observed playhead differences were approximately **2.5–9.7 ms** across those roughly one-second samples. Decoded frame counters increased from 214 to 336 for the owner and 118 to 241 for the late joiner. These are short, separately sampled local observations, not an audible/sample-alignment or universal network guarantee. The acceptance threshold was 2.5 seconds; the implementation normally corrects drift over 1.5 seconds.

Live evidence: `.local/validation/phase08-live-pair.json`, `phase08-live-pair.log`, `phase08-live-owner.png`, `phase08-live-late-joiner.png`. The supplementary probe/config are `.local/phase08-live-pair.spec.ts` and `.local/phase08-live.config.ts`; run with `npx playwright test --config .local/phase08-live.config.ts`. This observational public-provider check is separate from the repeatable canonical regression chain. No media was downloaded or rebroadcast by the application.

Initial full-chain attempts exposed an obsolete bare-composition Media-placeholder assertion and schema-reset fixtures that omitted the new test schema. These fixtures were updated, the complete real-service suite passed, and the entire chain was rerun successfully. No assertion for an accepted product behavior was removed, no test was skipped and no existing migration was rewritten. The Media feature supplies the canonical dock control; the bare composition retains only core controls.

`npm run dev` also passed, rebuilding and refreshing the local stack and applying the additive migration without resetting development volumes. Log: `.local/phase08-compose.log`. Final Docker readiness tests ran against that refreshed deployment.

Screenshots visually reviewed: `.local/validation/phase08-media-desktop.png`, `phase08-media-mobile.png`, `phase08-media-tablet.png` and the real-provider tile. The room remains background-first, with controls in a secondary dialog and a video tile only on explicit request. Browser coverage uses local Chromium and synthetic capture for existing RTC scenarios; no Safari/Firefox, physical audio fidelity, public NAT/TURN or geographically universal YouTube compatibility is claimed.

## Intentionally deferred

Phase 09 Personal Study Player, personal URL/history/progress, ducking; Phase 10 Spotify/Apple Music; OBS; copyrighted audio samples; metadata/search APIs; automatic queue advancement; distributed media authority; broad browser/hardware/geographical provider certification.

Ready for next phase: NO — owner review and explicit authorization are required.

Ready for owner review: **YES**. Coordination remains `ACTIVE_PHASE: 08`, `STATUS: AWAITING_REVIEW`. Stop for owner review; do not begin Phase 09.
