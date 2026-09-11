# Phase 00 report

Updated 2026-09-11 after the readiness regression fix. Scope is limited to `docs/phases/PHASE_00_FOUNDATIONS.md`, under the unchanged authoritative umbrella specification.

## Implemented:

- Nuxt/TypeScript placeholder and Fastify service in an npm-workspaces repository, with a local Git repository on `main`.
- Security foundations, versioned contracts, module/command/event/transport/UI registries, storage abstractions, feature flags, configuration validation and observability hooks.
- Docker development topology, migration tooling, documentation, CI, formatting, linting, type checking and security scans.
- Synthetic test modules only. No Phase 1+ product feature was implemented.
- Fixed the dedicated `GET /api/v1/ready` infrastructure endpoint and rebuilt the stack. Docker now marks the API **healthy**.
- Reproduced the root cause inside the container: Node's `fetch` ignored the custom Host override and sent `Host: 127.0.0.1:3001`. The shared Host/Origin guard reported `ORIGIN_REJECTED` for that Host mismatch. Adding the correct Origin still failed; `http.request` with the actual public Host and no Origin returned 200. Missing Origin alone was not the cause.
- Compared `UMBRELLA_SPEC.md` and `studyverse_umbrella_product_spec.md`: **byte-identical**, SHA-256 `EF7354AE996E3A815BD0F3DE53A24DCEAE169FAF2C003BD083ACB9D072893C51`. Neither document's contents changed.

## Architecture/modules added or changed:

- `apps/web` and `apps/api` are composition/transport boundaries. `contracts`, `feature-sdk`, `core`, `adapters` and `ui` expose explicit public interfaces. `packages/features` remains reserved.
- Modules declare compatible dependencies, permissions, operations, routes, realtime commands, events, migrations, flags, UI/tile contributions and bounded lifecycle hooks. Required failures abort startup; optional failures unwind registrations.
- HTTP and WebSocket commands share schema validation, current server-side authorization and rate limits. Typed internal callers use the same operation registry. Events have typed schemas and isolated subscribers.
- Browser/server entry points are separate. AST checks cover imports, re-exports, dynamic imports, extensionless barrels and transitive feature dependencies; negative fixtures prove enforcement.
- Readiness remains an explicit registered foundation GET route, with a narrowly allowlisted infrastructure handler. Ordinary endpoint Host/Origin, authentication, authorization, CSRF and rate-limit requirements remain unchanged.
- Added readiness integration/unit regressions and an actual Docker health test. The full suite includes Docker health validation, and CI starts the full stack before running it.
- The architecture plan and detailed contracts are in [PHASE_00_PLAN.md](architecture/PHASE_00_PLAN.md) and [FOUNDATION_CONTRACTS.md](architecture/FOUNDATION_CONTRACTS.md).

## Database migrations:

- `core/0001_sessions` creates the session table, indexes and restricted runtime grants. No account, room or feature table is created.
- `foundation.migrations` records immutable owner/ID/checksums. Migration application uses advisory locking and transactions, rejects missing/drifted history, and preserves dependency order with ascending IDs per owner.
- Future module manifests are collected independently of runtime enablement. Runtime and migration credentials are separate; application queries use parameters.
- Real zero-database migration, idempotency, drift/missing-history rejection, rollback, runtime privilege, parameterization and concurrent-session tests now pass against the isolated `study_test` database. No migration was added or changed for the readiness fix.
- Readiness performs only `SELECT 1 FROM core.sessions LIMIT 0` and Redis PING; it does not read session contents or modify application data.

## Configuration/environment changes:

