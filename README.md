# Study platform

A background-first social study room with OAuth identity, persistent sessions and rooms, privacy-aware friends/presence/invitations, Personal/Shared Pomodoro and tasks, room chat, curated and device-local backgrounds, and basic LiveKit-backed microphone/camera/screen sharing. Google and Discord are enabled when configured; Microsoft and email/phone remain deferred.

**Phase 06 is accepted and remains the latest implementation baseline. Phase 07 is not authorized.** See [coordination](docs/ACTIVE_PHASE.md), [acceptance history](docs/PHASE_HISTORY.md), [cleanup review](docs/reports/CODEBASE_CLEANUP_REVIEW.md) and the [future roadmap](docs/phases/README_PHASES.md). Only explicit owner instructions authorize a new phase.

[UMBRELLA_SPEC.md](docs/UMBRELLA_SPEC.md) is the authoritative product/architecture contract. The separately labeled original specification is a historical archive; it is not byte-identical to the amended current specification. [Current architecture](docs/architecture/CODEBASE.md) explains ownership and boundaries; [OAuth setup](docs/OAUTH_SETUP.md) explains provider configuration. `npm run validate:phase06` runs the full accepted regression chain.

## Start locally

Prerequisites:

- Node **24.21.0** (`.nvmrc`) and npm 11; dependencies are fixed by `package-lock.json`.
- A working Docker engine with Linux containers and Docker Compose v2. Windows requires a working Docker Desktop virtualization backend.
- Git. Browser tests also need OpenSSL (Git for Windows provides it at the standard installation path).

From the repository root:

```sh
npm run dev
```

This command creates random development passwords in ignored `.local/compose.env`, builds both applications, starts PostgreSQL, Redis and LiveKit, runs migrations, and waits for application health checks. Generated `.local` artifacts are restricted to the current user (plus SYSTEM and administrators on Windows); setup fails if that protection cannot be applied. Installation of dependencies occurs in the Docker builder. Open **https://localhost:8443** after trusting the local CA below. The stack uses built applications; rerun `npm run dev` after source changes to rebuild.

| Service       | Address / responsibility                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Caddy         | HTTPS on loopback port 8443; routes `/api/*` to the API, `/rtc` signaling to LiveKit, and other paths to Nuxt |
| Nuxt          | Private container port 3000; Home/account/room views with nonce-based CSP                                     |
| API           | Private container port 3001; registered HTTP and WebSocket handlers                                           |
| PostgreSQL 18 | Loopback port 5433 for development tools; `study` and isolated `study_test` databases                         |
| Redis 8       | Loopback port 6380; password protected, ephemeral, persistence disabled                                       |
| Migration job | Separate database owner credentials; completes before API startup                                             |

Container images are pinned by digest. PostgreSQL and the local CA have named volumes belonging to the `study-phase00` Compose project. Redis is disposable. The API and Nuxt are not published directly to host ports.

### Local HTTPS certificate

After the first successful start, copy the public CA certificate:

```sh
docker compose --env-file .local/compose.env cp proxy:/data/caddy/pki/authorities/local/root.crt .local/study-local-ca.crt
```

Trust this certificate for your development account using your operating system's certificate manager. On Windows, this command explicitly adds it to the current user's trusted root store:

```powershell
Import-Certificate -FilePath .local/study-local-ca.crt -CertStoreLocation Cert:\CurrentUser\Root
```

Restart the browser if necessary. On Linux/macOS, import the certificate into the OS/browser trust store used by your browser. Only the public `root.crt` is exported; keep the CA private key inside its local volume. Remove this local CA's trust entry when retiring the environment. Resetting volumes creates a new CA that must be trusted again. Secure cookies stay enabled in every environment.

### Commands

```sh
npm run dev:logs          # Follow project logs
npm run dev:down          # Stop the project; preserve durable data
npm run dev:reset         # DELETE this project's database and CA volumes
node scripts/dev.mjs config    # Validate Compose configuration without starting containers
node scripts/dev.mjs services  # Start PostgreSQL and Redis only
```

