# Current codebase architecture

Accepted Phases 00–08 remain the architecture baseline. Room media is described in [room media architecture](ROOM_MEDIA.md), and advanced RTC in [advanced RTC architecture](PHASE_07_RTC.md). The owner-authorized MID-05–08 continuation is COMPLETE — AWAITING_REVIEW; its targeted UI/module extensions are recorded in the [final refresh report](../reports/MID_DESIGN_REFRESH_FINAL_REPORT.md), without claiming acceptance. Phase 09 adds a [private local personal player](PERSONAL_STUDY_PLAYER.md); its unresolved dependency completion gate is recorded in the [phase report](../reports/PHASE_09_PERSONAL_STUDY_PLAYER_REPORT.md). Phase 10 remains IN_PROGRESS — PENDING SECURE APPLE INTEGRATION. An explicit owner sequencing exception authorizes Phase 11 source development and its [optional room activities](ACTIVITIES.md), without accepting Phase 10 or waiving security gates. Later phases remain unauthorized.

## Composition and dependency direction

API composition uses `identity.ts` (identity and rooms), `social.ts` (friends and presence), `productivity.ts` (Pomodoro, tasks and chat), `backgrounds.ts` and `rtc.ts`. Their common error and strictly parsed deployment switches live in `module-support.ts`. Transport handlers dispatch through the existing operation/HTTP/realtime registries, revalidating sessions, permissions, schemas, rates and flags.

The domain packages are already feature-oriented: identity, rooms, friends, presence, pomodoro, tasks, chat, backgrounds and rtc. Feature packages import only their own implementation, SDK ports and contracts. Core imports no concrete feature or provider. Data queries and migrations stay with the owning feature. Foreign keys and immutable migration ordering preserve referential integrity across schemas; public SDK ports govern runtime access. `scripts/application-migrations.ts` collects the application manifest independently of enablement.

The SDK barrel exports generic primitives from `foundation.ts` and domain ports from their semantic files. Domain ports import foundation types directly, avoiding barrel cycles. Contracts use semantic identity/social/productivity/backgrounds/rtc files, preserving their existing public exports and generated wire schemas.

## Web ownership

The web workspace already ran Nuxt 4.5.2 before MID-08 and retains that pin and Vue 3.5.42. MID-08 adopts generated app/server/shared/node TypeScript project references and the scoped fonts/image/icon/VueUse integrations recorded in [its report](../reports/MID_08_NUXT4_AND_UX_MODULES_REPORT.md). Nuxt build configuration may import only its exact build font provider under `infra/nuxt`; browser source remains subject to Node/server dependency prohibitions. Appearance and route/room readiness retain their existing owners. No SSR disablement, new client initializer or domain rewrite is introduced.

`room/composition.ts` constructs generic registries, workspace, initial self state and common controls. Concrete feature composition registers the real panels, social controls, backgrounds and media. RoomShell and WorkspaceHost consume generic interfaces and renderer contributions. The workspace guide keeps its existing persisted `demo.sandbox` type so saved device layouts survive. Other obsolete mock participants, camera registrations, example panels and placeholder background/capture branches have been removed.

Background selection, local persistence and resource lifecycle live in `room/background-model.ts`; `room/backgrounds.ts` only registers components. Those components import the model type rather than importing their own registration module. The social socket ignores callbacks from retired connections; asynchronous background reads and workspace recovery check disposal before restoring state or allocating resources.

LiveKit stays behind SDK `RealtimeMediaProvider` and `MediaAuthority` ports. Browser/server SDK imports belong in `packages/adapters/src/livekit`; the deliberately hostile direct-SDK client lives only in `tests/browser/livekit-probe.ts`. The production client still requests native screen capture. Deterministic mock-provider tests and synthetic capture remain alongside real SFU integration and hostile-client tests.

## Enforced boundaries

`scripts/check-boundaries.ts`, run by lint and architecture tests, checks direct imports, re-exports, dynamic imports, transitive browser dependencies, production fixture imports, file cycles including type-only imports, indirect RoomShell feature dependencies, production phase-number naming and module-owned SQL templates. Negative fixtures exercise the rules. Existing runtime module-cycle, permission, registration and independent-feature tests remain.

These are static checks over reviewed source, not a sandbox or a complete SQL interpreter. The current task-scoped SQL helper substitutes only its two owned table names; those choices and the separate task permission policies remain covered by service tests. Architecture review is still required for new aliases, code generation or query-building mechanisms.

Deployment compatibility is deliberately narrow: `PHASE01_ENABLED` and `PHASE03_ENABLED` are retained only as legacy aliases for `IDENTITY_ROOMS_ENABLED` and `SOCIAL_ENABLED`. Either false disables the corresponding feature; invalid values fail startup. The `study-phase00` Compose project name stays unchanged because it identifies existing volumes, networks and containers. Historical regression commands, CI concurrency names and acceptance evidence may retain phase numbers.

## Preserved operating limits

One API process owns the application observation index and each RTC namespace. Events remain process-local; no distributed outbox, subscription system or new retention policy is added. Basic media quality remains trusted-client 720p30 camera/1080p30 screen policy, with server/provider-enforced scoped grants. Phase 07 adds opt-in, deployment-gated quality preferences through the existing provider. Existing self-hosted LiveKit replay/removal and outage bounds remain as documented in [RTC architecture](PHASE_06_RTC.md). No migration, session, privacy, room permission or media grant is changed.

Room media is composed through `room-media.ts`, `@study/room-media` and a YouTube provider adapter. It consumes the presence-owned server occupancy port/event, room authorization and social/identity ports. It adds no feature dependency to RoomShell, productivity or RTC.

Personal media is app-composed through `personal-media.ts`, `@study/personal-media` and registered provider adapters. Its panel uses a generic UI extension and its private tile uses the existing workspace registry. Its owner receives local storage, effective-gain and authorized activity ports; core, shared media and SDK do not import the concrete personal UI/provider implementation. Explicit public YouTube promotion reuses room media authority; all personal playback/history state remains device-local.
