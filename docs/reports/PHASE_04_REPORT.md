# Phase 04 report

2026-09-11. Scope: Realtime Productivity — Pomodoro, Tasks & Chat. Phase 03 was explicitly accepted by the owner before implementation; its minor visual polish remains deferred. Phase 00–03 architecture, privacy and room-shell behavior are preserved. Phase 05 was not started.

Status: AWAITING_REVIEW. Phase 04 remains unaccepted.

The owner’s subsequent scope amendment is included below: independent Personal/Shared Pomodoro, separate task storage and permissions, and the later media transport decision. This report supersedes the earlier shared-only implementation report.

## Implemented

- Real Personal/Shared Pomodoro, Personal/Shared tasks and room chat replace the live room's three demo panels through the existing UI registry, in canonical order.
- Three independently registered server modules, typed v1 schemas, HTTP routes, realtime commands/snapshots, feature flags, permissions and module-owned migrations.
- Independent Personal and Shared timer start/resume, pause, reset, skip, configurable focus/short-break/long-break durations and cycles; deterministic transitions and recovery from persisted timestamps.
- Private cross-room account tasks and room-owned shared tasks: create, edit, complete/uncomplete, delete and reorder, with current server authorization and stale-version rejection.
- Plain-text room messages, emoji, server timestamps, ordered history pages, replay suppression, author/owner deletion and server-side block filtering.
- Accessible control labels, loading/error states, reconnect clearing/resync, responsive rail scrolling and retained keyboard/reduced-motion/workspace behavior.

## Architecture and ownership

`packages/features/pomodoro`, `tasks` and `chat` own their server operations and data. `apps/api/src/phase04.ts` composes their SDK ports. Rooms exposes `ProductivityRooms.role`, which alone reads and transactionally locks room/membership records and checks the owner's block policy through Friends. Chat resolves names through Identity's public people directory and filtering through Friends' public social directory. No productivity feature queries another feature's private tables.

Client composition registers lazy-loaded panels through `apps/web/app/room/productivity.ts`. RoomShell has no concrete productivity imports; its only content adjustment is removing the obsolete claim that all tools are previews. The new generic browser transport multiplexes the productivity panels on one additional socket, preserving the existing four-socket-per-session limit. Presence retains its accepted client and semantics.

All HTTP and socket operations use the existing operation, permission, flag and rate pipeline. Sockets authenticate the current session for each command. Shared reads/mutations resolve current membership; mutations recheck it inside the transaction. Personal operations require the authenticated owner but deliberately have no room dependency. Internal facts are not broadcast blindly: the accepted transport reauthorizes viewer-specific snapshots every two seconds and sends only changed results. Removed membership, owner blocks or revoked sessions invalidate subscriptions. An early transport error without a correlated request ID now rejects pending browser requests immediately rather than leaving controls pending until timeout.

## Timer authority and synchronization

Personal mode is private to the authenticated account and is the default UI scope. Its separate `pomodoro.personal_timers` table is keyed only by the session actor; requests accept no user/owner/room IDs. Other accounts cannot address or control it. Same-account devices receive their own authorized snapshots; no personal state emits room events or enters the Shared worker. It continues across rooms, refresh, reconnect and server restart, without room membership. Shared mode belongs to the room in `pomodoro.timers` and retains current membership reads and owner-only controls. Switching modes changes the view without resetting either timer.

The durable record is an **anchor**, not a per-second countdown: room ID for Shared or a personal scope discriminator for Personal, command version, configuration, phase, cycle, running flag, remaining milliseconds at the anchor, and server anchor timestamp. Before any command, the server projects that anchor to its current time. Clients use the same pure projection after obtaining the authenticated server clock. Browser wall-clock settings never become timer authority.

The client estimates server time from the clock response plus half the measured round trip, then advances using `performance.now()`. It samples again on initial state, state updates and every 30 seconds. Display ticks are local; the server does not broadcast a countdown every second. Natural phase transitions derive from the anchor even if the API was stopped or the room was empty. Projection skips whole cycles in constant time before resolving the remaining phase, so long downtime does not produce an unbounded loop. Late join/reconnect/refresh reads the durable anchor and resamples the clock.

Commands serialize per room for Shared and per authenticated account for Personal and require the latest command version. Only one simultaneous command with a given version succeeds; stale/replayed versions return conflict. Pause freezes projected remaining time; resume continues it; skip advances one phase while preserving running/paused state; reset pauses at the first focus cycle and preserves configuration. Configuration changes require a paused timer and reset its position. Defaults are 25/5/15 minutes with four focus cycles. Allowed bounds: focus 1–180 minutes, short break 1–60, long break 1–120, cycles 1–12. The protocol accepts integer seconds within those bounds; the compact settings UI uses minutes.

