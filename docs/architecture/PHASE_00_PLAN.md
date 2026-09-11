# Phase 00 architecture decision record

Authority: `docs/UMBRELLA_SPEC.md`, read in full, followed by `docs/phases/PHASE_00_FOUNDATIONS.md`. The original `studyverse_umbrella_product_spec.md` and the new canonical file were compared and are byte-identical. Neither specification is edited.

## Scope and boundaries

- `apps/web`: Nuxt 4 application skeleton; no identity, home, room shell or product UI.
- `apps/api`: Fastify composition root and shared HTTP/WebSocket transport security.
- `packages/contracts`: version 1 JSON schemas, typed envelopes, generated JSON Schema/OpenAPI; no server/framework dependencies.
- `packages/feature-sdk`: stable interfaces for core infrastructure and feature declarations.
- `packages/core`: registry, lifecycle, authorization, commands, events, flags, sessions, UI/tile contracts. Server and browser exports are separate.
- `packages/adapters`: PostgreSQL, Redis and IndexedDB adapters via separate exports.
- `packages/ui`: generic Vue extension and tile hosts, lazy renderers, safe text and error fallback.
- `packages/features`: reserved; production composition has no concrete feature modules.
- `tests/fixtures`: synthetic module/resources only, never shipped in app bundles.
- `infra`, `scripts`, `.github`: local topology, migrations, enforcement and CI.

Dependency direction: contracts <- SDK <- core; adapters consume SDK/core interfaces; UI consumes browser-safe core/SDK/contracts. Features consume SDK/contracts and their own dependencies. App composition roots select public module exports. Core never imports concrete features; browser code never imports server drivers or entry points. Cross-feature internal imports are forbidden.

## Contracts and lifecycle

Modules declare ID/version, required/optional dependencies with compatible major versions, capabilities, permissions, commands/queries, HTTP/realtime mappings, events/subscriptions, persistence namespaces, migrations, settings, flags, UI contributions, tile types, jobs and start/stop hooks. Duplicate IDs/routes and dependency cycles fail before serving. Dependencies start first and stop last. Failed optional modules roll back registrations; required failures abort startup. Hooks/jobs/subscribers have timeouts and cooperative cancellation. Third-party untrusted plugins are not supported: in-process modules remain trusted application code.

Commands request changes; schema-validated events describe facts after changes. Transport bindings dispatch to the same operation pipeline. GET/HEAD bind only to queries. Version 1 HTTP lives under `/api/v1`; WebSocket envelopes carry a required version. Generated language-neutral schemas enable future extension/native code generation. Breaking changes require a new protocol major and compatibility policy; capabilities negotiate support, never access.

The exact registered `GET /api/v1/ready` is an explicit infrastructure exception: its bounded dependency probe runs without session access or application rate counters. Only that route accepts an Origin-less loopback authority from a loopback socket peer; other routes retain their original security pipeline. Supplied Origins remain validated. The handler permits no body/query fields or other methods and returns a two-value health result within two seconds. This corrects Node fetch's ignored Host override in the original Docker healthcheck, without a general missing-Origin exception.

Phase 00 event delivery is in-process and best effort. It is not a transactional outbox, cross-instance broker or durable task queue. Later transactional domain mutations must resolve authorization and writes within one transaction or equivalent atomic invariant, then publish committed facts.

## Security and persistence

Clients can forge every ID/role/payload. Session identity is server-derived. Capability policies load current resource relationships and fail closed. Unknown capabilities and missing/inaccessible resources are denied. Field schemas reject unknown properties. Per-operation and ingress rate limits apply to HTTP and WebSocket messages. Output schemas restrict response fields. Parameterized SQL handles data; only checked-in migrations supply DDL.

Opaque high-entropy cookies use `__Host-`, Secure, HttpOnly, SameSite=Lax and Path=/. Durable session rows store token digests, opaque subject identifiers, expiry/revocation and separate CSRF material. Rotation atomically invalidates the old token while retaining the logical session ID, so concurrent revocation also invalidates the replacement credential. No login or session-management UI/endpoint is authorized. CSRF tokens are anti-forgery values held only in client memory, never authentication credentials. Mutations require them plus allowed Origin/Host; cross-site Fetch Metadata is rejected. WebSocket authentication is checked on upgrade and rechecked for every command, including current permission and CSRF for mutations. Idle revoked sockets are periodically closed. Query-string credentials are rejected.

