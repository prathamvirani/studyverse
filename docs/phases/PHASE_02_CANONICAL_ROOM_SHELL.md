# Phase 2 — Canonical Room Shell

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

Build the room experience visually and structurally with fake/demo feature data where needed. This phase establishes the UI identity before realtime/product complexity is layered on.

# Prerequisites

- Phase 1 has been completed, reviewed, and accepted.
- Existing architectural/security tests are green before beginning.

# In Scope

- Full-screen background-first room shell.
- Minimal top bar.
- Left participant rail.
- Right rail in canonical order: Pomodoro → Tasks → Chat.
- Bottom dock: Media → Background → Mic → Camera → Share → More.
- Central workspace layer.
- Draggable/resizable workspace tiles.
- Tile z-order/minimize/maximize/fullscreen behavior.
- Named UI extension points.
- Participant context-menu shell.
- Responsive layout.
- Reduced-motion/accessibility behavior.
- Local persistence of layout/panel preferences.

# Explicitly Out of Scope

- Real friend data.
- Real Pomodoro/tasks/chat behavior.
- Actual camera/mic/screenshare.
- Real media providers.
- Background catalog.

## Canonical UX

Do not turn the room into:
- a dashboard;
- a Zoom grid;
- a Discord clone;
- a generic card layout.

The background is visually dominant.

## Participant Rail

Use circular avatars in a narrow left rail.

Implement the state model required later for:
- avatar;
- live camera in circle;
- avatar restored when camera is expanded.

For now, demo/mock media may be used to prove the rendering states.

## Workspace Layer

Implement a generic tile registry and host.

A tile type registers:
- renderer;
- default/min dimensions;
- resizable/fullscreen flags;
- serialization of local layout state;
- lifecycle hooks.

Do not special-case future camera/screen-share logic directly into drag/resize code.

## Local Persistence

Persist:
- tile position/size;
- panel collapse state;
- selected local UI preferences.

Use non-sensitive local storage only.

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

- [ ] Room looks and behaves like a background-first immersive space.
- [ ] All canonical zones exist in correct hierarchy/order.
- [ ] Workspace tile can be registered without editing the host.
- [ ] Dragging/resizing/minimize/restore works.
- [ ] Layout restores after reload on same device.
- [ ] Reduced-motion preference is respected.
- [ ] Camera-circle vs expanded-tile state can be demonstrated with mock content using only one active render target.

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
