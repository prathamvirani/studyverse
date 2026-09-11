# Phase 01 report

2026-09-11. Scope: identity, sessions, Home and persistent room management only. Phase 00 is accepted; the umbrella specification is unchanged.

## Implemented:

- Google and Microsoft OIDC authorization-code adapters, and Discord OAuth authorization-code adapter, with server-side exchanges and S256 PKCE parameters.
- Real user/profile records, multiple explicitly linked provider identities, single-use browser-bound OAuth flows, provider selection and callback handling.
- Persistent Secure HttpOnly sessions, transparent POST renewal/rotation, profile/device views, logout, individual revocation, other-device revocation and all-device revocation.
- Home, My Rooms, searchable/paginated Discover, room creation/editing/joining and a deliberately minimal entry page, all using real API data.
- Persistent owner/member records; public/private/unlisted semantics; reserved moderator role; expiring, usage-limited, revocable invite links.
- No Phase 02 or later product feature was implemented.

## Architecture/modules added or changed:

- `@study/identity` owns users, provider identities and OAuth flow storage. `@study/rooms` owns rooms, memberships and invites. Both use SDK contracts and existing operation, permission, event and HTTP registries.
- Concrete composition lives in `apps/api/src/phase01.ts`. Room code receives an identity existence service instead of reading another module's tables. Core imports no concrete features.
- Added SDK provider/session-directory ports and a POST-only `authentication` operation kind. Its private browser capability delivers cookies without exposing session credentials in JSON. It cannot bind to GET/HEAD or WebSocket. Ordinary commands still require the established authorization and CSRF pipeline.
- Added OAuth adapter and PostgreSQL session-directory adapter. Added `homeNavigation` to the UI extension registry and registered identity/room navigation contributions.
- Additive versioned account, session, OAuth, room and invite contracts; OpenAPI now documents all registered v1 routes, request schemas and security headers.
- The architecture decisions and implementation/acceptance mapping are in [PHASE_01_PLAN.md](../architecture/PHASE_01_PLAN.md).

## Database migrations:

| Migration                   | Ownership and effect                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `core/0002_session_devices` | Adds bounded device label, last-active and recent-provider-proof timestamps to existing sessions.                        |
| `identity/0001_identity`    | Creates users, provider identities and expiring OAuth flows; identity uniqueness, indexes and restricted runtime grants. |
| `rooms/0001_rooms`          | Creates rooms, memberships and invites; privacy/role/use-limit constraints, user references, indexes and runtime grants. |

`core/0001_sessions` is unchanged. Migration manifests include all four migrations in dependency order, independently of runtime flags. Both clean test-database migration and upgrade of the development stack passed. No production data was reset; destructive test setup is restricted to an explicitly named `*_test` database. Room/membership creation and invite consumption are transactional. Invite tokens and OAuth state/browser bindings are stored as hashes; provider tokens are not persisted.

## Configuration/environment changes:

- `PHASE01_ENABLED` defaults to `true`; module operations use the existing feature-flag registry.
- Optional `OAUTH_GOOGLE_CLIENT_ID` / `OAUTH_GOOGLE_CLIENT_SECRET`, equivalent Microsoft and Discord pairs, and `OAUTH_MICROSOFT_TENANT` (`common` or a tenant UUID). Incomplete credential pairs fail startup; unconfigured providers are omitted from sign-in options.
- Local development remains `https://localhost:8443`, the existing Compose project/volumes, PostgreSQL and Redis. The Docker image now includes module migrations. Readiness checks the installed identity/room tables as well as sessions and Redis.
- See [OAUTH_SETUP.md](../OAUTH_SETUP.md) for exact callback URIs, registration steps, scopes and live checks. No real OAuth credentials were present in `.local/compose.env` during validation.
- Added `npm run validate:phase01`, which includes the complete `validate:phase00` regression pipeline. Service test files run sequentially because they share the isolated test database. The existing CI workflow invokes the current combined suite.

## Security controls/tests:

- OAuth state consumption is atomic, expires after ten minutes and requires its Secure HttpOnly browser-binding cookie. OIDC signatures, issuer, audience, authorized party, timestamps and nonce are verified. Microsoft tenant mismatch is rejected. Provider HTTP responses and timeouts are bounded; redirects are rejected.
- Safe linking requires an existing authenticated session and recent proof of an existing provider identity. Flows are bound to the initiating account and logical session; a revoked/swapped session cannot complete a link. Identities are never merged by email or moved from another account.
- Protected operations derive identity from server sessions, reject forged owner/user/role fields and recheck object relationships. Permanent room edits and invite administration are owner-only. Stored moderators do not acquire owner powers.
- Discover filters private/unlisted rooms before pagination. Missing and inaccessible rooms return the same error class. Private rooms cannot be joined by guessing an ID. Unlisted rooms intentionally allow authenticated direct-link access.
- Invites use random 256-bit secrets, hashed storage, fragment links, expiration, revocation and transactional usage limits. Cross-room invite revocation and concurrent over-redemption fail. Privacy changes revoke existing invite links while preserving memberships.
- GET/HEAD remain read-only. Session renewal, OAuth completion, room entry and invite redemption use POST. Ordinary Origin/Host, CSRF, validation, parameterized SQL, rate limiting and WebSocket controls remain in force. The narrow Phase 00 readiness policy remains intact.
- Authentication/session/refresh tokens are absent from localStorage, sessionStorage and IndexedDB. Browser checks verify HttpOnly cookies, restart persistence, safe rendering of an HTML/script payload and a usable mobile layout.
- Security events record login, linking, reauthentication and session revocation without provider credentials or private request payloads. Added credential redaction fields. Typed room membership events are emitted only when membership is actually created.

