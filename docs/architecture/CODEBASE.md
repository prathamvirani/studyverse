# Current codebase architecture

Phase 07 is accepted. Phase 08 is explicitly authorized; its implementation is described in [room media architecture](ROOM_MEDIA.md). Advanced RTC remains described in [advanced RTC architecture](PHASE_07_RTC.md). Phase 09 and the later roadmap remain unauthorized.

## Composition and dependency direction

API composition uses `identity.ts` (identity and rooms), `social.ts` (friends and presence), `productivity.ts` (Pomodoro, tasks and chat), `backgrounds.ts` and `rtc.ts`. Their common error and strictly parsed deployment switches live in `module-support.ts`. Transport handlers dispatch through the existing operation/HTTP/realtime registries, revalidating sessions, permissions, schemas, rates and flags.

The domain packages are already feature-oriented: identity, rooms, friends, presence, pomodoro, tasks, chat, backgrounds and rtc. Feature packages import only their own implementation, SDK ports and contracts. Core imports no concrete feature or provider. Data queries and migrations stay with the owning feature. Foreign keys and immutable migration ordering preserve referential integrity across schemas; public SDK ports govern runtime access. `scripts/application-migrations.ts` collects the application manifest independently of enablement.

The SDK barrel exports generic primitives from `foundation.ts` and domain ports from their semantic files. Domain ports import foundation types directly, avoiding barrel cycles. Contracts use semantic identity/social/productivity/backgrounds/rtc files, preserving their existing public exports and generated wire schemas.

## Web ownership

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
