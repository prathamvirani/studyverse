# Study platform — Phase 00 foundations

This repository implements the foundations defined by [Phase 00](docs/phases/PHASE_00_FOUNDATIONS.md). [UMBRELLA_SPEC.md](docs/UMBRELLA_SPEC.md) is the authoritative product and architecture contract. The original `studyverse_umbrella_product_spec.md` is retained unchanged; both files are byte-identical.

There is a Nuxt placeholder page, a backend, reusable extension contracts and security infrastructure. Login, rooms, chat, tasks, presence, media, extensions and native applications are intentionally absent. There is no public endpoint for creating a session.

See the [architecture plan](docs/architecture/PHASE_00_PLAN.md), [security and extension contracts](docs/architecture/FOUNDATION_CONTRACTS.md), and [Phase 00 report](docs/PHASE_00_REPORT.md) for decisions, evidence and outstanding acceptance checks.

## Start locally

Prerequisites:

- Node **24.21.0** (`.nvmrc`) and npm 11; dependencies are fixed by `package-lock.json`.
- A working Docker engine with Linux containers and Docker Compose v2. Windows requires a working Docker Desktop virtualization backend.
- Git. Browser tests also need OpenSSL (Git for Windows provides it at the standard installation path).

From the repository root:

```sh
npm run dev
```

This command creates random development passwords in ignored `.local/compose.env`, builds both applications, starts PostgreSQL and Redis, runs migrations, and waits for application health checks. Generated `.local` artifacts are restricted to the current user (plus SYSTEM and administrators on Windows); setup fails if that protection cannot be applied. Installation of dependencies occurs in the Docker builder. Open **https://localhost:8443** after trusting the local CA below. The stack uses built applications; rerun `npm run dev` after source changes to rebuild.

| Service       | Address / responsibility                                                              |
| ------------- | ------------------------------------------------------------------------------------- |
| Caddy         | HTTPS on loopback port 8443; routes `/api/*` to the API and everything else to Nuxt   |
| Nuxt          | Private container port 3000; placeholder page with nonce-based CSP                    |
| API           | Private container port 3001; registered HTTP and WebSocket handlers                   |
| PostgreSQL 18 | Loopback port 5433 for development tools; `study` and isolated `study_test` databases |
| Redis 8       | Loopback port 6380; password protected, ephemeral, persistence disabled               |
| Migration job | Separate database owner credentials; completes before API startup                     |

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
  web/                  Nuxt skeleton and browser API client
packages/
  contracts/            Versioned transport schemas and generated OpenAPI/JSON Schema
  feature-sdk/          Framework-independent module and infrastructure interfaces
  core/                 Registries, permissions, operations, events, sessions, flags, tiles
    migrations/         Core-owned session DDL
  adapters/             Separate PostgreSQL, Redis and IndexedDB public exports
  ui/                   Generic Vue extension/tile renderers
  features/             Reserved for later phases; no production feature implementation
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

The bootstrap superuser creates a `study_migrator` owner and a restricted `study_runtime` login. Runtime credentials receive explicit DML rights on session data, no schema creation or migration-ledger access. The migration runner takes an advisory lock, checks immutable owner/ID/checksums, and commits each migration and ledger entry atomically. `core/0001_sessions` creates only session infrastructure; it deliberately has no account table or account foreign key yet.

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
npm run validate:phase00
```

Linux CI uses `npx playwright install --with-deps chromium`. `validate:phase00` runs formatting, linting/boundaries, strict type checks, unit/HTTP/WebSocket tests, contract drift, source security checks, Gitleaks, dependency audit, both production builds, real service tests, HTTPS browser tests and the actual Docker healthcheck regression. Start the full stack with `npm run dev` first. Gitleaks is downloaded from its official release with a pinned archive checksum into ignored `.local/tools`. It can fail if the download is unavailable. Dependency auditing requires registry access.

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

Real service tests use `.local/compose.env` and `study_test`, or explicit `TEST_MIGRATION_DATABASE_URL`, `TEST_DATABASE_URL`, and `TEST_REDIS_URL`. They **drop the core and foundation schemas in the test database** and require database names ending in `_test`. Use an isolated test database and Redis instance. An unavailable service fails the suite; it is never counted as a passing mock test.

Browser tests use ports 3008, 3009 and 8449 and a loopback-only synthetic session endpoint in the test harness. TLS verification is relaxed only for the isolated test certificate. This endpoint and the memory session store are not imported by production. Windows browser tests expect Git's OpenSSL at `C:/Program Files/Git/usr/bin/openssl.exe`.

CI runs these checks on Linux/Node 24, adds a full Docker topology smoke test and a separate CodeQL job. Actions and tool versions are pinned. No hosted CI result exists until this repository is attached to a remote and the workflow runs.

## Observability and operational boundaries

The `Observer` interface provides structured event and metric hooks. API logs use generated request IDs, stable route labels and sanitized error codes. Session lifecycle, module/subscriber failure, transport rejection and dependency failure events omit private payloads and credentials. Pino redacts cookie/authentication/CSRF headers and known secret fields. Avoid logging raw request objects or arbitrary domain data. A metrics collector, tracing exporter and alerting backend are deliberately not deployed in Phase 00.

The local proxy uses its own CA and is development infrastructure. A production deployment needs managed TLS, secret distribution, isolated infrastructure, backups and a reviewed proxy boundary. The API currently ignores forwarded IP claims, so proxy traffic shares the proxy's ingress bucket; authenticated operation limits still use the server-derived subject. Multi-instance event delivery, durable jobs and transport/session protocols for native clients require later specifications. No native or Electron application is introduced here.
