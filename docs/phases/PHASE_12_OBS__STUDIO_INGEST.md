# Phase 12 — OBS / Studio Ingest

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

Add advanced stream-key-style ingest after browser RTC is stable, with a low-latency path suitable for hardware-encoded OBS output.

# Prerequisites

- Phase 11 has been completed, reviewed, and accepted (roadmap sequencing only).
- Functional prerequisites are stable, measured browser RTC and media authority/quality contracts (Phases 06–07). OBS has no functional dependency on mini-games.
- Existing architectural/security tests are green before beginning.

# In Scope

- Studio/OBS setup UI.
- Temporary/revocable ingest credentials.
- WHIP/WebRTC ingest where practical.
- Compatibility fallback only if justified.
- SFU forwarding.
- Studio Broadcast audio.
- Hardware-encoded profiles.
- Ingest diagnostics.

# Explicitly Out of Scope

- Building OBS functionality into the browser.
- Permanent insecure stream keys.
- Server transcoding by default where avoidable.

## Security

Ingest credential must be:
- cryptographically random;
- scoped;
- revocable;
- regenerable;
- non-predictable;
- excluded from logs/analytics.

Prefer short-lived credentials where practical.

## Media Path

Prefer:
OBS hardware encode → WHIP/WebRTC ingest → SFU forwarding.

Avoid unnecessary server transcoding.

## UX

Offer:
- server/endpoint;
- masked stream key/credential;
- copy;
- regenerate;
- connection status;
- negotiated resolution/FPS/codec/bitrate.

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

- [ ] Revoked ingest credential cannot reconnect.
- [ ] OBS stream reaches authorized room only.
- [ ] Unauthorized user cannot publish using guessed IDs.
- [ ] Ingest stats show requested/actual behavior.
- [ ] Failure of ingest service does not break browser RTC.

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
