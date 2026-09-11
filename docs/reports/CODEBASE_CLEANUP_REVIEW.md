# Codebase cleanup review

2026-09-11. Maintenance after explicit **Phase 06 acceptance**. Phase 06 remains the latest accepted implementation baseline; `ACTIVE_PHASE: 06`, its specification and `STATUS: ACCEPTED` are retained. **Phase 07 was not started and requires explicit owner authorization.**

## Review scope and approach

Read the umbrella, coordination, all seven accepted reports, all fifteen phase specifications, architecture decisions, workspace/package configuration and boundary tests before broad refactoring. Reviewed API composition/HTTP/WebSocket dispatch, core registries/security/session/lifecycle/workspace code, SDK and schemas, all nine feature domains, browser composition/state/resource ownership, adapters, migrations, development/CI tooling and accepted security/service/browser/SFU coverage.

The supplied tree contained extensive uncommitted accepted implementation. It was preserved rather than reset or replaced from Git HEAD. A file-content/hash baseline and task-specific evidence are stored under ignored `.local/validation/cleanup/`. No commit, merge, secret rotation or later product feature was introduced.

The existing feature-package tree was already appropriate. Small semantic renames, removal of replaced demo branches, two dependency extractions and focused lifecycle corrections were preferable to relocating every feature or rewriting established authorization and transport code.

## Renamed files

Paths are repository-relative. No directory was renamed.