The reset command deletes **all local Study database contents and the development CA**. It does not remove unrelated Docker projects or `.local/docker-backup`. If local passwords must change, reset the project volumes and then regenerate `.local/compose.env`; changing passwords in this file alone does not change existing database roles.

Docker Desktop and WSL were repaired during setup. The original Docker data backup is preserved in ignored `.local/docker-backup`; see the phase report for the current validation results.

The API's dedicated infrastructure probe is `GET /api/v1/ready`. Docker calls it over loopback without an Origin or custom Host header. Only that exact GET route permits a loopback authority from a loopback peer; forwarded headers cannot grant the exception. Supplied Origins are still checked, and ordinary endpoints retain their existing Host/Origin, session, CSRF and permission requirements. Readiness creates no session or application rate counters, accepts no body/query fields, and returns only `{"status":"ok"}` (200) or `{"status":"unavailable"}` (503), with a two-second dependency deadline. Concurrent checks share the same pending probe.

## Repository and dependencies

```text
apps/
  api/                  Fastify composition, configuration, transport security, logs
  web/                  Nuxt room experience, feature composition and browser clients
packages/
  contracts/            Versioned transport schemas and generated OpenAPI/JSON Schema
  feature-sdk/          Framework-independent module and infrastructure interfaces
  core/                 Registries, permissions, operations, events, sessions, flags, tiles
    migrations/         Core-owned session DDL
  adapters/             PostgreSQL, Redis, IndexedDB, OAuth and LiveKit public adapters
  ui/                   Generic Vue extension/tile renderers
  features/             Identity, rooms, friends, presence, pomodoro, tasks, chat, backgrounds, rtc
infra/docker/           Images, TLS proxy and least-privilege database bootstrap
scripts/                Development, migrations, contract generation, architecture/security checks
tests/
  unit/                 Core logic, preferences, UI and security regressions
  integration/          HTTP injection and real WebSocket hostile clients
  docker/               Actual API container health status and configured probe
  architecture/         Positive and deliberately forbidden import cases
  services/             Real PostgreSQL/Redis integration; dedicated test database
  browser/              Built Nuxt plus isolated HTTPS test harness
  fixtures/             Synthetic modules and stores; excluded from production
docs/                   Specifications, architecture and phase report
.github/                CI and dependency update configuration
```

Dependencies point toward stable contracts: `apps → adapters/core/UI → feature-sdk → contracts`. Core never imports concrete features or adapters. Features depend on public SDK/contracts and their own code. Cross-package relative imports and cross-feature private imports are forbidden. Browser imports use `@study/core/browser` and `@study/adapters/indexeddb`; PostgreSQL, Redis and session cryptography remain in server entry points. Architecture checks follow transitive exports as well as direct imports.

## Configuration and migrations

`.env.example` documents server variables; it is a reference, not a file containing usable credentials. Compose injects its generated credentials automatically. For processes run outside Docker, provide variables explicitly through the environment or an ignored environment file. Never commit `.local`, database URLs, cookies or private keys.

| Variable                                                                        | Purpose / default                                                                  |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `APP_ORIGIN`                                                                    | Required exact HTTPS origin, e.g. `https://localhost:8443`; no path/trailing slash |
| `DATABASE_URL`                                                                  | Required restricted runtime PostgreSQL credentials                                 |
| `MIGRATION_DATABASE_URL`                                                        | Required only by the migration job; separate owner credentials                     |
| `REDIS_URL`                                                                     | Required authenticated Redis URL; supports `redis:` / `rediss:`                    |
| `NODE_ENV`                                                                      | `development`, `test`, or `production`                                             |
| `API_HOST`, `API_PORT`                                                          | `127.0.0.1`, `3001`; Compose uses a private `0.0.0.0` listener                     |
| `LOG_LEVEL`                                                                     | `info`; use `debug` to see baseline metric records                                 |
| `WS_REVALIDATE_MS`                                                              | `5000`; periodic revalidation of idle socket sessions                              |
| `INGRESS_LIMIT`                                                                 | `300` requests per minute per observed peer IP                                     |
| `POSTGRES_PASSWORD`, `MIGRATION_PASSWORD`, `RUNTIME_PASSWORD`, `REDIS_PASSWORD` | Generated Compose-only secrets                                                     |