- Node 24.21.0 baseline, exact dependency lock, `.env.example`, configuration schemas and an HTTPS-only application origin.
- One-command Compose startup: Caddy on `https://localhost:8443`, private Nuxt/API, PostgreSQL 18, Redis 8 and a gating migration job. Images and CI actions are pinned.
- Generated `.local/compose.env` uses random credentials. The generated-artifact directory is private on POSIX and restricted to the current Windows user, SYSTEM and administrators on Windows. The existing overly broad inherited Windows access was removed from this directory and verified on the secrets file.
- The API healthcheck now uses its natural loopback Host, no Origin or authentication, a three-second client timeout and an explicit successful health result. The endpoint has a two-second dependency deadline.
- Following the approved reboot/recovery, Docker is operational. The earlier HCS startup failure is no longer blocking this stack.
- Docker Desktop was cleanly reinstalled from the signature-verified Docker Inc. installer: **4.90.0.238679**, CLI **29.7.2**. WSL was updated to **2.7.13**.
- Original Docker data is preserved in ignored `.local/docker-backup`: the verified 26,226,982,912-byte data VHDX, 100,663,296-byte system VHDX, settings and data checksum. The unrelated `salad-enterprise-linux` distribution was left intact. This task did not restore or delete the backup.

## Security controls/tests:

- Server-issued opaque sessions with token digests in PostgreSQL and `__Host-` Secure HttpOnly SameSite cookies; absolute/idle expiry, rotation and revocation primitives. No public login or session-issuance route.
- Session-bound CSRF, exact Host/Origin checks, cross-site Fetch Metadata rejection, strict request/output schemas, sanitized errors, request IDs and credential-redacted logs.
- Deny-by-default permission policies resolve current server-owned resource relationships. Tests alter IDs, scopes, owner/role claims, membership, versions, payload sizes and credentials.
- WebSocket upgrade authentication, per-command reauthentication/authorization/CSRF, idle-session revalidation, connection/queue/frame limits and message rate limits.
- Parameterized SQL, separate database privileges, Redis atomic rate hooks with fail-closed behavior, bounded operations and Redis command deadlines.
- IndexedDB preferences use registered schemas, version handling and credential-field rejection. No authentication/session/refresh token is stored in browser-readable storage. Browser tests verify HttpOnly cookie behavior and empty localStorage/sessionStorage/IndexedDB for the skeleton.
- Regressions cover rotation/revocation races, preserved logical session IDs, migration ordering, redaction, unavailable Redis, stalled operations and hidden server imports.
- The exact GET readiness route accepts the configured public Host, or an Origin-less loopback authority from an actual loopback socket peer. Forwarding headers cannot grant the exception. Supplied invalid Origins and cross-site Fetch Metadata are rejected; other routes and methods receive no exemption.
- Readiness accepts no body/query fields, accesses no session and consumes no application rate counters. It returns only `{"status":"ok"}` (200) or `{"status":"unavailable"}` (503). Dependency rejection, exceptions or deadlines return the same nonsensitive failure result.
- Concurrent probes share pending work, including a timed-out check that ignores cancellation. Redis PING observes the abort signal. Tests prove natural-Host loopback requests, unchanged ordinary-route security, no session/state changes, bounded failures, recovery and actual Docker health.

## Tests executed:

The clean dependency installation and complete validation command were run with the checksum-verified Node **24.21.0** runtime and npm **11.19.0**. Incremental checks also ran on the workstation's Node 26.8.2. The final complete output is in ignored `.local/validation/readiness-phase00.log`.

| Check                                                       | Result                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `npm ci --ignore-scripts`                                   | PASS; 818 packages audited, zero reported vulnerabilities             |
| Formatting, ESLint and architecture enforcement             | PASS                                                                  |
| Strict package/API and Nuxt type checking                   | PASS                                                                  |
| Unit, HTTP, WebSocket, authorization and architecture tests | **86 PASS**, 12 files, on Node 24                                     |
| Generated OpenAPI/JSON Schema drift                         | PASS                                                                  |
| Source security scan and Gitleaks                           | PASS; no leaks found                                                  |
| `npm audit --audit-level=high`                              | PASS; zero reported vulnerabilities                                   |
| API and Nuxt production builds                              | PASS                                                                  |
| HTTPS Chromium tests                                        | **2 PASS**; cookie visibility, CSP, CSRF and rendering                |
| Actual Docker healthcheck regression                        | **1 PASS**; healthy API and configured originless probe replay        |
| Compose configuration validation                            | PASS                                                                  |
| `npm run dev` / actual Docker topology                      | **PASS**; images rebuilt, migration job succeeded, API became healthy |
| Real PostgreSQL/Redis suite                                 | **6 PASS**, none skipped                                              |
| `npm run validate:phase00`                                  | **PASS — 95 tests total**, exit code 0                                |
| Hosted GitHub Actions / CodeQL                              | NOT RUN; no remote configured                                         |

