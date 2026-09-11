# Phase 13 — Browser Companion Extension

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

Create an optional privacy-conscious browser extension that bridges authenticated/embedding-restricted study content into the personal workspace without proxying credentials.

# Prerequisites

- Phase 12 has been completed, reviewed, and accepted (roadmap sequencing only).
- This is a companion-platform layer over mature web identity, versioned protocols and the Personal Study Player (Phase 09). OBS and mini-games are not functional prerequisites.
- Existing architectural/security tests are green before beginning.

# In Scope

- Extension architecture.
- Attach current tab.
- User-directed metadata capture.
- Open page in Personal Study Player where possible.
- Context-menu/toolbar actions.
- Explicit host permissions.
- Secure message bridge to web app.

# Explicitly Out of Scope

- Password extraction.
- Cookie exfiltration.
- Broad browsing surveillance.
- Automatic history collection.
- Bypassing DRM/security restrictions.

## Permissions

Request the minimum browser permissions possible.

Avoid broad host permissions unless a specific feature requires them and the user explicitly approves.

## Privacy

The extension must not:
- read password fields;
- export browser cookies;
- silently collect browsing history;
- transmit unrelated page data.

## Architecture

Use versioned protocol contracts shared with the web/backend where possible.

Feature capability should be negotiated rather than assumed.

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

- [ ] User can explicitly attach a supported tab.
- [ ] Non-attached tabs are not inspected/transmitted.
- [ ] Permission prompts are understandable.
- [ ] Extension removal leaves web product functional.
- [ ] Protocol is versioned and tested.

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
