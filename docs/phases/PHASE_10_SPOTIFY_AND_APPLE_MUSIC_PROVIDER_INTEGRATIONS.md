# Phase 10 — Spotify & Apple Music Provider Integrations

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

Add provider-compliant personal music integrations and validate whether any additional shared-playback modes are contractually and technically allowed.

# Prerequisites

- Phase 9 has been completed, reviewed, and accepted.
- Existing architectural/security tests are green before beginning.

# In Scope

- Spotify personal integration where current API terms permit.
- Apple Music personal integration where available.
- Provider capability detection.
- Account linking.
- Device/player control where permitted.
- Current terms/API feasibility review for shared synchronization.

# Explicitly Out of Scope

- Any provider behavior that violates platform terms.
- Server-side rebroadcast of copyrighted music.
- OBS.

## Provider Compliance Gate

Before implementing any shared synchronization behavior:
- review current provider terms;
- document what is allowed;
- document account requirements;
- document commercial/development-mode limitations;
- feature-flag anything uncertain.

## Spotify

Treat as personal unless current rules explicitly permit the desired shared behavior.

## Apple Music

Implement personal playback first.

Only enable room-synchronized playback after both:
- technical validation;
- contractual/platform-policy validation.

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

- [ ] Provider login/playback works only within permitted capability.
- [ ] Provider tokens are handled securely.
- [ ] No room-sync feature ships without documented policy review.
- [ ] Provider outage does not affect unrelated room features.
- [ ] Provider modules can be disabled independently.

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
