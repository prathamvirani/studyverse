# Phase 02 report

2026-09-11. Implemented Phase 02 only, plus the explicitly authorized Phase 01 authentication cleanup. Phase 00 and Phase 01 are accepted under the user's current scope: Google and Discord live-verified; Microsoft and email/phone deferred. The older Phase 01 report is historical.

## Implemented

- Background-first fullscreen room with an original, bundled vector illustration. The supplied Studyverse reference informed spatial hierarchy; its screenshot and third-party content are not shipped as the background.
- Minimal Back/name/privacy/Invite bar; narrow vertical participant circles with status labels and keyboard/right-click controls; collapsible Pomodoro → Tasks → Chat panels; Media → Background → Microphone → Camera → Screen Share → More dock.
- Entry still uses the existing authenticated, authorized POST join operation. Back returns to existing room details. Invite opens existing owner-managed invitation controls; members receive an explanatory notice. Server authorization remains unchanged.
- Generic draggable/resizable tile host, edge snapping, bounded z-order, minimize/restore, room fullscreen with Escape and contained keyboard focus. Move/resize handles accept arrow keys; Shift increases the step. Fullscreen preserves normal geometry.
- Registry-provided generic workspace sample and isolated camera demo. Camera off shows an avatar; camera on renders in the circle; expansion restores the avatar and mounts one workspace renderer; minimizing/closing returns the renderer to the circle. Reload defaults to camera off. No device capture, RTC, real productivity or real presence was added.
- IndexedDB layout/panel/dimming preferences per room on the device, using the existing validated preference adapter and its memory fallback. No credentials or permission claims are serialized. Invalid/future records recover to defaults; unknown tile modules are ignored; stale/offscreen geometry is bounded to the available workspace.
- Accessible labels, visible focus, focus return, touch pointer capture, reduced-motion styles, and responsive layouts, including a narrow phone dock.

## Architecture/modules added or changed

- `packages/core/src/workspace.ts`: generic geometry, snapshots, recovery and workspace stacking; no feature imports.
- Existing SDK `TileDefinition`: additive layout-change lifecycle hook and persistence opt-out. Existing `TileRegistry` rejects nonfinite dimensions. No protocol/schema migration.
- Existing UI extension host: generic renderer context and optional contribution selection. Workspace renderer receives its instance and unmounts minimized content rather than merely hiding it.
- `apps/web/app/components/room/RoomShell.vue` and `WorkspaceHost.vue`: generic room/interaction hosts consuming registries. The shell does not import concrete demo or future feature implementations.
- `apps/web/app/room/demo.ts`: removable Phase 02 composition, mock state and renderer registrations for rails, dock, participant menu, workspace and More. Additional settings/menu contributions use the existing named extension points. No cross-feature product implementation was introduced.
- Room route composes the demo with actual authorized room identity; the global navigation/footer are hidden while immersed.

## Phase 01 cleanup outcome

Microsoft is deferred by default with `OAUTH_MICROSOFT_ENABLED=false`, even if its old credentials remain configured. The adapter remains available for an explicit future re-enable. Google and Discord continue to be supplied by the server's configured-provider list. The browser harness now reflects that supported scope; isolated Microsoft adapter/service regression tests remain.

Read-only inventory of the existing local `study` development database:

| Account        | ID                                     | Provider | Created (UTC)       | Decision |
| -------------- | -------------------------------------- | -------- | ------------------- | -------- |
| Pratham Virani | `8f569061-9985-48af-8999-24748ebadbfb` | Google   | 2026-09-11 01:59:09 | Retained |
| asparaguss.24  | `cdf3f9c5-2985-46fd-93ba-e05ed31c44ea` | Discord  | 2026-09-11 02:05:01 | Retained |

The Google account owns `Studyyy` (`abafbac5-df05-4de3-92db-b9e3fa1edcfc`). No Microsoft account was present. **Intended deletion list: empty.** These are ordinary account names, with no explicit smoke-test marker or audit evidence tying each account to a disposable test. Creation times and provider names alone are insufficient. Per the user's instruction, both accounts and all dependent development records were left untouched. No migration history or foreign keys were changed. No deletion script, API, admin bypass or destructive UI was added to the product.

Two new tests exercise transactional, specifically identified fixture deletion and fresh Google/Discord account recreation in the guarded `study_test` database. They verify valid new identities/sessions, invalid old sessions, preservation of an unrelated account/room, and unchanged migration history. These use test providers; they do not claim live provider verification.

A fresh live OAuth retry through the in-app browser could not reach the application because its local CA was not trusted (`ERR_CERT_AUTHORITY_INVALID`). No certificate warning was bypassed. Therefore **fresh live account recreation after development cleanup is not verified**; no development account was deleted. The user's prior Google/Discord live acceptance is preserved.

## Database migrations

None. Existing four migrations remain unchanged.

## Configuration/environment changes

- Added documented `OAUTH_MICROSOFT_ENABLED=false` to `.env.example` and Compose. Re-enable only with a deliberate future scope change and valid credentials.
- Added `npm run validate:phase02`, which invokes the complete Phase 01/00 pipeline.
- No new dependency, secret, infrastructure service or external asset dependency.
- Rebuilt the local Compose stack with existing volumes and credentials. `npm run dev` encountered its existing Windows ACL reapplication failure. Read-only inspection confirmed `.local` is restricted to the current user, SYSTEM and administrators; the equivalent `docker compose --env-file .local/compose.env up --build --detach --wait --wait-timeout 240` succeeded without changing ACLs. The wrapper was not weakened or changed.

## Security controls/tests

