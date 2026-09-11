# Phase 0 — Foundations

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

Establish the repository, architecture, security foundations, contracts, local development environment, and enforcement mechanisms that every later feature will depend on. No end-user product feature should be substantially implemented yet.

# Prerequisites

- None beyond the umbrella specification and an empty/new repository.

# In Scope

- Monorepo/repository structure.
- Nuxt + TypeScript web application skeleton.
- Backend application/service skeleton.
- PostgreSQL development database and migration system.
- Redis/ephemeral-state abstraction.
- IndexedDB/local-preference abstraction.
- Shared typed contracts between web and backend.
- Module registry and module lifecycle contract.
- Typed command/event bus and realtime handler registry.
- Capability/permission registry.
- Workspace-tile registry and named UI extension points.
- Feature-flag framework.
- Server-managed session architecture with Secure + HttpOnly cookies.
- CSRF defenses, request validation, origin/host checks where appropriate.
- Error model and structured logging.
- Testing framework: unit, integration, authorization, architecture-boundary tests.
- CI, formatting, linting, type checking, secret scanning, dependency checks.
- Docker/local development environment.
- Environment/configuration validation.
- Baseline observability hooks.

# Explicitly Out of Scope

- OAuth user-facing login flow.
- Real room creation/joining UI.
- Friends/presence.
- Real chat/tasks/Pomodoro.
- Background library.
- Camera/microphone/screen sharing.
- LiveKit/SFU integration.
- Media providers.
- Mini-games.
- OBS ingest.
- Browser extension.
- Native applications.

## Required Architecture

Create a deliberately small core. Suggested direction:

```text
apps/
  web/
  api/

packages/
  contracts/
  core/
  ui/
  feature-sdk/
  features/

infra/
docs/
tests/
```

Exact names may change, but dependency direction must be enforced.

### Core must own
- auth/session primitives;
- authorization framework;
- module registry;
- typed events/commands;
- realtime transport abstraction;
- persistence abstractions;
- feature flags;
- shared error contracts;
- observability hooks;
- UI extension registries;
- workspace tile host contract.

### Feature modules must own
Their domain logic, routes, realtime handlers, permissions, migrations, settings, UI contributions, and tests.

Create public interfaces so later features can register themselves without editing core switch statements.

## Security Foundation

Implement:
- server-owned sessions;
- HttpOnly Secure cookies;
- session rotation/revocation support;
- CSRF defense for cookie-authenticated mutations;
- request schema validation;
- no auth secrets in localStorage/sessionStorage/IndexedDB;
- parameterized DB access;
- standard authorization middleware;
- standard rate-limit hooks;
- WebSocket auth/authorization hooks;
- safe configuration/secrets handling.

## Architectural Enforcement

Add tests/lint rules where practical so:
- core cannot import concrete features;
- features cannot import another feature's internal files;
- cross-feature communication uses public contracts/events;
- route and realtime registration use registries;
- UI contributions use named extension points.

## Local Development

One command should bring up a useful development environment, including required infrastructure.

Document:
- required runtime versions;
- environment variables;
- setup;
- migrations;
- test commands;
- reset commands.

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

- [ ] Fresh clone can be started from documented instructions.
- [ ] Web and API compile/type-check successfully.
- [ ] PostgreSQL migrations run cleanly from zero.
- [ ] Redis abstraction works locally.
- [ ] Module can be registered without editing core implementation logic.
- [ ] Dummy route/event registration proves registries work.
- [ ] Authorization middleware denies unauthenticated access in tests.
- [ ] CSRF protections are exercised in integration tests.
- [ ] Architecture-boundary tests fail on forbidden imports.
- [ ] No authentication token is stored in browser-readable storage.
- [ ] CI passes.
- [ ] No Phase 1+ feature is substantially implemented.

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
