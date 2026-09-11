# Phase 8 — Room Media, Ambience & Shared Mix

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

Implement shared room media, synchronized YouTube, ambience, queues, and the canonical owner-baseline / temporary-FFA control model.

# Prerequisites

- Phase 7 has been completed, reviewed, and accepted.
- Existing architectural/security tests are green before beginning.

# In Scope

- Unified Room Media panel.
- Synchronized YouTube.
- YouTube Music-compatible URL adapter where possible.
- Shared queue.
- Native ambience library.
- Independent ambience layers.
- Room media permissions.
- Suggestions.
- Owner baseline.
- Temporary owner-absent FFA override.
- Owner-return reconciliation.
- Empty-room reset.

# Explicitly Out of Scope

- Spotify room sync.
- Apple Music room sync until separately validated.
- OBS.

## YouTube Synchronization

Authoritative room state should include:
- content ID;
- playing/paused;
- playhead;
- playback rate;
- authoritative server timestamp;
- queue;
- controller identity.

Clients independently stream from provider and periodically correct drift.

## Owner Baseline

Persist owner's approved room mix durably.

Temporary owner-absent adjustments are ephemeral.

When owner returns:
- show who changed state;
- compare baseline vs temporary;
- Keep current;
- Restore mine;
- Review.

If room participant count reaches zero before owner returns:
- discard temporary override;
- restore baseline.

## Permissions

Configurable:
- Everyone controls;
- Suggestions only;
- Moderators;
- Owner only.

Owner-absent behavior separately configurable.

Permanent room settings must never become automatic FFA.

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

- [ ] Two+ clients remain synchronized on supported YouTube playback.
- [ ] Late joiner starts at correct current timestamp.
- [ ] Unauthorized media-control socket commands are rejected.
- [ ] Owner-absent temporary mix works.
- [ ] Owner-return reconciliation works.
- [ ] Empty-room reset restores last owner-approved baseline.
- [ ] Ambience can be room-synchronized or personal as designed.

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
