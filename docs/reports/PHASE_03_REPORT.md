# Phase 03 report

2026-09-11. Scope: Presence, Friends & Invitations only. Phase 00/01/02 acceptance and the accepted room design are preserved. No later phase is authorized by this report.

## Implemented

- Independent Friends and Presence modules with versioned schemas, permission/operation/realtime registries, feature flags and explicit SDK service ports.
- Ephemeral, authenticated per-connection presence, all six statuses, heartbeat/reconnect handling, multi-tab/device aggregation, room participant snapshots and typed internal participant joined/left events.
- Friend requests, acceptance, decline/cancel, removal, block/unblock, friend lists, incoming-request notifications and privacy settings. Users meet through shared rooms; there is no global account-search or arbitrary profile-lookup endpoint.
- Recipient-bound room invitations reuse `rooms.invites`, existing owner permissions, expiry, revocation and membership creation. Friends can accept/decline invitations from their inbox.
- Live participant data replaces demo participants. The narrow left rail, circular avatars, indicators, keyboard/right-click menus, background, dock and ordered study panels remain. Social menus include status, friend and block actions. The accepted isolated camera demo and single-renderer workspace architecture remain; no device capture or RTC was added.
- Friends navigation and pending-request/invitation counts, a Friends page, and an optional room notification contribution. No messaging, browser notification permission, audio alert or social-media Home redesign.

## Architecture and data ownership

`packages/features/friends` owns relationships, blocks and privacy preferences. `packages/features/presence` owns Redis connection leases and its process-local connection index. Rooms continues to own invitations and memberships; Identity continues to own public account names and provider identities. Cross-module access uses SDK ports, including transactional invitation revocation on block/removal. Core imports no concrete feature.

The generic transport supplies an unforgeable connection identifier in operation context. Registered read-only snapshot bindings run every two seconds, executing the normal operation/schema/permission/rate/flag pipeline and authenticating the current cookie session before each delivery. Only changed, viewer-specific snapshots are sent. A failed subscription check closes the socket and clears subscriptions; reconnect starts authorization again. No raw domain event is blindly broadcast to clients. Queue/frame/session limits and CSRF protections remain.

Client composition supplies live participants and registry contributions to RoomShell. RoomShell has no Presence/Friends implementation import. The client keeps transport state in memory, clears snapshots on disconnect, and uses jittered reconnect with a 30-second maximum backoff. Authentication secrets never enter browser storage. The new status controls have explicit accessible names.

## Presence aggregation semantics

1. Each server-issued socket connection has its own Redis lease, logical session ID, user ID, optional room, selected status, active flag and expiry. Clients cannot choose any connection/user/session identity.
2. Heartbeats normally run every 20 seconds. Leases expire after 65 seconds. A socket close removes only that connection after queued work finishes. Another valid connection keeps the user present. Abrupt disconnect/suspension is bounded by lease expiry, plus the two-second snapshot interval.
3. Every projection checks that leases still exist in Redis, their sessions remain unexpired/unrevoked, and room membership/owner-block policy still permits them. Stale, removed-member and revoked-session leases do not count even before their TTL expires.
4. The most recently changed connection status wins, using a monotonic server change clock. Ordinary heartbeats do not reorder unchanged selections. Explicit Offline suppresses aggregate presence while it is the winning selection. With no valid connections the status is Offline and no room is returned.
5. Any active connection prevents automatic Away. If all are inactive, the aggregate becomes Away; explicit Do Not Disturb remains Do Not Disturb. A hidden tab is inactive, and a visible tab becomes inactive after five minutes without keyboard/pointer activity. Other active tabs/devices still count.
6. Room participation is the union of valid room leases, deduplicated by user within each room. Friend activity selects the most recently changed non-null room and applies the viewer's room access and the subject's privacy. Being in two rooms on separate devices does not duplicate a person within a rail.
7. Explicit status is transient, not durable account data. SPA navigation and socket reconnection retain the client's selection. A full page reload starts Online and the accepted Phase 02 entry flow still requires a POST Join/Enter before room presence resumes. Durable privacy preferences remain effective across reloads.
8. Redis loss removes presence from subsequent projections; an authorized heartbeat rebuilds its lease. Friendships, blocks, privacy and invites are unaffected. A server restart similarly starts with an empty connection index and requires reconnects.

## Privacy semantics