## Tests executed:

Final validation used Node **24.21.0**. Incremental checks also ran on the workstation's Node 26 installation.

| Check                                                                | Result                                                                                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline before Phase 01                                             | 86 existing tests and architecture/lint passed.                                                                                                           |
| Unit, HTTP, WebSocket and architecture suite                         | **101 passed**, 14 files.                                                                                                                                 |
| Real PostgreSQL/Redis and Phase 01 HTTP suite                        | **23 passed**, 2 files, no skips.                                                                                                                         |
| HTTPS Chromium                                                       | **6 passed**: foundation security, account/room/invite workflow, restart-context cookies, callback errors/mobile view, all three isolated provider flows. |
| Actual Docker healthcheck regression                                 | **1 passed**; API healthy and configured originless probe succeeds.                                                                                       |
| `npm run dev`                                                        | **Passed**, migrations applied and complete stack started successfully.                                                                                   |
| `npm run validate:phase01`                                           | **Passed, exit 0 — 131 tests total**, includes `validate:phase00`.                                                                                        |
| Formatting, ESLint, architecture enforcement, package/API/Nuxt types | Passed.                                                                                                                                                   |
| Generated OpenAPI/JSON Schema drift                                  | Passed.                                                                                                                                                   |
| Source security scan and Gitleaks                                    | Passed.                                                                                                                                                   |
| Dependency audit                                                     | Passed; zero reported vulnerabilities.                                                                                                                    |
| API and Nuxt production builds                                       | Passed.                                                                                                                                                   |
| Hosted CI for these changes                                          | Not run; changes remain local.                                                                                                                            |
| Live Google/Microsoft/Discord login                                  | Not run; provider applications/credentials are not configured here.                                                                                       |

Evidence: ignored `.local/validation/phase01-dev.log`, `.local/validation/phase01-complete.log`, `phase01-my-rooms.png` and `phase01-mobile.png`. Screenshots were inspected. Early failures were corrected immediately: lint sanitization, exact optional input typing, a revoked-session test header, and migration-test assumptions about the former single migration. Stopped service containers were restarted before service tests; prerequisite failures were not treated as passing/skipped coverage.

## Known limitations:

- **Live provider acceptance is outstanding.** Automated signed JWT/provider fixtures prove application behavior, but cannot verify console registrations, consent policies or real provider interoperability. Configure and smoke-test all intended providers before acceptance.
- Discord's general OAuth documentation does not guarantee PKCE enforcement for every app configuration. The adapter supplies S256 parameters and uses confidential client authentication; verify the configured provider behavior. It is not an OIDC provider and has no ID-token nonce path.
- Reauthentication hooks prove recent control of an existing provider identity; they do not promise MFA, password re-entry or a particular assurance level. Future sensitive operations must define stronger step-up requirements explicitly.
- One linked identity per provider per account. No identity unlinking, account deletion or ownership transfer UI is included. Display names are the only editable profile field.
- Device listing returns the current device plus the most recent active sessions, up to 100; all-device/other-device revocation covers all matching sessions. Activity means explicit renewal, not presence. Accepted absolute/idle expiry limits remain in force.
- Logged-out invite recipients sign in and reopen their original link. Invite tokens are deliberately not retained in browser storage during login. Room cards show membership counts, with no invented online counts or active-room ranking.
- OAuth flow expiry is enforced during consumption; expired rows are cleaned on subsequent flow starts. Events remain process-local and cancellation remains cooperative, as in Phase 00.
- Hosted CI for these local changes has not been observed. Production TLS, secrets, proxy/IP policy, deployment scanning and operational controls still require deployment review. Upstream Nuxt/Zod build warnings remain nonblocking; builds and audits pass.
- The supplied working tree has an absent `docs/phases/PHASE_00_FOUNDATIONS.md`; this task did not delete or restore that specification. The accepted Phase 00 implementation and historical report remain.

## Deferred intentionally to later phases:

- Canonical immersive room shell and workspace layout.
- Friends/presence, chat/tasks/Pomodoro and realtime productivity.
- RTC, backgrounds, media providers, mini-games and OBS.
- Browser extension and true native applications; no Electron.
- Advanced step-up assurance, identity unlinking, account lifecycle and broader moderation/ownership-management policy need explicit specifications.

## Ready for next phase:

**NO — Phase 01 is implemented and the complete local suite passes, but real configured-provider sign-in must be verified before acceptance.**

Room creation/re-entry, owner access, private-room isolation, visibility semantics, revocation, backend-driven Home/My Rooms and hostile-client tests are locally verified. Complete the live OAuth setup/checks and review this report. No Phase 02 work has begun; its specification and explicit authorization are required before starting it.