Only the room owner controls/configures the Shared timer, regardless of presence; every authenticated account controls its own Personal timer. Reserved moderators receive no new powers. Internal `pomodoro.updated` and `pomodoro.phase-changed` events provide integration hooks; a one-second worker observes projected phase changes without writing countdown state or sending timer frames to clients. Presence statuses are not automatically overridden: the active spec did not require a follow-timer presence policy, and accepted explicit status/privacy behavior remains intact.

## Task semantics

Personal and Shared tasks use physically separate `tasks.personal_items` and `tasks.shared_items` tables with mutually exclusive ownership constraints. Separate registered `tasks.personal` and `tasks.shared` policies enforce account ownership and current room membership respectively. The existing `tasks.access` dispatcher preserves v1 operation URLs while invoking those distinct policies; it does not merge their ownership rules. An immutable upgrade copies existing records, verifies the count, and drops the old combined table within the migration transaction. Global actor-bound create replay checks still span both tables.

Personal task ownership always comes from the session. Personal queries accept no target-user ID and return no other user's records; they persist across rooms. Shared tasks belong to the room. Current members may create them; their creator or the room owner may edit, complete, delete or reorder them. A different ordinary member cannot. Existing owner-block restrictions remove room access; ordinary member-to-member blocks do not hide room-owned shared work or change its permissions.

Lists contain at most 200 active tasks. Titles are trimmed and limited to 300 characters. Sorting is position then UUID; the explicit move operation normalizes the list and advances versions transactionally, including when positions collide. Updates/deletes/reorders require current versions. Creation uses actor-bound replay keys and locks, preventing duplicate creates across concurrent requests. Deleted tasks disappear from reads and their original title is erased; minimal tombstones retain identifiers/replay metadata to prevent resurrection by replay. No assignees, due dates, subtasks or sharing of personal tasks were added.

## Transport architecture

HTTPS serves durable APIs and initial state. Authenticated application WebSocket carries text chat, presence, friends, invitations, Pomodoro, tasks and room events. Text chat never uses RTCDataChannel. Reconnect fetches persisted history and authorized snapshots.

Later microphone/camera/screen/OBS media uses WebRTC through an SFU that primarily forwards encoded streams. LiveKit is the preferred initial direction behind a generic provider adapter; a future Mediasoup adapter remains possible without RoomShell changes. Subscriptions follow rendered size and user ceilings, stop hidden video where practical, and expose requested versus actual quality. WebTransport is optional for future specialized needs, not a custom media replacement. See [Transport decision](../architecture/TRANSPORT_PLAN.md) for the full provider boundary and adaptive policy. No RTC, SFU, LiveKit, WebTransport or Phase 05 implementation was added.

## Chat semantics

Every message read/send/delete requires current room membership and owner-block policy. Identity, room relationships and moderation powers are server-derived. Other ordinary members cannot delete an author's message; the author and room owner can. Member-to-member blocks filter the blocked author's messages on the server for the viewer. Privacy settings for presence do not conceal an explicitly posted chat message.

PostgreSQL supplies the sequence and timestamp. Room mutations serialize before sequence allocation; pagination uses the sequence, avoiding timestamp ties and JavaScript integer precision loss. Latest/history snapshots return up to 100 messages and an older-page cursor. The cursor advances over the raw page even when block filtering removes all visible messages. Reconnect reloads the latest subscribed page rather than appending potentially duplicated events. Viewing older history is explicit; Latest messages returns to the live newest page.

Message text is trimmed and limited to 2,000 characters. Vue renders it as text; HTML/script payloads are harmless, and URLs remain plain text rather than active links. Send limits are 20 per minute per actor, alongside existing socket/ingress limits. Actor-bound request UUIDs suppress replays; deletion wipes the text and leaves a visible tombstone, preserving order and replay protection. Messages persist until deletion or room/account cascade deletion; no automatic age-based retention period is imposed in this phase. There are no DMs, uploads, rich embeds, reactions, threads or typing indicators.

## Migrations and configuration

| Migration                       | Durable data                                                          |
| ------------------------------- | --------------------------------------------------------------------- |
| `pomodoro/0001_pomodoro`        | Per-room JSON timer anchor/configuration                              |
| `pomodoro/0002_personal_timers` | Private account timer anchors/configuration                           |
| `tasks/0002_separate_scopes`    | Copy-preserving upgrade into separate Personal and Shared task tables |
| `tasks/0001_tasks`              | Original task storage, subsequently split by immutable 0002 upgrade   |
| `chat/0001_chat`                | Messages, stable sequence, history index and moderation tombstones    |

Module migrations use their owned schemas and least-privilege runtime grants. Foreign keys retain room/account integrity and cascade cleanup. Existing migration files/checksums are unchanged. The existing composition manifest and Docker migration copies include the additions independently of flags. Guarded `*_test` reset fixtures now include the added schemas/referencing data. Development data was upgraded, not reset.

