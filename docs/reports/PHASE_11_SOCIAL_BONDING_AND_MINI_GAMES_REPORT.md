# Phase 11 — Social Bonding & Mini-Games

Date: 2026-10-03. Scope: current-repository source development only.

Status: **COMPLETE — OWNER-APPROVED DEPENDENCY-SECURITY EXCEPTIONS RECORDED; PHASE 11 ACCEPTED.** Phase 11 source implementation is finished. No COMPLETE or owner acceptance is claimed because the unwaived UMBRELLA_SPEC §64 security gate remains unsatisfied. This is an inherited repository gate applying to Phase 11, not a new activity-specific defect.

## Owner sequencing exception

The owner's explicit 2026-10-03 instruction authorizes Phase 11 despite the roadmap prerequisite. Phase 10 remains **IN_PROGRESS — PENDING SECURE APPLE INTEGRATION / HALTED**, with unresolved Spotify policy and Apple credential-storage questions. Its report and historical coordination remain intact. This exception changes sequencing only: it does not accept, complete, resolve or supersede Phase 10, waive Phase 11 security requirements, or resolve Phase 09's inherited audit. Phase 12 and Phase 10 continuation are unauthorized.

## Implemented

- Generic ActivityRegistry, SDK definition hooks and one feature-owned authoritative runner, with exactly two original initial activities.
- **Letter Lantern:** cooperative five-letter ASCII word puzzle, six accepted attempts per round, duplicate-letter-aware evaluation, server-computed scores, timed rounds and answer reveal after a round ends.
- **Sketch Circle:** server-assigned drawer queue, private prompt, bounded freehand strokes, guesses, first-correct scoring, three-second transitions and timed turns. Owner-only bounded custom prompt packs are optional and ephemeral.
- Explicit offer, join, decline, spectate, leave, begin, cancel and report actions. Late participants may spectate; participant admission closes when play begins. Ignoring or leaving a game retains normal room membership and controls.
- Owner-configurable launch policies and temporary owner-absent policy, friends-only admission/projection, pairwise block checks, current-role revalidation and moderator cancellation/report review.
- A dismissible optional break suggestion, device/account-scoped suggestion preferences, independent Activity SFX mute/volume and synthesized preview/score sounds.
- Compact WorkspaceHost card using existing drag, resize, snap, minimize, fullscreen and popout ownership. Optional cards do not open on room entry or presentation presets, alter default-card indexing or impose unused minimum sizes on default snap geometry.

## Architecture/modules added or changed

New module: `packages/features/activities`, exported as `@study/activities/server` and `/browser`. Its original rule implementations, curated vocabulary and provenance are owned there. New contracts and SDK types live in `packages/contracts/src/activities.ts` and `packages/feature-sdk/src/activities.ts`.

API composition registers `apps/api/src/activities.ts` through existing operation/HTTP/realtime registries. Application migration and generated-contract composition collect the module. No transport switch or second socket exists. Identity, room-role, social-directory and occupancy ports supply authorization; raw LiveKit membership is never social authority. A separately registered fixture activity demonstrates the stable definition interface without modifying core or unrelated features.

Web composition owns `room/activities.ts`, its model and four activity components. RoomShell has generic notification hosting and respects SDK `openByDefault` metadata; it contains no concrete activity logic/import. Settings hosts refresh contribution context on opening so registrations added after preview mount become visible. `mediaMixer` is a generic registered extension point alongside the existing personal-player `mediaPanel`; Activity SFX renders independently of that player tab. No window manager or duplicate media/camera owner was introduced. Chat does not parse activity commands or import games.

See [activity architecture](../architecture/ACTIVITIES.md) for ownership, legal transitions, bounds and deployment implications.

## Database migrations

Added **`activities/0001_activities`**, from `packages/features/activities/migrations/0001_activities.sql`: new `activities.settings` table keyed by room UUID, room deletion cascade, JSON object constraint and existing runtime-role DML grants. Only owner permission settings persist. No strokes, guesses, scores, prompts or leaderboard persist.

