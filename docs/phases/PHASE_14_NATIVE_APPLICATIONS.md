# Phase 14 — Native Applications

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

Build true native companion clients after the web platform and protocols are mature. Native applications must not be Electron or thin website wrappers.

# Prerequisites

- Phase 13 has been completed, reviewed, and accepted (roadmap sequencing only).
- This is a companion-platform layer over mature web identity, versioned protocols and media abstractions. The browser extension, OBS and mini-games are not functional prerequisites.
- Existing architectural/security tests are green before beginning.

# In Scope

- Native-client architecture planning.
- Shared protocol/domain libraries where appropriate.
- Platform-native UI.
- Native authentication/session integration.
- Native notifications.
- Native media/device integration.
- Potential high-refresh capture improvements.
- Native file integration.

# Explicitly Out of Scope

- Electron.
- Chromium-wrapped production desktop client.
- Thin embedded website shell presented as native.

## Non-Negotiable

Production native desktop apps must use native UI technology.

Possible direction:
- Windows: native Windows UI stack;
- macOS/iOS/iPadOS: Swift/SwiftUI/AppKit/UIKit as appropriate;
- Android: Kotlin/Jetpack Compose;
- Linux: GTK/Qt if justified.

Exact choices are made when this phase begins.

## Shared Components

Sharing is encouraged for:
- protocol/schema definitions;
- cryptographic helpers;
- domain models;
- sync algorithms;
- media abstractions;
- tests.

Do not force UI sharing at the expense of native behavior.

## Capability Negotiation

Native clients may advertise capabilities such as:
- native high-refresh capture;
- enhanced audio routing;
- hardware encoders;
- native notifications;
- file/document integration.

Backend must support capabilities without branching into hard-coded client-specific logic everywhere.

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

- [ ] Chosen client is demonstrably native, not Electron.
- [ ] Existing web client continues to function against same versioned protocol.
- [ ] Capabilities are negotiated cleanly.
- [ ] Native client does not require invasive changes to unrelated backend features.

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