- Defaults: online visibility on, study-status visibility on, current-room visibility off, Join visibility off, friend invitations on.
- Hidden online presence returns `status: null` and `room: null` to others. It is not mislabeled as Offline. Hidden study status reduces an otherwise visible active state to Online.
- Hidden current room returns no room metadata and also excludes that user from other participants' room rails. The user's own view remains available, except explicit Offline suppresses rail presence. The privacy settings explain this behavior.
- A public room can appear in permitted friend activity. Private and unlisted room details require the viewer's existing membership, even when the subject opted to share their room. No private room ID/title is sent to an unauthorized friend through presence.
- Join visibility controls the projected Join action; it never grants access or changes public/private/unlisted join rules. Hiding Join does not make a public room private.
- Invites are an explicit, scoped grant: an intended recipient may see the invited private room's name in their inbox. This does not expose that room to other friends or guessed recipient IDs.
- HTTP and WebSocket outputs are filtered on the server. There is no frontend-only privacy boundary.

## Block semantics

Blocking is directional durable ownership, with symmetric social restrictions. Either direction hides presence, prevents requests/invitations and removes the friendship/pending request. Pending targeted invitations in either direction are revoked transactionally. Unblocking only removes the current actor's block and restores neither friendships nor revoked invitations.

A room-owner block in either direction prevents reading/joining that owner's rooms and using their invite links, and invalidates active room presence/subscriptions. Between two ordinary members, blocking hides them from one another without evicting unrelated participants or deleting durable memberships. Persistent membership is not silently removed. Block enforcement remains active when Phase 03 actions are disabled.

## Invitation behavior

- Only room owners can issue invitations, preserving Phase 01 policy. Friendship does not grant room-management powers.
- A friend invitation requires an accepted, unblocked friendship and recipient invitation opt-in. It expires after 24 hours, has one use, and has an exact recipient and sender. No raw token is stored or delivered in the inbox.
- Recipient acceptance is transactional and locks the existing room/invite records. Another account cannot accept it by ID. Expired, declined, revoked, already-consumed, blocked or no-longer-friend invitations fail.
- General Phase 01 fragment-token invite links continue to work with their existing expiry, usage and revocation checks, plus owner-block checks. Changing room privacy revokes both general and targeted invitations.
- Lists are bounded to 200 relationships/blocks and 100 inbox invites. Requests are limited to 10/minute per actor, friend invites to 10/minute, social mutations generally to 30/minute, and presence heartbeats to 40/minute. Separate ingress/socket limits remain. Snapshot reads allow multiple legitimate tabs/devices without removing their authorization checks.

## Authorized local cleanup

The exact confirmed users were verified in the local Compose PostgreSQL `study` database and the intended deletion set was logged before execution:

| Record       | Verified identity                                                        | Outcome |
| ------------ | ------------------------------------------------------------------------ | ------- |
| Google user  | `8f569061-9985-48af-8999-24748ebadbfb`, Pratham Virani, Google identity  | Deleted |
| Discord user | `cdf3f9c5-2985-46fd-93ba-e05ed31c44ea`, asparaguss.24, Discord identity  | Deleted |
| Owned room   | `abafbac5-df05-4de3-92db-b9e3fa1edcfc`, Studyyy, Google user's ownership | Deleted |

The schema does not store provider email addresses; the Google match used the explicitly authorized UUID and provider. The local inventory contained exactly those two users and one room, with two sessions, two provider identities, one membership and no invites. A guarded, locked transaction removed them and actor-bound OAuth flows where present, verified unrelated user/room sets were unchanged, and compared full migration records before commit. All four migration rows/checksums were unchanged by cleanup. Foreign keys remained enforced. No deletion endpoint, admin bypass, cleanup UI or permanent production cleanup script was introduced.

Final verification again found zero target users, sessions, provider identities or throwaway rooms, zero invalid foreign keys, and zero remaining local development users/rooms. The original four migration checksums still match; the two Phase 03 migrations below were subsequently appended as intended. No fresh live OAuth login was needed or claimed.

Evidence: `.local/validation/phase03-cleanup-inventory.log`, `phase03-cleanup-result.log`, `phase03-cleanup-final.log`.

## Migrations and configuration

- `friends/0001_friends`: canonical-pair relationships, actor-owned blocks and per-user privacy, constraints and runtime grants.
- `rooms/0002_friend_invites`: recipient/sender foreign keys and recipient index on the existing invitation table.
- The existing migration manifest includes both additions independently of feature enablement. Original migrations were not edited. Clean test-database migration and development upgrade are validated.
- `PHASE03_ENABLED` defaults to true and validates true/false. Disabling it denies new social/presence actions while preserving durable policy enforcement. No new external service or third-party library dependency; the two workspace packages use the established stack.
- CI now invokes `validate:phase03`, which chains Phase 02 → 01 → 00. Local Compose was rebuilt directly with the existing protected `.local/compose.env`, using the already accepted workaround for the Windows dev-wrapper ACL issue. No ACL/security guard was weakened.
- Browser tests use real PostgreSQL/Redis and isolated fake provider accounts on `study_test`. Their generated certificate's exact public-key fingerprint is trusted only by the launched test browser for WSS; system trust and production TLS verification are unchanged.