Feature switches use strict `true`/`false` values. `IDENTITY_ROOMS_ENABLED` and `SOCIAL_ENABLED` default to true; their legacy deployment keys `PHASE01_ENABLED` and `PHASE03_ENABLED` remain supported. Either key set to false disables the corresponding feature, and malformed values fail startup. Existing deployment files need no edits. `POMODORO_ENABLED`, `TASKS_ENABLED`, `CHAT_ENABLED` and `BACKGROUNDS_ENABLED` remain independent; standalone RTC defaults off, while local Compose explicitly enables it.

The bootstrap superuser creates a `study_migrator` owner and a restricted `study_runtime` login. Runtime credentials receive explicit DML rights on session data, no schema creation or migration-ledger access. The migration runner takes an advisory lock, checks immutable owner/ID/checksums, and commits each migration and ledger entry atomically. `core/0001_sessions` creates only session infrastructure; its generic subject contract stays independent of concrete features. The application manifest adds session-device metadata and feature-owned identity, rooms, friends, Pomodoro, tasks, chat and background migrations in dependency order. RTC and presence own ephemeral state. See the accepted reports for each immutable migration.

For an existing configured environment:

```sh
npm ci --ignore-scripts
npm run migrate
```

The second command requires `MIGRATION_DATABASE_URL`. Compose runs it automatically. Add new, monotonically numbered migration files and register them in the composition manifest. Future module migrations are collected in dependency order independently of runtime flags. Never edit an applied migration, omit its history, or automatically drop disabled modules' data. Shared queries use the SDK's parameterized `sql` tag and database interface; SQL identifiers and DDL must be trusted code.

## Validation