The original six-test readiness regression run failed against the old code as expected, reproducing the real 403 and policy gaps. After the fix, all readiness, application-security, real-service, browser and Docker checks pass. Previously blocked PostgreSQL/Redis tests now execute against real services.

## Known limitations:

- **The local Docker blocker is resolved.** The approved reboot/recovery restored the engine; the readiness correction allows the rebuilt API to become healthy.
- Hosted CI remains unverified: the repository has no remote or commit. Startup passed on this development stack and PostgreSQL migrations ran from zero in the isolated test database; the remote fresh-clone workflow remains the final reproducibility check.
- Local certificate trust is a documented user setup step. Production TLS, secrets distribution, infrastructure isolation, backups, monitoring exporters and alerting require deployment review.
- Events and connection counts are process-local; jobs are bounded lifecycle tasks. No durable event broker/outbox, distributed socket subscriptions or runtime plugin sandbox exists. Cancellation is cooperative.
- No account lifecycle or session cleanup/rotation schedule is implemented. Session subject UUIDs must be reconciled with the identity phase. Future resource mutations require authorization and transactional race review.
- Nuxt's upstream build emits esbuild/oxc-option and Vue export deprecation warnings; installation emits an upstream `glob` deprecation warning. Builds and audit pass. No forced transitive override was introduced to hide these warnings.
- The API container currently includes the shared dependency installation, including development tooling. Production image minimization and deployment scanning remain a deployment review item.

## Deferred intentionally to later phases:

- OAuth/login UX, accounts and device/session-management UI.
- Room creation/joining and canonical room/home/workspace product UI.
- Friends, presence, chat, tasks, Pomodoro, backgrounds and media providers.
- Camera, microphone, screen sharing, SFU/LiveKit, OBS and games.
- Browser extension and true native applications. Electron was not introduced.
- Domain-specific data retention, durable messaging, native credential exchange, media ownership and server-push subscription policies.

## Ready for next phase:

**NO — hosted CI/fresh-clone verification is still outstanding.** The readiness defect is fixed, Docker startup succeeds and the complete local Phase 00 validation suite passes.

| Phase 00 acceptance criterion                   | Evidence / remaining task                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Fresh clone starts from documented instructions | Documented startup passes on this stack; verify the remote fresh-clone workflow |
| Web/API compile and type-check                  | Passed                                                                          |
| PostgreSQL migrations run from zero             | Passed on the isolated test database                                            |
| Redis abstraction works locally                 | Passed against real Redis                                                       |
| Register a module without editing core          | Passed through synthetic composition tests                                      |
| Dummy route/event registration                  | Passed through HTTP, WebSocket and event tests                                  |
| Unauthenticated access denied                   | Passed for missing, forged, expired and revoked sessions                        |
| CSRF integration tests                          | Passed in HTTP, WebSocket and Chromium                                          |
| Forbidden architecture imports fail             | Passed, including transitive and extensionless exports                          |
| No browser-stored authentication token          | Passed source, adapter and browser checks                                       |
| CI passes                                       | Configure the intended remote and observe both CI jobs                          |
| No Phase 1+ substantially implemented           | Scope review passed                                                             |

Before any next-phase work, obtain a passing hosted workflow. Review the phase specification, identity/session policy and authorization/data-ownership contracts. Do not start Phase 01 without its explicitly provided specification.
