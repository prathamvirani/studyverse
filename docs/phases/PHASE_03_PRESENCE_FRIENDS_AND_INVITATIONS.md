# Phase 3 — Presence, Friends & Invitations

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

Make rooms socially alive: realtime presence, status, friends, participant menus, and invitations.

# Prerequisites

- Phase 2 has been completed, reviewed, and accepted.
- Existing architectural/security tests are green before beginning.

# In Scope

- Realtime room presence.
- Online/focusing/break/away/DND/offline states.
- Participant join/leave events.
- Friends/friend requests.
- Remove/block.
- Invite friend to room.
- Privacy-aware friend activity.
- Participant context-menu social actions.
- Basic notifications needed for these flows.

# Explicitly Out of Scope

- Direct messaging unless required by a later explicit revision.
- RTC.
- Tasks/chat/Pomodoro.
- Media.

## Presence

Presence should be ephemeral and recover safely after reconnect.

Handle:
- reconnect;
- tab suspension;
- laptop sleep/wake;
- abrupt disconnect;
- duplicate tabs/devices.

## Privacy

Users must control whether others can see:
- online status;
- current room;
- joinability;
- study status.

Blocking must be enforced server-side and affect relevant discovery/invite/social flows.

## Realtime Security

WebSocket connection success does not confer broad permissions.

Validate room membership and permissions per action.

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

- [ ] Friends see permitted presence updates in realtime.
- [ ] Blocked users cannot bypass restrictions through direct API/socket calls.
- [ ] Room participant rail updates correctly on join/leave/reconnect.
- [ ] Privacy controls are enforced by backend, not only hidden in UI.
- [ ] Friend request replay/ID tampering tests pass.

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