Install local tool dependencies and the browser runner:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run dev
npm run validate:phase06
```

Linux CI uses `npx playwright install --with-deps chromium`. `validate:phase06` chains Phase 00–06 validation and runs formatting, linting/boundaries, strict type checks, unit/HTTP/WebSocket tests, contract drift, source security checks, Gitleaks, dependency audit, both production builds, real service tests, HTTPS browser tests and the actual Docker healthcheck regression. Start the full stack with `npm run dev` first. Gitleaks is downloaded from its official release with a pinned archive checksum into ignored `.local/tools`. It can fail if the download is unavailable. Dependency auditing requires registry access.

Individual checks:

```sh
npm test
npm run test:services
npm run build
npm run test:browser
npm run test:docker
npm run typecheck
npm run lint
npm run format:check
npm run contracts:check
npm run security:source
npm run security:secrets
npm run security:dependencies
```

Real service tests use `.local/compose.env` and `study_test`, or explicit `TEST_MIGRATION_DATABASE_URL`, `TEST_DATABASE_URL`, and `TEST_REDIS_URL`. They **drop the application schemas in the test database** and require database names ending in `_test`. Use an isolated test database and Redis instance. An unavailable service fails the suite; it is never counted as a passing mock test.

Browser tests use ports 3008, 3009, 3010 (disabled RTC API) and 8449 and a loopback-only synthetic session endpoint in the test harness. TLS verification is relaxed only for the isolated test certificate. The harness uses fake OAuth providers and real PostgreSQL in the dedicated test database. Test endpoints/providers are not imported by production. Windows browser tests expect Git's OpenSSL at `C:/Program Files/Git/usr/bin/openssl.exe`.

CI runs these checks on Linux/Node 24, adds a full Docker topology smoke test and a separate CodeQL job. Actions and tool versions are pinned. No hosted CI result exists until this repository is attached to a remote and the workflow runs.

## Observability and operational boundaries

Friends and Presence own server-filtered realtime snapshots, expiring Redis connection leases, and recipient-bound invitations in the existing Rooms module. `SOCIAL_ENABLED=false` disables social actions while keeping stored block restrictions effective. Current room and Join visibility default to hidden; enable room visibility in Friends to appear in another participant's rail. See `docs/reports/PHASE_03_REPORT.md` for semantics and validation evidence. Run one API instance: the accepted transport/event registry and its active connection index are process-local.

The `Observer` interface provides structured event and metric hooks. API logs use generated request IDs, stable route labels and sanitized error codes. Session lifecycle, module/subscriber failure, transport rejection and dependency failure events omit private payloads and credentials. Pino redacts cookie/authentication/CSRF headers and known secret fields. Avoid logging raw request objects or arbitrary domain data. A metrics collector, tracing exporter and alerting backend remain deployment work.

The local proxy uses its own CA and is development infrastructure. A production deployment needs managed TLS, secret distribution, isolated infrastructure, backups and a reviewed proxy boundary. The API currently ignores forwarded IP claims, so proxy traffic shares the proxy's ingress bucket; authenticated operation limits still use the server-derived subject. Multi-instance event delivery, durable jobs and transport/session protocols for native clients require later specifications. No native or Electron application is introduced here.

Pomodoro, Tasks and Chat are independent modules. `POMODORO_ENABLED`, `TASKS_ENABLED` and `CHAT_ENABLED` default to true and independently gate server operations. Pomodoro has independent Personal and Shared modes: private account timers persist across rooms, while owners control the durable timestamp-based room timer; members create shared tasks and edit their own, with owner moderation. Personal tasks remain private account data across rooms, in a separate table and permission policy from Shared tasks. Text chat uses application WebSocket/HTTPS; the application/WebRTC transport split is recorded in `docs/architecture/TRANSPORT_PLAN.md`. Chat is escaped plain text, with bounded history pages, owner/author deletion, block filtering and Redis-backed send limits. The room continues to use registered panels in Pomodoro → Tasks → Chat order. See `docs/reports/PHASE_04_REPORT.md` for exact synchronization, ownership, recovery and retention policies.

Backgrounds owns six original curated environments (four stills and two visual loops), owner-controlled room defaults, device-local overrides/favorites, and sanitized personal PNG/JPEG/GIF imports. `BACKGROUNDS_ENABLED=false` disables its server operations. Custom images remain on the device and cannot be shared with the room. See [Background architecture](docs/architecture/PHASE_05_BACKGROUNDS.md) for ownership, resource budgets and the explicitly deferred durable-upload policy; see [Phase 05 report](docs/reports/PHASE_05_REPORT.md) for validation evidence.

RTC supplies real LiveKit-backed mic/camera/screen media behind the generic RTC provider. `npm run dev` generates protected local provider credentials, starts the pinned SFU and applies its configuration before the application starts. Open the existing `https://localhost:8443` origin and explicitly activate a media control. Mic/camera default off; entry asks for no device permissions. `RTC_ENABLED=false` in `.local/compose.env` disables admission. Active publishing identifies you to authorized people inside that room; global friends/presence privacy remains unchanged.

Development signaling uses same-origin WSS through Caddy's `/rtc` route. All exposed SFU ports bind **127.0.0.1 only**: 7880 HTTP/server SDK for host-side tests, 7881 ICE/TCP, 7882 ICE/UDP, and 3478 local embedded TURN/UDP. TURN solves Docker loopback candidate routing without browser flags; its allocations are authenticated by LiveKit. Provider admin APIs are not reverse-proxied to the web origin. Metrics on container port 6789 are internal. This is a same-machine baseline, not a public NAT/TURN deployment. Do not expose these ports publicly as a deployment recipe.

`npm run validate:phase06` includes all earlier regressions plus actual SFU browser and hostile-client tests. They use synthetic canvas/Web Audio capture but real WebRTC forwarding and separate authenticated test accounts; native screen selection and physical devices are not claimed. The isolated browser authority uses `test-study-` and hostile probes use `probe-study-`, separate from development `study-`. One API authority owns each ephemeral namespace and clears its SFU rooms on restart. See [RTC architecture](docs/architecture/PHASE_06_RTC.md) for permissions, blocks, revocation/replay bounds, caps and operational limits.
