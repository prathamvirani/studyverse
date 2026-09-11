# Phase 01 implementation decisions

Scope: `docs/phases/PHASE_01_IDENTITY_SESSIONS_HOME_AND_ROOMS.md`, under the unchanged umbrella contract. Phase 00 is accepted. The implementation plan was presented before code changes; this records the resulting decisions.

## Ownership and dependency direction

- `packages/features/identity`: users/profiles, provider identity ownership, OAuth flow persistence, explicit linking and account/session operations. Consumes the SDK database, provider and session-directory ports.
- `packages/features/rooms`: rooms, memberships, invite secrets/digests, privacy and owner permissions. Receives an account-existence service at composition time; imports no identity internals.
- `packages/adapters/oauth`: fixed-endpoint Google/Microsoft/Discord adapters, signed OIDC validation and bounded provider HTTP access.
- `packages/adapters/postgres`: session-directory implementation; existing core session store continues to own session credentials.
- `packages/contracts`: additive v1 account/room/OAuth/session schemas. Generated OpenAPI describes real registered operations, input schemas and required security headers.
- `apps/api/src/identity.ts`: concrete module/provider composition. Core never imports feature implementations.
- `apps/web`: routed Home, Discover, My Rooms, account/devices, room-management and callback views. Navigation contributions arrive through the UI registry; no room workspace/tile implementation is added.

## Identity and authentication

Users have a server-issued UUID, display name and creation timestamp. Provider identities have a unique `(provider, issuer, subject)` and reference a user. One identity per provider may be linked to an account. Email is neither collected nor used to merge accounts.

All providers use authorization codes, state, exact configured redirect URIs, confidential client authentication and S256 PKCE parameters. Google and Microsoft additionally require a signed OIDC ID token, issuer/audience/authorized-party/expiry/issued-at validation and matching nonce. Microsoft tenant-specific issuers are checked against the signed tenant claim and optional configured tenant. Discord identity comes only from its authenticated `users/@me` response. Provider tokens are discarded after identity verification and never serialized to the client.

The callback URL serves a read-only Nuxt page. On mount it removes code/state from the address bar and issues a same-origin POST. No GET endpoint exchanges codes, creates a session, joins a room or updates activity.

The existing SDK gains an explicit `authentication` operation kind. It remains in the typed operation and HTTP registries, requires POST/body binding, and cannot be registered over realtime. Its server-only browser capability delivers Secure HttpOnly cookies without including credentials in JSON. Pre-session POSTs require exact Host/Origin, JSON, a custom header and ingress/operation limits; existing sessions additionally require the original session CSRF token. Ordinary `command` registration remains protected without exception.

OAuth state is single-use and expires after ten minutes. State and browser-binding tokens are hashed in storage; PKCE verifier and nonce remain server-side. The browser-binding cookie is Secure, HttpOnly, host-only and SameSite=Lax. Consuming a flow is atomic. Linking is explicit, bound to the initiating account and logical session, requires recent provider proof, and never moves an identity already owned by another account. The target session is locked/revalidated when committing links.

## Sessions and future step-up

The accepted 30-day absolute and seven-day idle lifetimes remain. Active clients renew through a protected POST on mount and every fifteen minutes while visible; credentials rotate after an hour, preserving logical device/session identity. Browser locks serialize renewal across tabs where available. Old credentials become invalid, including on existing WebSockets. GET authentication remains read-only.

Device labels are bounded, escaped, untrusted user-agent descriptions. Last activity reflects explicit renewal. Listing is scoped to the current subject, current device first, up to 100 active sessions. Single-device, other-device, current-device and all-device revocation use server-owned subject relationships. Session-directory locks prevent revocation from being overwritten by account operations.

`requireRecent` / `markRecent` are future step-up integration points. Phase 01 proves recent control of an existing provider identity; it does not claim password re-entry, MFA, WebAuthn or a particular assurance level. Sensitive future operations must define their required assurance before using these hooks.

## Room and invite semantics

| Privacy  | Discover | Authenticated direct access/join                    |
| -------- | -------- | --------------------------------------------------- |
| Public   | Listed   | Allowed                                             |
| Unlisted | Omitted  | Allowed with room ID/link                           |
| Private  | Omitted  | Owner/member only; nonmembers must redeem an invite |

Missing and inaccessible rooms receive the same error code. Discover queries filter privacy in SQL before pagination/search. My Rooms contains persisted memberships, including owned rooms. Counts represent memberships, not live participation. No owner-presence dependency exists.

Creation atomically creates the room and owner membership. Ownership comes only from the current session. Owner-only capabilities govern permanent settings and invites. Updates use a version precondition and room lock; forged user/owner/role fields fail strict schemas. Moderator is a reserved membership role with no owner powers. No assignment, transfer, deletion, ban or later room feature is implemented.

Invites are random 256-bit bearer grants. Only digests are persisted; the raw token is shown once. Links use a fragment to avoid request/referrer logs. Invites expire within seven days, admit at most 100 new members, and can be revoked. Redemption locks the room and invite, rechecks validity and atomically records membership/use count. Re-entering an existing room does not duplicate membership or emit a false membership-created event. Changing privacy revokes existing links while preserving existing memberships. Logged-out invite recipients sign in then reopen the link.

The room owner and membership user columns reference identity user IDs for referential integrity. Runtime cross-module reads use the injected account service; rooms never write identity tables. Migration ordering explicitly declares the identity dependency. Core session subjects remain a generic identity contract; Phase 01 permissions require real account records.

## Validation and acceptance mapping

- Provider sign-in: signed adapter tests, callback HTTP tests for all three adapters, browser flow tests, then live configured-provider smoke before acceptance.
- Persistent sessions: restart-context cookie test, rotation/revocation/concurrency tests, WebSocket revocation, no browser storage.
- Room creation/re-entry: real PostgreSQL HTTP tests and real browser management flow.
- Privacy and authorization: cross-user/cross-room IDs, forged ownership/roles, private enumeration, invite administration/redemption/expiry/races.
- Data integrity: clean migrations, idempotency, drift/missing-history rejection, grants, parameterized hostile strings and transaction tests.
- Modular/security regression: unchanged boundary enforcement, registered events/permissions/flags, all Phase 00 tests, lint/types, generated-contract drift, source/secret/dependency scans and Docker readiness.

No Phase 02 room shell, presence/friends, productivity, RTC, backgrounds, media, games, OBS, browser extension or native client work is included.
