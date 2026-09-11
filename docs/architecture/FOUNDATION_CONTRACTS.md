# Foundation contracts and security review

Scope: Phase 00 infrastructure only. The umbrella specification remains authoritative. This document explains extension responsibilities; it does not authorize implementation of a later feature.

## Module composition

`FeatureModule` in `@study/feature-sdk` declares identity/version, dependencies, permissions, operations, HTTP/realtime bindings, events/subscriptions, flags, persistence namespaces, migrations, settings, UI/tile contributions, jobs and lifecycle hooks. Applications construct modules with explicit infrastructure dependencies, then pass them to `ModuleRuntime.start`. Core has no feature-specific dispatch switch. The only synthetic module lives in `tests/fixtures/dummy-module.ts`.

Dependencies use compatible major versions, are topologically ordered, and must be available before their dependent starts. Required module startup failures abort startup and unwind prior modules. Optional startup failures remove partial registrations and call cleanup. Shutdown unregisters entry points and stops modules in reverse dependency order. Duplicate IDs, invalid names, unknown permissions/flags, incompatible dependencies, cycles and conflicting routes are rejected.

Registration IDs use the module prefix, for example `fixture.write`. Durable migration owners must match the module ID and use the same public identifier schema; migration IDs use four digits plus a descriptive suffix. The logical owner is ledger data, not an interpolated SQL identifier. Durable schemas, ephemeral namespaces and local preferences are explicit ownership declarations. Modules own their queries and receive a `Database` interface; features never import `pg`, Redis or HTTP/WebSocket drivers. Ownership declarations and boundary tests are architectural controls over trusted code, not a sandbox for arbitrary plugins.

Hooks, event subscribers and one-shot jobs have bounded execution with cooperative abort signals. Operations have a five-second default deadline and return a sanitized unavailable error on timeout. Redis commands have abort deadlines and a bounded client queue. Code must honor cancellation and release its own resources in `stop`, including after partial startup. CPU loops and non-cooperating promises cannot be forcibly terminated in-process; a timeout is not proof that an in-flight mutation did not commit. Jobs are lifecycle tasks, not a durable scheduler. Keep module constructors free of network and database side effects.

## Commands, events and transport registration

An `OperationContract<I, O>` carries ID, command/query kind and runtime input/output schemas. `defineOperation` retains typed handler arguments/results and erases types only at the registry boundary. `OperationRegistry.invoke` supports typed internal callers; untrusted transports use the same registry's runtime validation path. A command must declare a permission and a server-side resource resolver. Every operation has a rate policy. Protected queries use the same authorization pipeline.

`HttpBinding` separates body, URL parameters and query input. Composite inputs remain `{ params, query, body }`, preventing a body field from overwriting a URL identity. GET/HEAD can bind only to queries. Realtime bindings map versioned command names to these same operations. Features register bindings, not Fastify handlers or socket listeners. Only the API composition layer owns those concrete transports.

Events are schema-validated facts. Typed publishers use registered `EventDefinition<T>` contracts. Subscriber failures are isolated, payloads are cloned, and shutdown disposes subscriptions. A feature may subscribe to another feature's public event when it declares the dependency. Public protocol/schema definitions belong in shared contracts; no private cross-feature imports are permitted.

The event bus is in-process and best effort. Publishing after a transaction is not durable delivery. Later domain mutations must enforce current authorization and writes together in an appropriate transaction/lock or conditional update, and publish only committed facts. Cross-instance distribution, transactional outboxes and durable queues are outside Phase 00. No event is automatically broadcast to all sockets; every future subscription will need resource-specific authorization.

## Versioned clients

HTTP uses `/api/v1`; WebSocket messages require envelope `version: 1`. `packages/contracts/generated` contains language-neutral JSON Schema and OpenAPI 3.1 files. The API generator reads actual foundation route declarations and fails on unsupported new request shapes rather than silently omitting them. CI rejects artifact drift. This phase exposes only health, readiness, protocol capabilities, and the current session's CSRF value.