| Previous file                                           | Current file                                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/api/src/phase01.ts`                               | `apps/api/src/identity.ts`                                                                         |
| `apps/api/src/phase03.ts`                               | `apps/api/src/social.ts`                                                                           |
| `apps/api/src/phase04.ts`                               | `apps/api/src/productivity.ts`                                                                     |
| `apps/api/src/phase05.ts`                               | `apps/api/src/backgrounds.ts`                                                                      |
| `apps/api/src/phase06.ts`                               | `apps/api/src/rtc.ts`                                                                              |
| `packages/contracts/src/phase01.ts`                     | `packages/contracts/src/identity.ts`                                                               |
| `packages/contracts/src/phase03.ts`                     | `packages/contracts/src/social.ts`                                                                 |
| `packages/contracts/src/phase04.ts`                     | `packages/contracts/src/productivity.ts`                                                           |
| `packages/contracts/src/phase05.ts`                     | `packages/contracts/src/backgrounds.ts`                                                            |
| `packages/contracts/src/phase06.ts`                     | `packages/contracts/src/rtc.ts`                                                                    |
| `scripts/phase01-migrations.ts`                         | `scripts/application-migrations.ts`                                                                |
| `apps/web/app/room/demo.ts`                             | `apps/web/app/room/composition.ts` (retained live composition rewritten without obsolete examples) |
| `packages/adapters/src/livekit/probe.fixture.ts`        | `tests/browser/livekit-probe.ts`                                                                   |
| `tests/unit/phase02.test.ts`                            | `tests/unit/room-workspace.test.ts`                                                                |
| `tests/unit/phase03.test.ts`                            | `tests/unit/social.test.ts`                                                                        |
| `tests/unit/phase04.test.ts`                            | `tests/unit/productivity.test.ts`                                                                  |
| `tests/unit/phase05.test.ts`                            | `tests/unit/backgrounds.test.ts`                                                                   |
| `tests/unit/phase06.test.ts`                            | `tests/unit/rtc.test.ts`                                                                           |
| `tests/services/phase01.test.ts`                        | `tests/services/identity-rooms.test.ts`                                                            |
| `tests/services/phase03.test.ts`                        | `tests/services/social.test.ts`                                                                    |
| `tests/services/phase04.test.ts`                        | `tests/services/productivity.test.ts`                                                              |
| `tests/services/phase05.test.ts`                        | `tests/services/backgrounds.test.ts`                                                               |
| `tests/integration/phase06.test.ts`                     | `tests/integration/rtc.test.ts`                                                                    |
| `tests/browser/phase01.spec.ts`                         | `tests/browser/identity-rooms.spec.ts`                                                             |
| `tests/browser/phase02.spec.ts`                         | `tests/browser/room-workspace.spec.ts`                                                             |
| `tests/browser/phase03.spec.ts`                         | `tests/browser/social.spec.ts`                                                                     |
| `tests/browser/phase04.spec.ts`                         | `tests/browser/productivity.spec.ts`                                                               |
| `tests/browser/phase05.spec.ts`                         | `tests/browser/backgrounds.spec.ts`                                                                |
| `tests/browser/phase06.spec.ts`                         | `tests/browser/rtc.spec.ts`                                                                        |
| `tests/browser/phase06-live.spec.ts`                    | `tests/browser/rtc-live.spec.ts`                                                                   |
| `tests/browser/phase06-sfu.spec.ts`                     | `tests/browser/rtc-sfu.spec.ts`                                                                    |
| `docs/phases/PHASE_14_SOCIAL_BONDING_AND_MINI-GAMES.md` | `docs/phases/PHASE_11_SOCIAL_BONDING_AND_MINI_GAMES.md`                                            |
| `docs/phases/PHASE_11_OBS__STUDIO_INGEST.md`            | `docs/phases/PHASE_12_OBS__STUDIO_INGEST.md`                                                       |
| `docs/phases/PHASE_12_BROWSER_COMPANION_EXTENSION.md`   | `docs/phases/PHASE_13_BROWSER_COMPANION_EXTENSION.md`                                              |
| `docs/phases/PHASE_13_NATIVE_APPLICATIONS.md`           | `docs/phases/PHASE_14_NATIVE_APPLICATIONS.md`                                                      |

Additional extractions: generic SDK definitions moved out of the barrel into `packages/feature-sdk/src/foundation.ts`; background model/lifecycle moved from registration into `apps/web/app/room/background-model.ts`. Public SDK exports remain available. Added `apps/api/src/module-support.ts`, focused regression tests, a test-only camera renderer fixture and the current architecture overview.

## Symbols, dead code and quality changes

- `phase01Modules`, `phase03Modules`, `phase04Modules`, `phase05Modules`, `phase06Modules` became `identityModules`, `socialModules`, `productivityModules`, `backgroundsModules`, `rtcModules`; imports and all callers were updated.
- `phase01MigrationManifest` became `applicationMigrationManifest`. It still assembles the same migration owners, IDs, SQL and ordering independently of flags.
- `createRoomDemo` became `createRoomComposition`; RTC consumes `RoomComposition`. The route's `demo` variable became `composition`; the generic shell's `demoState`/`demo-state` prop became `roomState`/`room-state`.
- Removed obsolete Aya/Noah participants, mock camera toggles/tiles/menus, inert Pomodoro/Tasks/Chat registrations, old background notice and placeholder mic/screen controls. Real feature registrations supply these surfaces. Removed corresponding unused demo/mock CSS; live timer/count/device-note styles use semantic names.
- Removed the route's obsolete retained-participant map. RTC already owns camera/expansion state and reprojects it after social snapshots; the extra map unnecessarily retained departed participants.
- The useful existing workspace interaction helper now reads “Workspace guide.” Its device-persisted `demo.sandbox` identifier and resource key remain unchanged; saved geometry still restores. Media's existing unavailable control remains because provider playback is not implemented or authorized by maintenance.
- Synthetic camera rendering now lives in `tests/fixtures/workspace-camera.ts`. Generic one-renderer workspace lifecycle coverage remains, while real room browser assertions verify actual canonical panels/dock. No mock timer/task/chat implementation remains in production.
- Moved the intentionally hostile real-SDK probe into tests and updated both SFU suites and the isolated harness. Its SDK-preflight bypass, real grants, token-tampering/replay and publication checks remain intact.
- Centralized repeated `AppError` conversion and boolean switch parsing. New semantic deployment names are `IDENTITY_ROOMS_ENABLED` and `SOCIAL_ENABLED`; either an old or new explicit false disables the feature. Both values are strictly validated, including conflicting/malformed configurations. Existing module flag IDs, independent productivity/background flags and standalone RTC default-off behavior are preserved.
- Social sockets ignore late open/message callbacks from retired generations after navigation/stop. Background reads cannot allocate thumbnail URLs or restore subscriptions after disposal. RoomShell checks disposal after asynchronous preference reads. A late room-entry response cannot allocate RTC or reopen an already-unmounted room. Pointer handling checks `Element` instead of asserting every event target is one.

## Architecture findings and fixes

The core remains feature-neutral. Feature packages already own their data/migrations and use SDK ports for cross-feature access. Rooms' transaction-aware access port supplies productivity, backgrounds and RTC; Friends supplies block policy and Identity supplies public names. Existing durable task scope separation, server authority and privacy projection remain intact. Foreign-key relationships in migrations are intentional and were not rewritten.

No domain switch dispatcher was found: the larger API transport file applies shared HTTP/WebSocket authentication, schema, authorization, CSRF, rate, queue and snapshot controls around registered operations. Its size alone did not justify a risky rewrite. Larger identity/rooms/RTC files retain coherent ownership; broad decomposition was deferred.

The audit found type-only dependency cycles through the SDK barrel and background registration/components. Direct imports from SDK foundation and a separate background model remove those cycles without changing public contracts. The complete source graph now passes cycle checks, including type imports. Existing runtime module-dependency cycle tests remain.

Strengthened `scripts/check-boundaries.ts` and negative tests to enforce:

- indirect RoomShell feature/provider/composition imports through helper barrels;
- source-file cycles, including extensionless barrel resolution;
- feature-owned SQL template schemas;
- production test-fixture imports and phase-number naming;
- the existing core/SDK/feature dependency direction, browser/server separation and LiveKit adapter restriction.

Only test code may directly import the SFU SDK outside adapters. Production LiveKit remains behind `RealtimeMediaProvider` and `MediaAuthority`. Static SQL checks cover reviewed tagged templates, not arbitrary dynamically generated SQL; the existing task-table substitution is a closed choice of two owned tables and retains service coverage. These checks complement review, not a plugin sandbox.

## Phase-reference classification and compatibility

The initial search covered case-insensitive `phase00`–`phase06`, `Phase00` variants and `PHASE_00`–`PHASE_06`, including separator variants. Occurrences were classified by ownership/use rather than blindly replaced:

The occurrence-level before/after inventory is saved in `.local/validation/cleanup/phase-reference-inventory.json`, with path, line, category and rationale for each match. It supplements the renamed-path inventory and the exact retained production exceptions below.

| Classification                      | Treatment                                                                                                                                                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical/documentation            | Phase specs, reports, active/history files and dated architectural decisions retain phase numbers. Old source paths in accepted reports describe the implementation that existed then.                                                       |
| Validation/acceptance orchestration | `validate:phase00`–`validate:phase06`, `.github/workflows/phase00.yml` and its concurrency key, baseline screenshot filenames and the isolated `phase02-cleanup-fixture` account subject remain. Test filenames themselves are now semantic. |
| Production naming leakage           | Renamed API/contracts/migration composition and all callers as listed above. New architecture checks prevent recurrence.                                                                                                                     |
| Obsolete implementation             | Removed replaced demo branches, rendering code and CSS; retained useful deterministic testing under tests.                                                                                                                                   |

**Final production source exceptions are exactly two string literals**, both in `apps/api/src/module-support.ts`: `PHASE01_ENABLED` and `PHASE03_ENABLED`. They are existing deployment configuration aliases, not implementation names. Compose continues forwarding them alongside semantic keys; `.env.example` documents compatibility. Removing them could silently re-enable a disabled feature in an existing deployment.

The separate deployment occurrence `compose.yaml: name: study-phase00` remains because renaming it would select different Docker volumes/networks/containers. No data reset or cosmetic migration is appropriate. The phase-free but older `demo.sandbox` persisted tile type is also intentionally retained. Existing module/permission IDs, API paths, protocol fields and quality/grant values are unchanged.

## Roadmap and documentation

| Old                                    | New                                    |
| -------------------------------------- | -------------------------------------- |
| Phase 14 — Social Bonding & Mini-Games | Phase 11 — Social Bonding & Mini-Games |
| Phase 11 — OBS / Studio Ingest         | Phase 12 — OBS / Studio Ingest         |
| Phase 12 — Browser Companion Extension | Phase 13 — Browser Companion Extension |
| Phase 13 — Native Applications         | Phase 14 — Native Applications         |

Social bonding follows media/music because optional break activities are part of the core social study experience. OBS and companion platforms remain later expansion work. Specs distinguish roadmap sequencing from functional dependencies: games require neither OBS nor extension/native apps; OBS does not functionally require games; companion layers build on mature web/protocol/media capabilities.

Preserved the original word-puzzle/drawing-game framework and the umbrella's planned trivia, word association, icebreakers, suitable board/card activities, optional break suggestions, explicit join/decline/spectate, server-authoritative state and modular registration. Explicitly retained no automatic game starts and contract/event integration without direct RoomShell/Pomodoro/Presence/Chat coupling. No game implementation was added.

Current documentation updated: root `README.md`, `.env.example`, `packages/features/README.md`, `docs/UMBRELLA_SPEC.md`, `docs/ACTIVE_PHASE.md`, `docs/PHASE_HISTORY.md`, `docs/phases/README_PHASES.md`, all four renamed future specs, `docs/architecture/PHASE_01_PLAN.md`, `docs/architecture/TRANSPORT_PLAN.md`, and new `docs/architecture/CODEBASE.md`. CI's display name now describes accepted repository validation. The original `docs/studyverse_umbrella_product_spec.md` gained an archival notice linking the current roadmap; its historical body is preserved. Its old ordering is explicitly historical, not current guidance.

Accepted reports were not substantively rewritten. Their original review-status language remains historical; current acceptance is recorded in coordination. Phases 00–10 specs remain byte-for-byte unchanged, and their roadmap order is preserved.

## Validation and preservation

`npm run validate:phase06` **passed, exit 0: 243 tests, no skips**. It invokes the complete Phase 05 → 04 → 03 → 02 → 01 → 00 accepted chain, including formatting, lint, TypeScript, architecture, security, production builds, real services, browser/SFU and Docker checks. Evidence: `.local/validation/cleanup/full-validation-final.log`.

| Check                                                            | Result                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Pre-refactor unit/integration/architecture baseline              | 147 passed                                                          |
| Final unit, HTTP/integration, provider/security and architecture | 157 passed                                                          |
| Real PostgreSQL/Redis service tests                              | 62 passed                                                           |
| HTTPS Chromium browser suite                                     | 22 passed                                                           |
| Real Caddy/LiveKit and Docker readiness                          | 2 passed                                                            |
| Format, lint/boundaries, package/API and Nuxt TypeScript         | Passed                                                              |
| OpenAPI/JSON Schema drift                                        | Passed; both generated files byte-identical to the initial baseline |
| Source security and Gitleaks                                     | Passed                                                              |
| Dependency audit                                                 | Passed; zero reported vulnerabilities                               |
| API and Nuxt production builds                                   | Passed                                                              |

All five real SFU scenarios passed with synthetic capture and real transport: authenticated publishers and single-instance camera movement/mic/screen, independent same-account tabs, blocks/removal/readmission, hostile signed grants/expired/tampered tokens, and enabled/disabled authority orphan cleanup. Existing IDOR, session, CSRF/Origin, role forgery, privacy, task scope, chat and quality-policy regressions remain. No real-SFU test was replaced by a mock. New checks add flag compatibility, source boundaries/cycles/SQL ownership, stale social/background callbacks and late room-entry navigation.

The first incremental configuration test over-broadly expected the public provider-list query to have a feature flag; corrected that new assertion to reflect the accepted public discovery exception. The first full-chain attempt caught missing explicit import extensions in the newly extracted background model when its lifecycle tests brought it into NodeNext compilation; corrected the imports and reran the complete chain successfully. Neither issue was bypassed or skipped. Existing upstream Nuxt/Vue/dependency deprecation warnings remain nonblocking.

Desktop real-SFU and mobile workspace-guide screenshots were visually inspected after CSS removal: background-first layout, participant circles, canonical dock/rail and contained workspace controls remain. Existing browser checks include tablet/mobile, 320px width, pointer/keyboard geometry, persistence, reduced motion, focus and one-node media rendering.

Preservation evidence in `.local/validation/cleanup/integrity.json` verifies **12 migration SQL files**, **11 Phase 00–10 specification files** and **two generated schema files** against the initial hashes. Migration owners/IDs/order are unchanged, with no added migration or checksum rewrite. All seven accepted reports retain their historical text; no acceptance history is erased. The lockfile and runtime dependency versions were not changed by this maintenance task.

Read-only content digests and row counts for **all 17 development tables**, including `foundation.migrations`, matched before and after the full validation/rebuild. Tests used their guarded isolated test database. No development account/room/state reset, secret rotation or new persisted identifier was introduced. API paths, schema fields, auth/session and privacy semantics, room permissions, RTC grants and quality ceilings are preserved. The final Compose refresh and post-refresh readiness/data verification are recorded separately below.

Final `npm run dev` **passed, exit 0**, rebuilding the current source and applying the existing immutable migration manifest without resetting volumes. Evidence: `.local/validation/cleanup/compose-final.log`. Both readiness regressions passed again against that refreshed API/Caddy/LiveKit stack (`readiness-final.log`), and all 17 development-table digests/counts matched again (`development-data-before.json` / `development-data-after.json`). Final integrity and production-reference scans passed. The repository remains on accepted Phase 06, waiting for explicit Phase 07 authorization.

## Intentionally deferred

- No Phase 07 quality UI, higher ceilings, codec controls, Studio Voice or later media/game/platform feature.
- No speculative transport consolidation: the social lease/status connection and multiplexed feature connection retain accepted semantics and limits. A shared reconnect engine would require broader lifecycle/privacy review.
- No wholesale decomposition of the larger rooms/identity/RTC/HTTP modules, new permission editor, private-table changes, retention changes or distributed infrastructure.
- Small domain schemas with identical current shapes remain independently named public contracts; cosmetic unification is not worth wire/export churn. Existing thin public task/chat browser schema exports remain available for compatibility.
- Reviewed boundary assertions for typed PostgreSQL rows, experimental browser `ImageDecoder`/network-information interfaces and LiveKit's documented `exactOptionalPropertyTypes` mismatch remain. They are not replaced with unchecked `any` or blanket suppressions.
- Existing single-process observation/RTC authority, cooperative cancellation and self-hosted LiveKit replay/outage bounds remain documented. No physical-device, external OAuth, Safari/Firefox, public NAT/TURN or hosted-CI verification is claimed.

**Completion gate:** keep Phase 06 accepted. Stop after this maintenance report; wait for the owner's explicit authorization before beginning Phase 07.
