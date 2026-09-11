# Phase 11 — Social Bonding & Mini-Games

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

Add optional break-time social activities through the global modular architecture without coupling games to Pomodoro, RoomShell, or core realtime logic.

# Prerequisites

- Phase 10 has been completed, reviewed, and accepted (roadmap sequencing).
- Functional prerequisites are the accepted identity/room, workspace/UI registries, social privacy and application realtime contracts, plus Pomodoro break events. OBS, browser extension and native applications are not dependencies.
- Existing architectural/security tests are green before beginning.

# In Scope

- Mini-game module framework.
- Activity/game registry.
- One initial original Wordle-like word-puzzle game.
- One initial original drawing-and-guessing game inspired by the category, without copying protected branding/assets.
- Preserve the umbrella’s planned trivia, word association, icebreakers and simple board/card activities where appropriate; new activities use the same registry.
- Join/decline/spectate.
- Server-authoritative score/turn state.
- Pomodoro break suggestion integration via events.
- Mini-game SFX mixer entry.
- Room start permissions.

# Explicitly Out of Scope

- Large game platform.
- Complex matchmaking.
- Persistent competitive economy.
- Copying protected branding/assets from Wordle/Skribbl.

## Modularity

Games must register through generic activity contracts.

Pomodoro may emit a break event.

Mini-game module may listen and offer an optional suggestion.

Pomodoro must not import game code. Games must not couple directly into RoomShell, Pomodoro, Presence or Chat; integrate through public registries, contracts and events.

## Realtime Security

Server owns:
- game membership;
- turn;
- round;
- timer;
- accepted guesses;
- score;
- drawing ownership.

Reject:
- forged scores;
- drawing by non-drawer;
- unauthorized starts;
- impossible transitions;
- oversized drawing payloads.

## UX

A game must be:
- optional;
- dismissible;
- spectatable where practical;
- non-blocking to users who keep studying.

Break suggestions are optional and user-configurable. Never force or automatically start a game; participants explicitly join, decline or spectate.

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

- [ ] Game module can be disabled without affecting room productivity features.
- [ ] Initial games use common activity registry.
- [ ] Pomodoro integration is event-driven, not direct coupling.
- [ ] Forged game actions are rejected.
- [ ] Non-participants can continue using the room normally.

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