Protocol capabilities describe available behavior. They never grant authority. Unknown envelope fields, unsupported versions and malformed payloads are rejected. A breaking change requires a new protocol major, an explicit compatibility window and regenerated schemas. Future browser extensions and true native clients can generate their own clients from these schemas. Their credential exchange, OS secure storage and origin rules require a later specification; arbitrary new origins are not enabled preemptively.

## Hostile-client model

An authenticated person can inspect all frontend code, copy requests, script HTTP/WebSocket clients, forge fields, enumerate IDs and replay messages. JavaScript visibility, UUIDs, hidden buttons, client roles, feature flags and TypeScript types are never authority. HTTPS and cookies protect credential transport; they do not make an authenticated client trustworthy.

| Threat / boundary                                    | Foundation control and evidence                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Missing, forged, expired or revoked credentials      | Server-side session lookup and expiry/revocation checks; HTTP, socket and session tests                                     |
| Forged subject/role/owner/scope fields               | Identity only from the session; strict input schemas reject undeclared fields                                               |
| Cross-user access, guessed IDs, resource enumeration | Server resolver and deny-by-default permission policy; missing/inaccessible objects return the same forbidden result        |
| Stale room/relationship claims                       | Policy callback resolves current server relationships per action; tests revoke synthetic membership after socket connection |
| CSRF and cross-site WebSocket hijacking              | Session-bound anti-forgery value for mutations, exact allowed Host/Origin, Fetch Metadata checks, no permissive CORS        |
| Session theft from browser storage                   | Secure HttpOnly host cookie; preferences allowlist; source checks and real browser inspection                               |
| Session fixation / rotation races                    | Server-generated entropy, stored token digest, atomic credential replacement with stable logical session ID                 |
| SQL injection / privileged DDL                       | Parameterized SDK SQL helper, separate runtime/migration roles, dedicated real database tests                               |
| Request or socket flooding                           | Payload/frame limits, peer and subject counters, bounded pending frames/connection counts, output-buffer checks             |
| Redis outage                                         | Security-critical rate limiting fails closed; no production memory fallback                                                 |
| Private data leaked in errors/logs                   | Fixed error messages, output schemas, generated request IDs and secret redaction                                            |
| XSS in extension text                                | Escaped Vue text, lazy renderer error boundaries, strict CSP, prohibited unsafe rendering patterns                          |
| Accidental architectural bypass                      | AST import/re-export/dynamic-import checks, transitive browser graph checks, negative fixtures and CI                       |

Permissions represent actions on server-resolved resources, such as the synthetic `fixture.write` capability. The current subject, session, resource owner and membership are compared on the server. Capability discovery is not a list of client-trusted grants. Each later protected action needs its own cross-user, cross-scope, stale-membership and race tests. A denied policy must not return resource metadata or differing not-found detail.

## Sessions and CSRF

The exact registered `GET /api/v1/ready` infrastructure endpoint is a narrow exception to the application transport pipeline. It accepts the configured public Host or an Origin-less loopback authority from an actual loopback socket peer; it does not trust forwarding headers. An invalid supplied Origin or cross-site Fetch Metadata is rejected. Other methods, paths and application endpoints receive no exemption. The probe performs only the configured PostgreSQL read and Redis PING, without session access or application rate counters. Empty input and the two-value health schema bound its response; dependency failure, exception or a two-second deadline returns 503. Concurrent probes share pending work, including a stalled check. OpenAPI documents its 503 health response.

Core creates a 256-bit random opaque credential and stores its SHA-256 digest in PostgreSQL, alongside the subject UUID, stable session UUID, creation time, absolute/idle expiry, revocation and separate CSRF material. No plaintext authentication credential is persisted server-side. The cookie is `__Host-study-session`, `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`, with no Domain attribute.

Defaults are a 30-day absolute lifetime and a 7-day idle/rotation window. Reads do not extend expiry. Explicit trusted rotation replaces both credential and CSRF material atomically, preserves the original absolute expiry and logical ID, and requires the old digest still to be current. Revoking the stable logical ID also invalidates a credential rotated concurrently. No user-facing issue, rotate or revoke endpoint exists in this phase. Later authentication must prove identity before calling these trusted primitives and define its rotation schedule.