PostgreSQL migration ledger uses owner/ID/checksum, transactions and advisory locking. Runtime roles have no DDL. Core creates session infrastructure only; account and room schemas belong to their later phases. Future modules own durable schemas and ephemeral namespaces. Composition collects module migrations in dependency order, independent of runtime flags; IDs increase within each owner. Disabled modules retain durable data. Migration history is append-only; corrections use new migrations. The parameterized SQL tag belongs to the SDK so features do not need a driver dependency.

Redis provides namespaced TTL state and atomic counters, never authoritative identity or permissions. Security-critical Redis failures fail closed. IndexedDB permits only declared versioned preference schemas, validates old and new data, supports local migration/clear/delete, and falls back to memory if unavailable. It neither stores authentication credentials nor uploads data.

## UI and flags

Named extension points follow umbrella section 57A.3. Tile types declare lazy renderer, minimum/default sizes, layout schema, resize/fullscreen capability, permission hints and lifecycle. Host tracks one instance per resource identity. Phase 00 does not implement camera ownership, drag/resize controls, or canonical room layout; those behaviors remain requirements for later phases. UI permission hints are not authorization. Flags support disabled/development/cohort/scope/global rules evaluated on the server.

## Development and validation

Node 24 baseline and npm workspaces; exact dependency lock. One-command Docker Compose topology: localhost HTTPS proxy -> Nuxt and API; private PostgreSQL/Redis; migration job gates API start. Development secrets are randomly generated into ignored files. Local CA trust is explicit setup; Secure cookies are never disabled. Production TLS terminates at the trusted proxy; API upstream is private. Never trust client-supplied forwarded IP headers without a configured proxy boundary.

Checks: formatting, ESLint, strict TypeScript, builds, unit tests, Fastify integration, real WebSocket clients, real PostgreSQL/Redis tests, browser smoke, contract drift, negative architecture tests, secret/source scanning and dependency audit. CI adds CodeQL and Gitleaks. Observability records safe structured security events and latency/counter hooks without private payloads or secrets.

## Acceptance mapping

| Criterion                          | Implementation / evidence                                      |
| ---------------------------------- | -------------------------------------------------------------- |
| Fresh clone starts                 | One-command Compose script, README setup, clean stack smoke    |
| Web/API compile                    | Nuxt/API builds and strict type checking                       |
| Migrations from zero               | Real PostgreSQL zero/rerun/checksum/privilege tests            |
| Redis works locally                | TTL, namespace and atomic rate-limit tests                     |
| Register module without core edits | Dummy module instantiated through composition                  |
| Dummy route/event                  | HTTP/realtime operation and event-subscription tests           |
| Unauthenticated access denied      | Missing/forged/expired/revoked credentials tests               |
| CSRF integration                   | Missing/wrong/cross-session/origin HTTP and WS cases           |
| Forbidden imports fail             | Source graph enforcement and deliberate bad fixtures           |
| No browser-stored auth             | Restricted preference adapter, static checks, browser smoke    |
| CI passes                          | Local full equivalent; hosted status only when a remote exists |
| No Phase 1+                        | Empty production feature list and scope review                 |

## Resolved inconsistencies and remaining risks

Room membership in the umbrella's core responsibilities means a relationship contract now, actual room data later. Session foundations do not imply login or device UI. Tile registry does not imply Phase 02 room UI. Future native compatibility requires JSON protocols, not Electron or an early native client. No requirement is weakened to make testing easier.

Environment risks: Docker is operational following reboot/recovery, and the corrected API readiness probe is healthy. Local CA trust remains explicit; no Git remote exists for hosted CI. Local validation passes, while hosted/fresh-clone checks remain unverified. Module and operation cancellation is cooperative; code must honor its signal. In-process feature code is not a sandbox. Real feature implementations will need feature-specific race, transaction, privacy and authorization review before activation.

References checked: [Nuxt installation](https://nuxt.com/docs/4.x/getting-started/installation/), [Fastify WebSocket lifecycle](https://github.com/fastify/fastify-websocket), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [node-postgres parameterization](https://node-postgres.com/features/queries).
