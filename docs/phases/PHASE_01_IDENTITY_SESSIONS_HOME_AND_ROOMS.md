# Phase 1 — Identity, Sessions, Home & Rooms

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

Implement real user identity, account/session handling, the first usable home experience, and persistent room creation/joining without yet implementing the full room feature set.

# Prerequisites

- Phase 0 has been completed, reviewed, and accepted.
- Existing architectural/security tests are green before beginning.

# In Scope

- Google OAuth login.
- Microsoft OAuth login.
- Discord OAuth login.
- User/profile records.
- Persistent server-managed sessions.
- Session/device management UI.
- Home shell/navigation.
- My Rooms.
- Create room.
- Join room.
- Public/private/unlisted room model.
- Invite-link foundations.
- Basic Discover page and active-room cards using currently available data.
- Room ownership/membership records.
- Permission framework integration.

# Explicitly Out of Scope

- Realtime presence beyond minimal connection state needed for testing.
- Friends system.
- Tasks/chat/Pomodoro functionality.
- RTC/media.
- Background library.
- Mini-games.

## Identity

Use authorization-code flows with PKCE and appropriate state/nonce validation.

The browser must not receive long-lived provider secrets unnecessarily.

Support linking multiple OAuth identities to one account only through an explicit, safe flow.

## Sessions

Implement:
- persistent low-friction sessions;
- transparent rotation;
- logout;
- logout all other devices;
- revoke one session;
- step-up reauthentication hooks for future sensitive actions.

## Rooms

Room model must support:
- owner;
- membership;
- privacy: public/private/unlisted;
- name;
- optional description/tags;
- persistent existence when owner is offline;
- future moderator roles;
- invite links.

Do not make owner presence a prerequisite for room availability.

## Authorization

Test direct HTTP requests for:
- creating rooms;
- reading private rooms;
- joining rooms;
- modifying room data;
- enumerating room IDs.

Do not trust `ownerId`, `userId`, or `role` from client payloads.

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

- [ ] User can sign in using each configured OAuth provider in the intended environments.
- [ ] Session survives normal browser restart without exposing tokens to JS.
- [ ] User can create and re-enter a room.
- [ ] Owner can access owned room.
- [ ] Unauthorized user cannot fetch/modify private room through direct API calls.
- [ ] Unlisted/public/private behavior matches specification.
- [ ] Session revocation works.
- [ ] Home/My Rooms render real backend data.
- [ ] Hostile-client authorization tests exist for room objects.

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
