# Phase 6 — Basic RTC: Mic, Camera & Screen Share

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

Introduce stable low-latency realtime communication under deliberately conservative development caps.

# Prerequisites

- Phase 5 has been completed, reviewed, and accepted.
- Existing architectural/security tests are green before beginning.

# In Scope

- SFU integration.
- Microphone.
- Camera.
- Screen share.
- Device selection.
- Participant-circle live camera.
- Single-instance expanded camera tile.
- Screen-share workspace tile.
- Basic per-user send/receive settings.
- Initial RTC diagnostics.
- Development bitrate ceilings.

# Explicitly Out of Scope

- 1080p60+ camera.
- 1440p/high-refresh screen share.
- Custom arbitrary FPS.
- OBS ingest.
- Studio Broadcast.

## Mandatory Early Caps

Owner amendment (2026-09-11 completion pass): enforce these capture/publish limits in the trusted product client:

```text
Camera send/expanded receive:
max 1280×720 @ 30 FPS

Participant circle:
target ~360p
max practical ~480p

Browser screen share:
max 1920×1080 @ 30 FPS
```

Server/provider enforcement remains mandatory for identity, room, membership/session and publish/subscribe/source capabilities. Stock LiveKit does not hard-police RTP resolution/FPS/bitrate; that limitation is documented resource/abuse policy and is not a Phase 06 blocker. See Umbrella §31A.3 owner amendment.

## Camera Rendering Rule

When camera is on:
- participant circle shows video.

When expanded:
- participant circle returns to avatar;
- exactly one camera renderer appears as a workspace tile.

Closing the tile returns camera to the circle.

## RTC Architecture

Use SFU architecture suitable for selective forwarding and future simulcast/SVC.

Do not build a large-room peer mesh.

## Basic Audio

Implement Standard/High voice path with Opus-oriented RTC defaults.

Studio mode may be scaffolded but should not expand Phase 6 excessively.

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

- [ ] Two+ clients can use mic/camera/screenshare reliably.
- [ ] Trusted product camera requests and encoding are capped at 720p30; hostile RTP enforcement limits are documented.
- [ ] Trusted product screen-share requests and encoding are capped at 1080p30 with conservative bitrate.
- [ ] Participant circles do not receive wasteful full-resolution streams.
- [ ] Expanded camera never duplicates the same camera renderer.
- [ ] Device change/reconnect is handled gracefully.
- [ ] Unauthorized room user cannot publish/subscribe via crafted signaling.

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
