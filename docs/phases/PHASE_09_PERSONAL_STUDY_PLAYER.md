# Phase 9 — Personal Study Player

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

Add private personal study media with local-first persistence, resumable playback, provider adapters, and independent mixing.

# Prerequisites

- Phase 8 has been completed, reviewed, and accepted.
- Existing architectural/security tests are green before beginning.

# In Scope

- Personal media tab/panel.
- Personal YouTube player.
- Supported provider adapter framework.
- Vimeo/direct media where practical.
- Private draggable media tile.
- Playback speed.
- Resume position.
- Local recent-media history.
- Independent personal volume.
- Room-music ducking.
- Optional voice-triggered ducking.
- Promote supported public media to room suggestion/playback.

# Explicitly Out of Scope

- Full embedded browser.
- University credential proxying.
- Browser extension.
- Cross-device personal playback sync by default.

## Local-First State

Store personal playback progress locally by default using IndexedDB.

Persist:
- canonical provider/content ID;
- safe canonical URL where appropriate;
- position;
- playback rate;
- volume;
- muted state;
- last opened time;
- tile position/size.

Strip transient/signed auth parameters where possible.

## Privacy

Default visibility: completely private.

Do not expose URL/title/history to room members unless user explicitly opts in.

## Provider Architecture

Providers register:
- URL matcher;
- metadata resolver;
- embed support;
- personal playback capabilities;
- room-sync capability;
- seek/play/pause support.

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

- [ ] User can close/reopen and resume supported media.
- [ ] Playback progress remains local by default.
- [ ] Another room user cannot query personal-media history through API.
- [ ] Room music ducking works cleanly.
- [ ] Unsupported/private provider fails safely without credential proxying.
- [ ] Provider adapter can be added without changing core Personal Player logic.

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