## Validation

`npm run validate:phase03` **passed, exit 0: 162 tests, no skips**, including the complete Phase 02 → 01 → 00 regression chain. Evidence: `.local/validation/phase03-complete.log`.

| Check                                           | Result                       |
| ----------------------------------------------- | ---------------------------- |
| Unit, integration and architecture              | 115 passed                   |
| Real PostgreSQL/Redis services                  | 37 passed                    |
| HTTPS/WSS Chromium                              | 9 passed                     |
| Actual Docker readiness regression              | 1 passed                     |
| Formatting, ESLint and architecture enforcement | Passed                       |
| Package/API and Nuxt types                      | Passed                       |
| Generated OpenAPI/JSON Schema drift             | Passed                       |
| Source security and Gitleaks                    | Passed                       |
| Dependency audit                                | Passed; zero vulnerabilities |
| API and Nuxt production builds                  | Passed                       |
| Local Compose migration/build/readiness         | Passed                       |
| Authorized account cleanup verification         | Passed                       |

The final local pipeline ran on Node 26.8.2; the Docker image uses the accepted pinned Node 24.21.0 runtime. Existing upstream Nuxt/Vue/Zod warnings remain nonblocking. Hosted CI was not run.

An initial combined browser run correctly hit the existing 300-request shared ingress limit because all accelerated fixture users use one loopback proxy. The isolated browser harness now explicitly configures 10,000 ingress requests/minute; production retains 300 and dedicated hostile-client/rate tests retain normal limits. The suite does not bypass CSRF, sessions, membership, operation limits or privacy. Initial live-snapshot camera-state loss, accessible select labeling, and avoidable socket startup before session renewal were corrected before final validation. Transient test failures were investigated and fixed, not skipped.

Added coverage includes forged sender/recipient/actor/privacy fields, self/duplicate/concurrent requests, another user's acceptance, unknown/unrelated IDs, block/unblock ownership, blocked/general/targeted invitation bypass, recipient/expiry/revocation/replay checks, privacy changes during subscriptions, hidden current-room and private-room leakage, revoked-session actions, active membership changes, reconnect after block, rate abuse, Redis loss, multi-connection aggregation and module independence/disablement. All existing Phase 00/01/02 regressions remain.

Screenshots under `.local/validation/`: `phase03-presence-desktop.png`, `phase03-presence-tablet.png`, `phase03-presence-mobile.png`, `phase03-friends-desktop.png`, `phase03-friends-tablet.png`, `phase03-friends-mobile.png`. Representative sizes are 1440×900, 768×1024 and 390×844; the existing 320×568 dock checks remain. Browser tests assert no page errors and no horizontal overflow. Visual inspection caught the need to capture complete Friends pages; live snapshot replacement also received a fix to preserve the accepted camera demo state.

## Assumptions and intentionally deferred work

- Existing uncommitted Phase 00/01/02 work is accepted input and was preserved. Only this phase and its necessary transport, policy and test integration were changed.
- Shared durable room membership establishes an acquaintance for a request. No speculative global username/email search, public account directory or DM system was introduced.
- The strict interpretation of hidden current room includes the rail; users opt into being visible there through Friends privacy. Defaults favor withholding room information.
- Owner-only friend invitations, no automatic membership deletion on block, transient status after reload, finite social-list limits and a two-second realtime update interval are the documented reversible choices.
- This deployment remains **one API process**. Redis stores lease values, while the existing socket/event infrastructure and active-connection index are process-local. Horizontal deployment requires a distributed presence index/subscription design and is not represented as supported here.
- Snapshot delivery bounds stale displays but cannot retract bytes already delivered while authorized. The client clears cached snapshots on disconnect; HTTP always reprojects current policy.
- No physical laptop sleep/wake or live OAuth recreation is claimed: lease expiry, suspension/reconnect and revoked-session behavior are covered by automated tests. Hosted CI remains unobserved for these local changes.
- RTC, real timer/tasks/chat, media/background libraries, direct messages, notifications beyond these social flows, extension/native applications and every Phase 04+ feature remain deferred. The Phase 02 tools/camera are clearly labeled previews.

## Ready for next phase

**NO.** Phase 03 must be reviewed and explicitly accepted by the product owner. Keep `ACTIVE_PHASE: 03` and the existing active specification. This report does not authorize Phase 04.
