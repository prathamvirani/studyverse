# Phase 4 — Realtime Productivity: Pomodoro, Tasks & Chat

# Implementation Rules for This Phase

Before doing anything:

1. Read `docs/UMBRELLA_SPEC.md` in full.
2. Treat the umbrella specification as authoritative.
3. Execute **only this phase** unless a prerequisite defect must be corrected.
4. Do not silently reinterpret UX, security, modularity, privacy, or media behavior.
5. Do not implement later-phase features "while you're here."
6. Keep all substantial features modular and registered through stable contracts/registries.
7. Core infrastructure must not import concrete feature implementations.
8. A feature is not complete merely because the UI prevents an action; server-side authorization is mandatory.
9. Assume authenticated users can inspect, replay, modify, and script every HTTP/WebSocket request.
10. Run tests after each meaningful unit of work.
11. Stop at the end of this phase and report:
   - what changed;
   - tests run and results;
   - known limitations;
   - migrations/configuration added;
   - anything that must be reviewed before the next phase.

If the umbrella spec and this phase file conflict, the umbrella spec wins unless this phase file is a later explicit revision of the same requirement.


# Objective

Turn the right rail into a genuinely useful productivity surface with server-authoritative shared state and private personal state.

# Prerequisites

- Phase 3 has been completed, reviewed, and accepted.
- Existing architectural/security tests are green before beginning.

# In Scope

- Personal and Shared Pomodoro timers with a first-class scope toggle.
- Personal tasks.
- Shared room tasks.
- Room chat.
- Realtime synchronization.
- Permissions for shared tasks/timer/chat.
- Persistence policy.
- Rate limiting.
- XSS-safe rendering.

# Explicitly Out of Scope

- Calendar/Gantt integrations.
- RTC/media, SFU/LiveKit integration, voice/camera/screen sharing and WebTransport media.
- Later media architecture is recorded in `docs/architecture/TRANSPORT_PLAN.md`; documentation does not authorize implementation.
- Mini-games.

## Pomodoro

Owner amendment (2026-09-11) supersedes the original shared-only interpretation.

- First-class Personal / Shared toggle, mirroring Tasks. Switching scope must preserve both timers.
- Personal: independent private account-owned durable state, identity exclusively from the authenticated session, no other-user read/control endpoints, and no state in room subscriptions. Continue across rooms and recover after refresh/reconnect/server restart.
- Shared: independent room-owned durable state, current membership and owner-only control policy, deterministic stale-version conflict handling, and synchronized late join/reconnect.
- Both scopes use server timestamps and authoritative mutations. Clients project countdowns between updates; do not broadcast every second.
- Test forged owner IDs/timestamps/state, other-user access, cross-room access, unauthorized control and stale/revoked sessions.

## Tasks

Personal and Shared tasks retain separate durable tables and distinct ownership/permission policies. Do not merge them because they share a panel.

Personal tasks:
- private;
- user-owned;
- cross-room where appropriate.

Shared tasks:
- room-owned;
- permission-controlled;
- realtime synchronized.

## Chat

Use authenticated application WebSocket/realtime transport and HTTPS APIs, never RTCDataChannel. Persist ordered bounded history with authorization, moderation, rate limiting and reconnect/resync.

Implement:
- safe plain text;
- timestamps;
- basic reactions/mentions if in scope;
- moderation hooks;
- rate limiting.

Never render arbitrary HTML.

## Hostile Client Tests

Capture legitimate requests and deliberately mutate:
- task IDs;
- user IDs;
- room IDs;
- role fields;
- ownership fields;
- message payload sizes;
- timer commands.

Server must reject unauthorized variants.

# Required Tests

At minimum, add/maintain:
- unit tests for new domain logic;
- integration tests for API/realtime behavior;
- authorization tests for every new protected action;
- hostile-client tests that mutate IDs/roles/payloads where relevant;
- regression tests for any bug discovered during implementation;
- architecture-boundary tests so the module does not create forbidden dependencies.

Do not rely on manual clicking alone.

# Acceptance Criteria

- [ ] Pomodoro stays synchronized across clients and reconnects.
- [ ] Personal Pomodoro is private, server-authoritative and preserved across scope/room changes and reconnects.
- [ ] Personal tasks are inaccessible to other users and stored separately from Shared tasks.
- [ ] Shared task permissions work with direct API calls.
- [ ] Chat payloads containing HTML/JS are harmless.
- [ ] Chat spam is rate-limited.
- [ ] Timer-control permissions are enforced per socket command.

# End-of-Phase Deliverable

At completion, provide a concise phase report containing:

```text
Implemented:
- ...

Architecture/modules added or changed:
- ...

Database migrations:
- ...

Configuration/environment changes:
- ...

Security controls/tests:
- ...

Tests executed:
- ...

Known limitations:
- ...

Deferred intentionally to later phases:
- ...

Ready for next phase:
YES / NO
```

Do **not** begin the next phase automatically.