The application manifest collects this migration independently of enablement. It was exercised only against the guarded local `study_test` database. **No development or live migration was applied.** All 20 inherited migration files remain byte-identical. Existing dedicated test-database reconstruction fixtures now include the activity-owned schema; no development database or Docker volume was reset.

Development database inspection was read-only. All 22 tables, row digests, columns and migration ledger matched the fresh snapshot taken before the broad browser regression. The older Phase 09 snapshot had three differing digests (`core.sessions`, `pomodoro.personal_timers`, `rooms.memberships`) with unchanged counts/columns; that comparison is retained and is not presented as a task-start baseline. No development DML was issued by this task, and the activity migration is absent there.

## Configuration/environment changes

- `ACTIVITIES_ENABLED=true`: strictly parsed API deployment flag; false removes routes, realtime bindings, subscriptions, jobs and capability registration. Social disablement also disables activities.
- `NUXT_PUBLIC_ACTIVITIES_ENABLED=true`: browser rollout flag; false registers no activity owner, card, listener, suggestion or mixer contribution. Configure both switches consistently.
- Both switches are documented in `.env.example` and forwarded by source Compose configuration. Existing containers were not rebuilt/refreshed with this configuration.
- Internal `@study/activities` workspace dependency added to API/web; no third-party package or version changed. `validate:phase11` delegates to the existing validation chain.

## Realtime authority and lifecycle

Server state owns UUID identity, opt-in activity membership/spectator mode, creator management, lifecycle, round, drawer queue, deadlines, guesses, accepted results, strokes and scores. Clients send meaningful actions with activity/room/round/version/request IDs; they never supply authority fields. Strict revision checks and bounded replay history reject stale/repeated commands. The client samples the latest authoritative snapshot before membership/play actions to reduce conflicts between periodic broadcasts. It preserves the selected activity ID and the guess/drawing round rather than silently submitting into a replacement game or new round; concurrent stale actions still fail and refresh normally.

Lobby → active → transition → active/completed, with cancellation of unfinished activities. Creator departure transfers management to the next participant; loss of the game's minimum cancels. Drawer departure advances through transition. Explicit activity leave, revoked roles and blocks take effect immediately. Because Presence immediately retires closed sockets, the activity runner retains absent membership for ten seconds while other room occupants remain; absent users cannot act. Reconnecting within that interval recovers the same activity/membership/deadline/snapshot. Fully empty rooms discard activity state immediately. An API process restart also discards it.

Deadlines use server timestamps with clock sampling; a one-second sweep advances rounds. Existing authorized, change-only snapshot delivery has approximately two-second latency. One API process owns ephemeral activity state, matching the accepted room-media deployment limitation.

Word solving awards `(7 - attempts) × 20` to the solver and 10 to other participants. Drawing gives 100 to each first correct guesser and 50 to the drawer. Correct guesses are masked as “Correct” until reveal. These scores are casual ephemeral feedback.

## Security controls/tests

All protected actions reuse session, Origin, CSRF, schema, permission, rate and output-buffer boundaries. The runner serializes per room, rechecks roles under the existing Rooms transaction lock and commits new ephemeral state only after the database transaction succeeds. Identity comes exclusively from the session. Spectators and nonparticipants cannot play; only the current drawer can draw or clear. Current room membership, occupancy, blocks and friendship are revalidated. Owner-only configuration/custom packs remain server rules.

Tests explicitly attempt unknown/forged activity and room IDs, cross-room actions, unauthenticated/non-member calls, forged actor/role/owner/score/winner/drawer/turn fields, missing CSRF, hostile Origin, GET mutation, spectator/non-drawer actions, impossible begin, stale round/version, replay, giant guesses, excessive strokes/points and nonfinite/out-of-range coordinates. Real HTTP and manually constructed WebSocket messages exercise registry enforcement; existing session/revocation/transport regressions cover the shared authentication boundary.