Cookie-authenticated mutations require a session-bound CSRF value plus an exact allowed Origin. The authenticated CSRF query returns only that session's value and does not set cookies. The browser API client retains this anti-forgery value in its own memory closure, sends credentials only to relative versioned same-origin API paths, and clears cached CSRF on relevant failures. It does not store cookies, refresh tokens or authentication material in localStorage, sessionStorage or IndexedDB. Replaying a command with a valid current credential and CSRF value still requires present authorization and rate limits; business-level idempotency belongs to the command's later domain contract.

WebSocket upgrades require the cookie and allowed Host/Origin. Query-string credentials and arbitrary origins are rejected. Each message reauthenticates the session, validates its envelope/payload, applies rates and executes current authorization. Mutating commands additionally verify CSRF. Periodic revalidation closes idle revoked/expired sockets. Permission changes take effect at the next action; future server-pushed resource subscriptions must also respond to revocation.

These rules protect against hostile clients, not against server compromise or malicious trusted module code. Client-side code execution could send requests as the signed-in user even with HttpOnly cookies, so safe rendering, CSP, dependency checks and reviewed UI modules remain required.

## Persistence, preferences and flags

PostgreSQL owns durable session state. Core owns `core.sessions`; the migration system owns `foundation.migrations`. No user, room, task or chat tables exist. The future identity phase must reconcile the opaque subject UUID with its account schema without silently changing session ownership. There is no automatic retention/deletion job yet. A later retention policy must preserve required audit/privacy semantics and remove expired session records appropriately.

Migration manifests remain independent of whether a feature is enabled. Owners and IDs are immutable, IDs ascend per owner, dependency order is preserved, and applied checksum/history drift fails. Every migration runs in a transaction under a single advisory lock. Rollbacks of application code do not silently undo database history. Runtime credentials receive only explicitly granted DML; migration credentials never enter the application process or frontend.

Redis stores namespaced TTL data and atomic fixed-window rate counters, not identity, permission or other authoritative domain state. Keys and values have explicit bounds, and state requires expiry. Namespaces express module ownership; injected adapters remain trusted application dependencies. Multi-instance persistent eventing and distributed connection limits are not implemented. The local Redis has no persistence, and losing its counters starts a new rate window.

The IndexedDB adapter accepts registered, versioned schema definitions, validates values, can migrate old local records, and supports get/set/delete/clear. It rejects authentication-like keys and fields. Corrupt records return validated defaults; unavailable or quota-limited IndexedDB falls back to explicitly reported in-memory storage. There is no automatic network synchronization. Preferences must contain only nonsensitive, user-clearable local choices.

Feature flags support disabled, global, development, explicit-subject cohort and resource-scope rules. The server evaluates them after authorization; a flag never overrides a denied permission. No user flag-editing UI, experimental feature, room setting or product preference is introduced.

## UI extensions and tile host

UI contributions register a named umbrella extension point, ID, label, stable order, lazy renderer and optional permission hint. The generic host isolates render errors and supplies loading/error fallbacks. Frontend permission hints affect presentation only. They cannot make a backend operation public.

Tile definitions register type, lazy renderer, minimum/default dimensions, versioned layout schema, resize/fullscreen capability, permission hint and open/close callbacks. The generic tile host preserves one instance per type/resource identity, validates layout changes and invokes lifecycle hooks. Actual room composition, drag/resize controls, shared media resources, camera ownership and room-specific fullscreen rules remain later-phase requirements.

## Review gates for later phases

Real PostgreSQL/Redis integration, fresh-stack startup and hosted CI must pass before readiness is claimed. Then review the new phase specification, identity/session policy, current-resource authorization/transaction design, data ownership/migrations, transport limits, public schemas and UI extension use. Only the user can authorize the next phase by providing its specification.