`POMODORO_ENABLED`, `TASKS_ENABLED` and `CHAT_ENABLED` default to true and validate true/false. Each independently gates its module's HTTP/socket operations. No new external service, library or credential is required. Readiness checks the new tables. CI invokes `validate:phase04`, which chains all earlier phases. OpenAPI generation now preserves query-union parameters for Personal versus Shared scope.

## Validation

`npm run validate:phase04` **passed, exit 0: 189 tests, no skips**, including the complete Phase 03 → 02 → 01 → 00 regression chain. Evidence: `.local/validation/phase04-amend-complete.log`.

| Check                                                 | Result                       |
| ----------------------------------------------------- | ---------------------------- |
| Unit, HTTP/integration and architecture               | 119 passed                   |
| Real PostgreSQL/Redis service tests                   | 58 passed                    |
| HTTPS/WSS Chromium browser tests                      | 11 passed                    |
| Actual Docker readiness regression                    | 1 passed                     |
| Formatting, ESLint, module boundaries, API/Nuxt types | Passed                       |
| OpenAPI/JSON Schema drift                             | Passed                       |
| Source security and Gitleaks                          | Passed                       |
| Dependency audit                                      | Passed; zero vulnerabilities |
| API and Nuxt production builds                        | Passed                       |
| Development Compose upgrade/migration/readiness       | Passed                       |

Final validation ran on local Node 26.8.2; the rebuilt Docker image uses the accepted pinned Node 24.21.0 runtime. Hosted CI was not run. Docker evidence: `.local/validation/phase04-amend-compose.log`. Desktop, tablet and mobile screenshots were visually inspected; the final captures reset rail scrolling so the timer heading is visible, with a separate mobile chat view.

Amendment coverage additionally verifies private timer owner/ID forgery rejection, same-account socket sync without cross-account room leakage, stale and revoked credentials, independent inactive timer state, cross-room continuity, restart recovery, and task upgrade preservation of records/tombstones/versions/checksums.

Coverage includes domain transitions/drift, real PostgreSQL/Redis, HTTP/WS multi-client delivery, resync/restart, every mutation's auth/CSRF/origin protections, hostile ownership/role/room IDs, stale versions, replay, limits, removed members, revoked sessions, blocks, flags, XSS, module initialization/boundaries and Chromium room workflows. Previous-phase assertions remain in the complete suite.

During the initial Phase 04 implementation, the focused browser run passed but the first combined run exposed shared fake-account socket-rate accumulation and uncorrelated transport-error handling. Browser fake logins now use independent fixture subjects; service rate keys are isolated per test while exercising real Redis. Production rate limits remain unchanged. A dedicated client regression covers the error-handling defect. No tests were skipped or weakened.

Screenshots are saved under `.local/validation/`: `phase04-productivity-desktop.png` (1440×1000), `phase04-productivity-tablet.png` (768×1024), `phase04-productivity-mobile.png` and `phase04-chat-mobile.png` (390×844). Additional `phase04-personal-desktop.png` and `phase04-personal-mobile.png` captures show the running private timer after cross-room navigation and reload. They show real feature state with isolated test accounts. The compact rail scrolls to reach lower controls on short viewports; the center/background and dock remain intact.

## Assumptions and known limitations

- Owner-only Shared timer control, creator/owner shared-task editing and author/owner chat moderation are conservative defaults where the phase spec leaves policy choices open. No configurable role editor or moderator promotion was invented.
- Running timers continue cycling while inactive; Personal timers are independent of room membership. There is no automatic FFA or presence override.
- Deployment remains one API process, as accepted in Phase 03. Internal events/observation indexes and subscriptions are process-local; the Shared timer worker scans active room anchors. Distributed subscriptions, a durable event outbox and large-scale worker scheduling remain deployment work.
- Clock synchronization assumes a correctly maintained server clock; network asymmetry bounds display accuracy. Physical sleep/wake, other browser engines and live external OAuth were not newly verified. Automated projection, disconnect/reconnect and Chromium refresh are covered.
- Chat history is paginated, not an unbounded browser feed. Task capacity is 200 active records per scope. Replay/moderation tombstones and chat history have no automatic age purge; retention changes require an explicit future policy.
- Unsent drafts live only in component memory and can be lost on panel collapse/navigation. Shared state is not mutated optimistically; errors/conflicts ask the user to review refreshed state before retrying.
- Broad visual/fidelity polish, later-phase features and hosted CI verification remain deferred. Existing upstream build warnings remain nonblocking.

## Ready for next phase

**NO — Phase 04 requires owner review and explicit acceptance.** Keep `ACTIVE_PHASE: 04` and its specification. Phase 05 remains unauthorized.