Bounds: 200 activity rooms/start histories; 12 participants and 12 spectators; 24 encountered identities; 128 command IDs and 64 start IDs per room (ten-minute start retention); five-minute lobby/terminal retention; 1–3 cycles; 30–180-second turns; six word attempts; 20 displayed drawing guesses. Drawing accepts at most four strokes per action, 64 finite normalized points per stroke, widths 1–12, four ink colors, an 8KiB serialized action and a 40-stroke/512-point snapshot. Invalid batches never commit/broadcast. Drawing allows two accepted batches per second, guesses five per ten seconds, alongside shared transport/operation limits. Pointer sampling sends on lift; there is no database write per movement.

## Pomodoro/event integration

Pomodoro's public browser observer emits through the shared `timer.break.started` contract and application EventBus. The productivity owner observes private/shared public snapshots independently of the panel subscription, with bounded, nonoverlapping polling and a server clock sample. Games consume only the generic event. No game imports Pomodoro internals, and Pomodoro imports no game. First/reconnect snapshots do not manufacture breaks. Local preference, Not now and dismiss control suggestions; no event starts, joins or opens an activity automatically. Personal timer state is not broadcast to room peers.

## SFX/mixer integration

Version-one `activities.preferences.<account UUID>` records use the existing IndexedDB/fallback adapter. Defaults: suggestions on, sounds muted, volume 0.15. Local mixer changes persist independently of RTC, room media, Personal Player and ambience. The injected SDK AudioEffects port uses the existing ambience AudioContext with independent short sine tones and gain nodes; no second production AudioContext exists. Preview supplies the browser audio gesture. Enabling SFX does not enable ambience playback; the original shared audio owner disposes resources. Storage failure uses explicit temporary-preference/error feedback.

## Accessibility and responsive/browser validation

Semantic named buttons, labelled inputs, keyboard word submission and predictable guess focus; letter evaluation uses labels/symbols/border styles as well as color. Activity/drawer/round/countdown state is readable. Surrounding drawing controls and join/spectate/leave work with keyboard input; freehand drawing has inherent pointer accessibility limits. Normal pointer/touch capture and the accepted workspace controls remain. No forced animation or modal game mode is introduced.

Review images cover 360×800, 768×1024, 1440×1000 and 2560×1080 plus the existing popout. The mobile activity card avoids participant-rail overlap and horizontal overflow, with 44px touch controls. The optional suggestion remains dismissible without a modal or auto-start. See the [review image index](../references/phase11/README.md). These are Chromium viewport checks, not native touch-device or screen-reader certification.

## Tests executed

| Check                                                      | Actual result                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Prerequisite architecture/security/authentication boundary | 42/42 passed before implementation                                                               |
| Final focused activity unit/service regression             | 26/26 passed, including reconnect grace and absent-user denial                                   |
| Client revision regression                                 | 2/2 passed: fresh membership revision and no guess replay into a later round                     |
| Workspace unit regression                                  | 12/12 passed, including optional registration preserving default snap geometry                   |
| `npm test`                                                 | 282/282 passed across 45 files after optional-card geometry correction                           |
| `npm run test:services`                                    | 88/88 passed across seven files after dedicated fixture repair and final server correction       |
| `npm run contracts:check`                                  | Generated schemas match                                                                          |
| `npm run lint`                                             | ESLint and architecture boundaries passed                                                        |
| `npm run typecheck`                                        | Root and Nuxt passed                                                                             |
| `npm run build`                                            | API and Nuxt production build passed                                                             |
| `npm run security:source` / `security:secrets`             | Passed; no leaks found within scanner bounds                                                     |
| Broader browser regression (35 selected cases / 14 files)  | 31/35 passed; four default-layout failures, original run preserved                               |
| Scoped browser layout recovery (seven selected cases)      | 6/7 passed; all four layout failures repaired; word fixture assumed minimized cards              |
| Final corrected word browser case                          | 1/1 passed after fixture correction, against the same final production build                     |
| Production browser disable switch                          | 1/1 passed: no action/card/SFX/suggestion; Pomodoro remains usable                               |
| `npm audit --json`                                         | Non-green: 11 high, 2 moderate, 2 low; no critical                                               |
| `npm run validate:phase11`                                 | Stops at two unchanged inherited formatting exceptions; aggregate is not green                   |
| Historical integrity                                       | 20 migrations, 340 references, 24 reports and 987 existing external dependency entries unchanged |

