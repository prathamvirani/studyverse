# Phase 7 — Advanced RTC & Quality Control

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

Add genuinely granular user-controlled send/receive profiles after Basic RTC is stable and measured.

# Prerequisites

- Phase 6 has been completed, reviewed, and accepted.
- Existing architectural/security tests are green before beginning.

# In Scope

- Basic vs Advanced quality modes.
- Separate send/receive ceilings.
- Requested vs actual quality.
- Adaptive tile-aware receive.
- Simulcast/SVC where supported.
- Saved quality profiles.
- Codec preference negotiation.
- Custom resolution/FPS framework.
- Live diagnostics.
- Studio Voice microphone mode.
- Progressive higher-quality feature flags.

# Explicitly Out of Scope

- OBS/Studio ingest.
- Native-client capture.

## Progressive Unlock

Do not jump directly to maximum theoretical profiles.

Validate progressively:

```text
Stage A: 1080p30/60 experiments
Stage B: 1440p60
Stage C: custom resolutions / custom FPS
Stage D: higher-refresh experimental profiles
```

Each stage requires measured:
- CPU;
- bitrate;
- SFU load;
- decode compatibility;
- packet loss behavior;
- client thermals/power where relevant.

## Advanced UI

Expose:
- requested width/height;
- source resolution;
- requested FPS;
- actual FPS;
- bitrate ceiling;
- actual bitrate;
- codec;
- content type;
- quality vs latency priority.

Never claim requested == achieved.

## Studio Voice

Provide a high-quality voice mode with minimal DSP:
- echo cancellation off by default;
- noise suppression off by default;
- AGC off by default;
- appropriate high-quality Opus profile;
- user can selectively re-enable processing.

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

- [ ] Receive quality adapts to tile size up to user's chosen maximum.
- [ ] Basic mode remains understandable.
- [ ] Advanced mode exposes real controls without lying about actual delivery.
- [ ] Saved profiles restore correctly.
- [ ] Feature flags can enable/disable higher quality tiers.
- [ ] High-quality modes degrade gracefully on unsupported hardware/browsers.

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