- No new protected API/realtime action; existing server join, room, invitation and identity authorization remain authoritative.
- Existing Phase 00/01 hostile-client, CSRF, session revocation, IDOR, OAuth, rate-limit, escaping and architecture tests are retained.
- Added tests for registration conflicts, canonical extension order, independent tile lifecycle, stacking, snapping, geometry persistence, invalid/forged local layouts, capability flags, failed initialization rollback and camera single-renderer transitions.
- Browser checks cover real pointer drag/resize plus keyboard resize, IndexedDB commit/reload, panel collapse, fullscreen/Escape, minimize/restore/close, camera transitions, invalid-record recovery, responsive sizing, focus and reduced motion.
- Added production registration check confirming no account/user deletion route; cleanup code exists only inside the guarded service test suite.

## Tests executed

`npm run validate:phase02` **passed, exit 0**, including the full `validate:phase01` and `validate:phase00` regression chain. Final total: **142 tests passed, no skips**.

| Validation                                                             | Result                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| Unit/integration/architecture                                          | 108 passed                                                |
| PostgreSQL/Redis + identity/room service tests                         | 25 passed                                                 |
| HTTPS Chromium                                                         | 8 passed                                                  |
| Actual Docker readiness regression                                     | 1 passed                                                  |
| Formatting, ESLint, dependency boundaries, package/API/Nuxt TypeScript | Passed                                                    |
| Generated OpenAPI/JSON Schema drift                                    | Passed                                                    |
| Source security scan and Gitleaks                                      | Passed                                                    |
| Dependency audit                                                       | Passed; zero vulnerabilities                              |
| API and Nuxt production builds                                         | Passed                                                    |
| Final database inventory                                               | 2 retained users, 1 retained room, 4 unchanged migrations |
| Live OAuth retry                                                       | Deferred: browser did not trust local CA                  |

The final pipeline ran on local Node 26.8.2; Docker builds use the existing pinned Node 24.21.0 image. Hosted CI was not run. Existing nonblocking Nuxt/Vue/Zod build warnings remain. Final mobile visual review caught a dock row that did not fill its available width; its sizing was corrected and a browser geometry regression assertion added before rerunning validation. The live local API provider list was also checked: exactly `google` and `discord`.

Incremental verification: 108 unit/integration/architecture tests, 25 PostgreSQL/Redis tests and 8 HTTPS Chromium tests passed. API/Nuxt production builds, TypeScript and architecture/lint passed. Browser screenshots were inspected at 1440×900, 768×1024 and 390×844; an additional 320×568 dock assertion is included in final validation. One initial keyboard assertion was corrected to expect focus on the menu's Close control.

Evidence is saved under `.local/validation/`: `phase02-desktop.png`, `phase02-workspace.png`, `phase02-tablet.png`, `phase02-mobile.png`, `phase02-mobile-workspace.png`, build/Compose logs and the final combined validation log.

## Assumptions made while the user was unavailable

1. The latest user instruction supersedes the umbrella's older three-provider initial target and historical Phase 01 acceptance caveat.
2. Existing uncommitted Phase 01 files are accepted work and must be preserved. The already absent Phase 00 specification is not restored or altered.
3. Keep the Phase 01 details/join screen and enter the immersive room only after successful POST join. This avoids changing membership semantics or introducing read-side mutations.
4. Reuse existing invitation management rather than create a Phase 03 friend/invitation feature or change invite permissions.
5. An original static vector scene is sufficient for Phase 02; a catalog, uploads and animation belong to later phases.
6. Example participants, tasks, timer and chat are visibly marked as demo content. They are local examples, not claims about connected users or shared state.
7. Mock camera toggles never request a device. Camera tiles are ephemeral and excluded from persisted instances, so reload cannot silently activate a camera. Generic workspace samples retain layout and minimized state. Fullscreen is intentionally not restored on reload.
8. Fullscreen means filling the application viewport, preserving the browser's own navigation/security UI; the same control restores the previous geometry. Edge snapping uses a 16-pixel threshold; keyboard steps are 8/32 pixels.
9. Layout is per device and room, not synced or account-authoritative. Small viewports clamp geometry and show panels as an optional overlay; touch controls remain available.
10. No existing account can be confidently declared disposable from names and timestamps alone. The safe authorized cleanup action is to list and retain them.
11. Live OAuth/certificate interaction requiring the unavailable user's involvement is deferred; isolated provider tests are reported separately.

## Known limitations and intentionally deferred decisions

- **Development cleanup:** exact disposable-account identification is deferred. The two listed accounts and their room remain. Fresh live login/recreation needs a browser that trusts the local CA and, if prompted, user interaction.
- **Acceptance:** product-owner visual acceptance is still needed. Current implementation and screenshots are reviewable; no later phase was started.
- Demo controls do not implement timer/tasks/chat/media/presence/friends/RTC. The background is one static illustration. Camera demo uses synthetic content, not a real media stream.
- Persistent layouts support up to 32 tile records. Future resource-bearing tiles must use non-sensitive local identifiers and opt out if their state is ephemeral/private in ways this geometry contract does not cover.
- Optional panel render failures remain isolated by the existing renderer boundary. Future media transport and permissions require their own server implementation and hostile-client tests.
- Browser validation targets Chromium. Native applications, other browser engines and live RTC performance are outside this phase.
- The Windows development wrapper's ACL reapplication problem remains environment-specific; existing protection and direct Compose operation were verified.

## Ready for next phase

**NO — pending owner review and the deferred development-account identification/live-recreation item.** Phase 02 implementation and all automated validations are complete and ready for review. Phase 03 was not begun and requires an explicit user instruction/specification.