Evidence logs live under `.local/validation/phase11/`. The first browser attempt used an older build and was stopped; subsequent failed runs exposed delayed settings contributions, automatic duplicate card instances, reconnect cancellation and outdated test selectors. A synthetic-media fixture closed its AudioContext twice during native track cleanup; its stop helper is now idempotent, without altering production RTC ownership. Those results are retained separately and are not green browser evidence. Each real defect has focused regression coverage. The first broad service run failed its setup with an orphaned activity schema in the dedicated test database (13 passed/75 skipped); the repaired full run passed 88/88. No skipped initial run is counted as a pass.

The one broader browser run selected `activities`, `identity-rooms`, `social`, `productivity-refresh`, `room-stability`, `room-workspace`, `room-media`, `media-refresh`, `personal-media`, `rtc-live`, `rtc-sfu`, `rtc-quality`, `accessibility-platform` and `nuxt-modules` specs. All three activity cases and the media/real RTC/SFU cases passed. Four existing cases failed because unused optional-card metadata changed default snap minima/indexing and minimized Chat/Clock. The generic correction now excludes unopened optional cards from default placement/minima, with a unit regression. A fresh API/Nuxt production build preceded the seven-case scoped repair: all four failed existing cases, drawing and break preferences passed. Its word case failed only because its fixture still required Restore Tasks/Chat; the corrected one-case rerun passed. **This is 31/35 broad evidence plus separate 6/7 and 1/1 repair evidence, not a clean 35/35 full run.** Relevant logs: `browser-regression.log`, `browser-layout-recovery.log`, `browser-word-final.log`; traces are retained in their corresponding results directories. No unrelated complete browser suite or image rebuild is claimed.

The separate production-runtime browser false-switch case passed **1/1**, confirming absence of the launch action, card, SFX mixer and break suggestion while Pomodoro still works (`browser-disabled-final.log`). API-disabled behavior is independently covered by the real service test. Final review images and reachable 44px mobile suggestion controls were checked after the corrected build. Historical reference captures overwritten by existing browser specs were preserved under `.local/validation/phase11/regression-references/` before restoring the original bytes.

## Known limitations and dependency-security disposition
UMBRELLA_SPEC §64 was revised on 2026-10-04 to distinguish deployed-runtime dependency risk from repository/build-only findings. After non-breaking remediation, Fastify was upgraded to 5.12.5 and the API runtime dependency graph was isolated. The remaining repository-level HIGH findings are `braces` (GHSA-vfj7-8cjw-p6xm) and `node-forge` (GHSA-86w9-cpqp-85rv). Both were verified absent and not resolvable in the final web and API runtime images. The owner explicitly approved the documented dependency-security exceptions for these two findings on 2026-10-04. They therefore no longer block Phase 11 completion under the revised §64 gate. Phase 09's historical audit evidence remains preserved and is not rewritten by this later remediation.

Activity state is process-local/ephemeral; multi-instance coordination and restart recovery are not implemented. Fully empty rooms lose the activity immediately; a reconnect after ten seconds may lose participation. Drawing sends on lift and uses two-second snapshots, so it is suitable for casual sketches rather than a collaborative design canvas; overflow requires the drawer to clear. Concurrent stale revisions can still require retry. English ASCII vocabulary is deliberately small; arbitrary accepted guesses are evaluated without claiming dictionary validation. Custom packs are owner-controlled and bounded, with manual report/cancel moderation; no automated content classifier or persistent moderation archive is claimed. SFX requires an audio-enabling gesture. Browser autoplay, storage availability and popout support retain platform limits. Native Safari/Firefox, hardware touch and assistive-technology certification were not performed.

