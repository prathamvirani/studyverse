# Phase 5 — Backgrounds & Environment Assets

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

Implement the visual environment system: curated backgrounds, secure uploads, favorites, and extensible scene/provider architecture.

# Prerequisites

- Phase 4 has been completed, reviewed, and accepted.
- Existing architectural/security tests are green before beginning.

# In Scope

- Background module.
- Curated built-in background catalog.
- Target of ~60+ calm/low-distraction backgrounds for production content population.
- Static images.
- Long-loop GIF/animated backgrounds.
- User uploads.
- Favorites.
- Room/personal background permissions.
- Asset storage abstraction.
- Upload security pipeline.
- Future scene hooks.

# Explicitly Out of Scope

- Native ambience audio unless intentionally pulled forward.
- RTC/media providers.

## Asset Handling

Validate:
- actual file type;
- size;
- dimensions;
- decode success;
- animation constraints.

Sanitize/re-encode where practical.

Serve user content from an isolated media origin/domain in production.

## Performance

Animated backgrounds must not unnecessarily burn CPU/GPU when:
- tab hidden;
- reduced-motion enabled;
- low-power mode is active where detectable.

## Modularity

Background providers/assets must register through the environment/background module, not RoomShell.

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

- [ ] Built-in and uploaded backgrounds can be selected.
- [ ] Background choice persists according to room/personal scope.
- [ ] Malicious/invalid uploads are rejected.
- [ ] User uploads cannot execute active content.
- [ ] Reduced-motion fallback works.
- [ ] Background module can be disabled without breaking room shell.

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