The secret scanner's existing 2MB limit skips large inherited image/binary files. The two preserved formatting exceptions are `docs/references/mid01/corrections-2026-09-20/layout-matrix.json` and `ready-reveal.json`. Docker image rebuilding/deployment testing was not performed because this request authorizes source development only. Local PostgreSQL, Redis and LiveKit prerequisites were started without replacing containers or resetting volumes. No SSH, Vultr, live data, DNS, OAuth, Cloudflare, firewall or production operation occurred.

## Deferred intentionally

Trivia, word association, icebreakers, board/card expansion, matchmaking, persistent economy/leaderboards, larger/licensed vocabularies, distributed activity ownership, permanent drawings/moderation history, Phase 10 provider work, Phase 12 and later roadmap work.

Ready for next phase: **YES**, subject to explicit owner authorization. Phase 11 is complete and accepted. Phase 10 remains separately halted/pending and is not resolved or superseded by this acceptance. No Phase 12 implementation or live deployment is authorized by this report.

### Dependency Security Review

The inherited dependency gate was re-reviewed after Phase 11 implementation.

Remediation completed:
- `fastify` was upgraded from `5.12.3` to `5.12.5`.
- non-breaking `npm audit fix` remediation was applied for patchable findings.
- the API runtime Docker image was changed to install only the `@study/api` production dependency graph instead of copying the full monorepo `node_modules`.

Remaining repository-level HIGH findings:

1. `braces`
   - Advisory: `GHSA-vfj7-8cjw-p6xm`
   - Dependency path: Nuxt/Nitro tooling → `globby` / `fast-glob` → `micromatch` → `braces`
   - Finding class: repository/build dependency tree
   - Web runtime image: absent / not resolvable
   - API runtime image: absent / not resolvable after runtime dependency isolation
   - Runtime reachability: none demonstrated; package is not present in either deployed application runtime image
   - Current remediation: no safer non-breaking application-level remediation available; monitor upstream dependency updates

2. `node-forge`
   - Advisory: `GHSA-86w9-cpqp-85rv`
   - Dependency path: Nuxt/Nitro → `listhen` → `node-forge`
   - Finding class: repository/build dependency tree
   - Web runtime image: absent / not resolvable
   - API runtime image: absent / not resolvable after runtime dependency isolation
   - Runtime reachability: none demonstrated; package is not present in either deployed application runtime image
   - `npm audit fix --force` would downgrade Nuxt to `3.15.1` and is therefore not an acceptable remediation
   - Current remediation: monitor upstream Nuxt/Nitro/listhen dependency updates

Runtime validation:
- `fastify@5.12.5` resolves in the API runtime image
- `node-forge` does not resolve in the API runtime image
- `braces` does not resolve in the API runtime image
- `node-forge` does not resolve in the web runtime image
- `braces` does not resolve in the web runtime image
- API service tests: 88/88 passed after remediation
- typecheck passed after remediation
- production build passed after remediation

Under UMBRELLA_SPEC §64, these remaining HIGH findings qualify only for a documented dependency-security exception because they are absent from the deployed application runtime artifacts.

Owner approval: APPROVED 2026-10-04 — owner explicitly accepted the documented dependency-security exceptions for `braces` (GHSA-vfj7-8cjw-p6xm) and `node-forge` (GHSA-86w9-cpqp-85rv) on the basis that both findings are absent from the deployed web and API runtime artifacts.
Follow-up: re-review these advisories whenever Nuxt, Nitro, listhen, micromatch, fast-glob, globby, or braces receive relevant upstream security releases.
