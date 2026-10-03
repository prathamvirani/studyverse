# MID-01 — Visual Foundation, Global Shell & Motion

2026-09-20 correction review (original implementation: 2026-09-13). **COMPLETE — AWAITING_REVIEW.** MID-00 is accepted. Phase 08 remains **ACCEPTED**. Phase 09 and MID-02+ have not begun.

## Changes

Evolved the existing global shell into an adaptive liquid-glass navigation rail/bottom bar and a wide page foundation. Introduced semantic tokens, bundled typography, System/Light/Dark appearance, Auto/Compressed/Full-width layouts, shared controls and intentional spatial motion. The September 20 corrections below supersede the original translucent-veil policy. The implementation preserves existing routes, data, server contracts, room geometry and media authority.

### Files changed

All paths below are relative to the repository root.

- `packages/ui/src/styles/tokens.css`, `styles/primitives.css`: new shared token/material/control styles.
- `packages/ui/src/components/primitives.ts`, `src/index.ts`, `package.json`: ten shared primitives, icon exports and pinned font/icon dependencies.
- `apps/web/app/app.vue`: the existing shell, navigation composition, width/footer layout, semantic global styles and route veil.
- `apps/web/app/components/navigation/AppNavigation.vue`: one responsive navigation tree, profile popover and appearance/layout sheet.
- `apps/web/app/lib/appearance.ts`, `composables/useAppearance.ts`: versioned definitions, SSR mirror validation, device preference persistence.
- `apps/web/app/composables/useRouteMotion.ts`: generation-scoped first-frame read tracking.
- `apps/web/app/components/RoomListing.vue`: PageHeader and IntegratedSearch adoption; existing query/cursor/authorization behavior retained.
- `apps/web/app/pages/index.vue`, `account.vue`, `friends.vue`, `invite.vue`, `rooms/new.vue`, `rooms/[id].vue`: replace only the initial mounted-read wrapper with critical-page tracking.
- `apps/web/app/room/room.css`: shared material/text/focus tokens and font selection; no geometry, presence or media logic change.
- `apps/web/nuxt.config.ts`, `apps/web/public/licenses/*`, `package-lock.json`: shared styles, delivered license notices and exact dependency resolution.
- `tests/unit/appearance.test.ts`, `tests/fixtures/ui-primitives.ts`, `tests/browser/visual-foundation.spec.ts`: new preference, control, responsive and navigation regressions. The fixture is test-only and is never a production route.
- `docs/architecture/VISUAL_FOUNDATION.md`, this report, `docs/ACTIVE_PHASE.md`, `docs/PHASE_HISTORY.md`: architecture, evidence and coordination.

The supplied MID-00 material, accepted reports, phase specifications, migrations, contracts, API and feature implementations are preserved.

## Tokens and typography

Color tokens: canvas; surface/elevated surface; glass/elevated glass; primary/secondary/muted text; border/highlight; accent/hover/pressed/on-accent/subtle; success/warning/danger and supporting status surfaces; focus ring and scrim. Neutral light and deliberate charcoal dark values replace the global cream/green presentation. Existing environment/artwork and feature-specific status colors were not blindly rewritten.

Space tokens cover controls, page, cards and sections. Shape tokens cover controls, cards, sheets, capsules and circles. Depth uses surface/elevated shadows and an inset glass highlight. Motion tokens are micro 140ms, quick 200ms, standard 320ms and expressive 480ms, with standard/enter/exit and two soft spring-like cubic-bezier curves.

Inter Variable **5.3.0** and Instrument Serif **5.3.0** are bundled from Fontsource and served from the app origin; both carry SIL OFL 1.1 notices. Instrument Serif 400 normal/italic is limited to expressive hero/room atmosphere/workspace-guide headings. UI and avatar initials use Inter. Typical weights are 400/500/selective 600. Existing timers plus numeric inputs, badges/counts and playback readouts use tabular numerals. No SF or New York fonts are shipped. Lucide **@lucide/vue 1.45.0** provides one SVG icon system with its redistribution notice.

Delivery follows [Fontsource's self-hosting guidance](https://fontsource.org/docs/getting-started/install). Fonts are selected by Unicode subset and use swap; a brief font fallback remains possible on an uncached full-document load; client route reveal now waits for the first-frame font set. This is distinct from theme flash, which is prevented by server-rendered theme attributes and CSS System resolution.

## Appearance and shared controls

System is the default and responds directly to OS color-scheme changes. Explicit choices persist using the accepted versioned IndexedDB adapter, with small validated Secure/SameSite presentation-cookie mirrors for SSR first paint. No authentication storage, CSP weakening, migration or preference rename was introduced. See [the architecture record](../architecture/VISUAL_FOUNDATION.md) for mirror precedence, cookie expiry/clearing and storage-failure behavior.

Shared primitives: GlassSurface, PageHeader, ContextPane, IntegratedSearch, StudySelect, SegmentedControl, IconButton, StatusBadge, Loader and SettingsSheet. PageHeader/search are used in RoomListing; sheet/select/segments/badges and icon controls support the shell. ContextPane is a tested foundation for later contextual page content. Existing native selects, room dialogs and renderer caches remain in place.

Controls have accessible names, unique field/description IDs, controlled selection/value, disabled/busy/error handling, visible focus and touch-sized targets. Select supports arrows, Home/End, typeahead, selected/disabled options, Escape and Tab. Its list expands in flow with bounded scrolling, which avoids clipping inside the settings sheet. Native dialog/popover behavior is retained; the modal adds explicit Tab wrapping and returns focus to its opener.

Reduced transparency increases surface opacity and removes blur while retaining borders/elevation. Increased contrast strengthens borders and uses opaque materials. Forced-color rules retain selected/focus outlines. Reduced motion removes expressive movement and spinner rotation.

## Shell, widths and transitions

The floating rail contains Home, Rooms, Friends and Discover, with profile at the bottom. Account & devices is in the profile popover. Existing registration identities and `/` Home route remain; no chat/DM destination was invented. The same tree becomes a bottom tab bar at 760px and below. Immersive rooms hide global navigation/footer and retain room-specific controls.

The shell fills `100dvh`; main flexes above a normal-flow footer. Desktop navigation has reserved horizontal space. Mobile has bottom safe-area/content padding so final content clears the tabs. At 3440px, measured main widths are Auto **3195px**, Compressed **1560px**, Full-width **3328px**; Compressed still fits four room columns. Auto/Full-width fit ten minimum-width grid tracks. This does not change Home's existing three-record data slice or introduce manual grid density.

Ordinary navigation fades a full-viewport canvas cover in for **150ms**, then mounts the destination behind its fully opaque surface. It shows **only a centered spinner**, with a screen-reader loading label and no visible wordmark, text, card or button. The opaque canvas material is independent of Glass Transparency. Critical initial reads, Nuxt completion, a Vue flush, current fonts and first-viewport native image decoding gate reveal. Pending content is hidden and inert. The completed loading status leaves the accessibility tree when reveal begins. Once ready, the surface fades out for **200ms** with no added loading minimum. There is no page translation, scale, rising reveal, sliding cover or clip-path travel. Opacity changes only before destination mounting and after destination readiness; it remains 1 throughout loading. Escape returns to the sequence's origin. Rapid/cancelled attempts remain isolated by generation and abortable readiness. One keyed NuxtPage host, with KeepAlive and page-tree transitions disabled, avoids retained immersive/media trees.

Profile surfaces, navigation lift/press, segmented changes and sheet opening/closing express depth and origin. Reduced motion is strictly an OS/browser accessibility override. No product Reduce Motion control was added. Local tabs, preferences and explicit room join retain their existing boundaries; workspace dragging/snapping and room/media lifecycle are untouched.

## September 20 acceptance corrections

Only remaining MID-01 corrections were implemented; previously completed page foundations and features were retained. Added `apps/web/app/lib/critical-frame.ts` for abortable first-viewport readiness. Updated the existing shell, appearance model, navigation/settings, material and primitive styles, preference tests and focused browser tests. No new dependency, contract, schema, API, migration, participant-presence or YouTube/media lifecycle change.

Glass Transparency appears under Appearance with Auto recommended by default and a keyboard/touch native slider. Manual values preview immediately and persist in the accepted versioned IndexedDB adapter plus the validated `study-glass-transparency` SSR mirror. Root-attribute selectors resolve the shared material tokens before hydration; there are no page-specific opacity overrides, inline-style/CSP exceptions or asynchronous theme flips. Auto chooses base opacity **84% Light / 82% Dark**, with elevated opacity **90%** in both themes. Manual Light base opacity spans **94-58%**, elevated **97-68%**; Dark base spans **92-54%**, elevated **96-64%**. The balanced midpoint is Light **76% / 82.5%** and Dark **73% / 80%** (base / elevated). The percentage is a bounded preference level, not raw alpha. Reduced-transparency / increased-contrast preferences force solid materials. Background-aware room adaptation remains MID-04.

Paired visual checks over a diagnostic striped backdrop show clearly increased background transmission while text and controls remain readable in both themes. Opaque page cards and search fields retain their existing contrast. The prior narrow-range worst-case contrast figures do not apply to the wider manual range and are superseded by this review; arbitrary background contrast certification is not claimed. Auto and the OS solid-material overrides remain available. The route loading surface is always opaque at every glass setting.

Verification and refreshed visual evidence for these corrections are recorded below; the September 13 validation history is retained separately.

## September 20 visual-review follow-up

This follow-up supersedes the earlier branded/retracting route cover and narrow manual material range. Ordinary navigation now uses the fade-only spinner sequence described above. AppRail, profile popover and Appearance sheet use the wider shared alpha mapping; blur, tint and border values are unchanged. Auto remains the recommended default and OS reduced transparency/increased contrast force opaque surfaces. Existing room material alpha mapping is explicitly preserved; room-specific tuning remains MID-04.

- **34 browser regressions passed, no skips**, on the final production build (`.local/mid01-quiet-glass-browser-final.log`): all 25 pre-existing cases and nine MID-01 cases. Includes actual Light/Dark base and elevated alpha at 0/50/100, immediate AppRail/profile/sheet response, Auto, persisted manual reload and JavaScript-disabled first paint, reduced transparency, centered spinner, opaque pending data/images, per-frame fade-only/reduced-motion checks, rapid and cancelled navigation, request errors, and room/media/SFU lifecycle ownership.
- **192 unit/integration/security/architecture tests passed** in 30 files (`mid01-quiet-glass-test.log`). No backend contracts or room/media ownership code changed.
- Production API/Nuxt build, lint/boundaries, typecheck, contract drift, source-security, scoped formatting and `git diff --check` passed (`mid01-quiet-glass-build-final.log`, `mid01-quiet-glass-lint.log`, `mid01-quiet-glass-typecheck.log`, `mid01-quiet-glass-contracts.log`, `mid01-quiet-glass-security.log`, `mid01-quiet-glass-format.log`).
- **Two Docker readiness tests passed** (`mid01-quiet-glass-docker.log`). Only the local web image/container was rebuilt and refreshed; backend services, volumes and data were preserved (`mid01-quiet-glass-compose-build.log`, `mid01-quiet-glass-compose-refresh.log`). A fresh isolated browser session against **https://localhost:8443** confirmed Light/Dark alpha, manual persistence, settled navigation and zero page/CSP errors (`mid01-quiet-glass-smoke.log`).
- [Thirteen final screenshots, alpha measurements, frame samples and local smoke evidence](../references/mid01/quiet-glass-2026-09-20/README.md) preserve the prior evidence separately. Twelve paired surface images use a test-only striped backdrop to demonstrate actual background transmission at solid/midpoint/transparent settings; the production surface styles remain intact. The remaining image holds a first-viewport image request pending behind the opaque spinner-only loader. The final image release-to-complete-reveal observation was **319ms**, including delivery/decoding, the 200ms fade and assertion polling, with no added loading minimum.

The first full browser pass exposed a completed loader still being announced during its fade-out, overlapping the ready page's status message. The transition now removes the completed loader from the accessibility tree as fade-out starts and restores its loading semantics on entry. The original account regression was preserved and passes in the final 34-case run. Early new-test selector casing and tuple typing mistakes were corrected before the final run. No service/dependency suite was repeated for these presentation-only changes; prior results remain historical. Local verification uses Chromium; physical devices, other browser engines and screen-reader operation were not certified.

MID-01 remains **AWAITING_REVIEW**. MID-02 has not begun; feature-specific room glass remains MID-04.

## September 20 earlier correction validation history

- **192 unit/integration/security/architecture tests passed** in 30 files (`.local/mid01-corrections-test.log`); focused preference/UI/adapter coverage passed **8 tests**, including bounded glass values and storage reopen (`mid01-corrections-focused.log`).
- **32 browser regressions passed** with no skips (`mid01-corrections-browser-regression.log`): all 25 existing authentication, rooms, productivity, background, social and RTC/media cases plus seven MID-01 cases. The 25 pre-MID-01 regression cases were not weakened or edited.
- After the final segmented hover contrast fix and pre-commit cancellation safeguard, **all seven focused acceptance cases passed again** on the final production build (`mid01-corrections-acceptance-final.log`). Expensive SFU cases were not unnecessarily repeated after those narrow fixes.
- Final production build, lint/boundaries, typecheck and source-security checks passed (`mid01-corrections-build-final.log`, `mid01-corrections-lint-final.log`, `mid01-corrections-typecheck-final.log`, `mid01-corrections-security-final.log`). Contract drift check passed (`mid01-corrections-contracts.log`). Scoped formatting and `git diff --check` passed.
- [Fourteen refreshed screenshots, dimensions and reveal timing](../references/mid01/corrections-2026-09-20/README.md) preserve the original September 13 evidence separately. Screenshots settle finite animations for inspection; the opaque-loading capture holds a real image request pending. The final image release-to-complete-reveal observation was **832ms**, including image delivery/decoding, animation and assertion polling; this is bounded local evidence, not a timing SLA.

| Remaining acceptance item                         | Verified outcome                                                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| System appearance / persisted theme / first paint | Live light → dark → light changes; System survives reload; persisted Dark resolves against a Light OS with JavaScript disabled.                                                                                    |
| Width preferences                                 | Auto, Compressed and Full-width survive reload and retain their intended viewport measurements.                                                                                                                    |
| Glass                                             | Auto default and persistence; slider Home/End/arrows and immediate preview; manual reload and JavaScript-disabled first paint; Light/Dark; OS reduced transparency forces opaque glass even at the manual maximum. |
| Mobile / immersive navigation                     | Same rail becomes bottom navigation at 760px; 320px and 390px remain usable; immersive room has no global rail/footer, and route departure removes the room tree.                                                  |
| Keyboard / overlays / footer                      | Rail and profile traversed by Tab/Enter; search/select/segments states covered; sheet Tab containment, Escape and opener restoration pass; short-window and mobile footer remain reachable.                        |
| Opaque route preparation                          | Cover base is opaque with opacity 1 regardless of glass preference; pending destination is hidden and inert; data/image loading, image decode, fonts and DOM readiness precede reveal.                             |
| Cancellation / rapid navigation                   | Cancel during a delayed read, cancel in the frame before route commit, overlapping route guards, retired requests and destination request errors all settle without a stuck cover.                                 |
| Immersive/media ownership                         | One keyed non-retained page tree; existing late-room-entry race and single camera renderer/browser lifecycle cases pass. No participant-presence or YouTube/media lifecycle code was changed.                      |
| Motion accessibility                              | Earlier expressive route/surface/segment motion; OS reduced motion removes travel/spinner animation. No product Reduce Motion setting.                                                                             |

The first focused run passed six cases and exposed an outgoing-stage test synchronization gap: checking only for absence of the cover could finish before the departure animation ended. The pending cover now exists for the entire navigation, and the settle helper also requires main to be ready. Subsequent focused and full runs passed. Visual inspection found a global hover rule washing out selected dark segments; the shared control now preserves its moving material and foreground contrast, with a browser assertion. A targeted cancellation case verifies the one-frame pre-commit boundary rather than relying only on request-time cancellation.

Docker was initially stopped. Existing services were started without resetting volumes/data, but the normal proxy could not bind **127.0.0.1:8443**, which is occupied by the user's Steam process. Steam was left running. Only the local web image was then rebuilt and refreshed with `build web` and `up -d --no-deps --wait web` (`mid01-corrections-compose-build.log`, `mid01-corrections-compose-refresh.log`). The Linux image build passed, the web container is healthy, and a direct internal HTTP smoke returned 200 with the new glass SSR attribute. All browser verification used the latest built application through the isolated HTTPS harness on **8449**. Normal Compose proxy/readiness and a fresh 8443 smoke are therefore **not claimed** for September 20. No backend/dependency changes warranted repeating the standalone service suite or dependency audit; their September 13 results remain historical below. Physical-device, screen-reader, Safari/Firefox and external-network certification remain outside this local verification.

MID-01 remains **AWAITING_REVIEW**. MID-02 has not begun; room-specific liquid-glass adaptation remains MID-04.

## September 13 validation history

At the original implementation checkpoint, all applicable checks passed. Those regression groups totaled **290 tests, no skips**. Logs live in `.local/mid01-*.log`; [11 durable screenshots and matrix measurements](../references/mid01/README.md) are under `docs/references/mid01/`, with original captures in `.local/validation/mid01/`.

- Focused preference/UI/adapter tests: 7 passed.
- Final unit/integration/security/architecture suite: 191 passed in 30 files.
- Real PostgreSQL/Redis services: 67 passed in 6 files.
- Complete HTTPS Chromium/browser/SFU regression suite: **30 passed**, including all 25 pre-existing cases and five MID-01 cases (`mid01-browser-final.log`).
- After the final scoped CSP/control-style correction: **five focused browser cases passed again** (`mid01-visual-final.log`), including no initial CSP errors, three horizontal appearance segments and real emulated touch taps. No expensive SFU group was unnecessarily repeated.
- Docker/readiness: **2 passed** (`mid01-docker.log`).
- API and Nuxt production build: passed (`mid01-build.log`); Linux Docker web image build also passed (`mid01-compose-build.log`).
- Lint and architecture boundaries, package/API and Nuxt typecheck: passed (`mid01-lint-final.log`, `mid01-typecheck.log`).
- Generated contract drift and source-security checks: passed (`mid01-contracts.log`, `mid01-security-final.log`).
- Dependency audit: zero reported vulnerabilities (`mid01-audit.log`).
- Scoped formatting and `git diff --check`: passed; supplied MID-00/refresh reference documents were not reformatted.

New browser coverage includes desktop, all three ultrawide width modes, rail and bottom-bar tablet widths, 390px and 320px mobile; Light/Dark/System; dark first paint with JavaScript disabled against a light OS; live OS change; reduced transparency/contrast/motion; select/segments/search states; overlay keyboard/focus; footer reflow; delayed-route cancellation; immersive navigation exclusion; and actual emulated touch taps.

During implementation, new-test setup issues included intercepted-request cleanup racing `route.continue`, a normal Playwright click waiting on a deliberately disabled option, and CSS minification canonicalizing `0ms` to `0s`. Assertions were corrected to exercise the intended behaviors without disabling accepted coverage. A real reveal interaction issue was fixed by keeping ready controls usable and preserving newly acquired focus. Native dialog Tab boundary wrapping was added after the keyboard regression exposed browser-chrome focus cycling. An early template assembly error was fixed before successful production builds. Final visual review caught a strict-CSP violation from the new segmented control's SSR style attributes: sizing now uses CSSOM property writes, with no CSP policy exception. An explicit initial-layout/CSP browser assertion covers the fix; the focused suite passed again on the final source.

## Performance and limitations

Blur is limited to navigation, popover/sheet and existing room glass hosts. Content cards and search fields use opaque surfaces. The opaque route cover animates only opacity; expressive surface interactions continue to use transforms and opacity. No large animated blur, captured media snapshot or new animation framework is used. Room resources, WorkspaceHost, RTC ownership, provider activation and shared media authority remain unchanged.

Room chrome deliberately retains dark compatibility tokens even when non-room appearance is Light. Background-aware room opacity and feature-wide token/select adoption are later work. Present global colors do not claim to eliminate all 124 audited literals. Contextual side-pane data and page composition remain later-phase work. Font fallback on a cold load, actual browser/provider delays and existing single-process service bounds remain.

Validation uses local Windows Chromium with emulated viewports/preferences/touch; physical mobile, screen-reader, Linux, Firefox, Safari, public-network and fresh external OAuth certification are not claimed. Existing known presence/privacy and YouTube-loop reports were not declared fixed.

The September 13 full browser run's real YouTube probe observed Playing at about 9.1 seconds. It also recorded external provider warnings and the subsequently corrected segmented-control CSP warning; it is a bounded one-client playback observation, not a claim to fix the deferred two-client loop issue. Deterministic two-client synchronization and the existing real SFU security scenarios separately passed.

At the September 13 checkpoint, only the local web container was rebuilt/refreshed with `docker compose ... build web` and `up -d --no-deps --wait web`. API, database, Redis, LiveKit, secrets, volumes and migrations were not replaced/reset. This is a local development refresh, not a public deployment. The refreshed stack passed both readiness tests again (`mid01-docker-refreshed.log`). A separate isolated browser smoke at `https://localhost:8443` verified persisted Dark appearance, successful same-origin Inter/Instrument Serif font responses, navigation, and zero page/CSP errors (`mid01-local-smoke.log`, `.local/validation/mid01/local-smoke.json`). That end-to-end navigation observation was about 887ms including real route/data readiness and browser interaction overhead; it is not presented as a ready-page timing benchmark.

## Explicitly deferred

MID-02 auth/onboarding/account redesign, `/home` routing, usernames and ultrawide first-run prompt; MID-03 Home/room-card/Discover/Friends composition and richer data; MID-04 participant/presence/privacy, room geometry/cards/settings/opacity; MID-05 productivity and Clock; MID-06 media/YouTube metadata, one-action playback and renderer lifecycle; MID-07 final platform-wide QA. Phase 09 Personal Study Player and all later roadmap work remain unstarted.

Stop after MID-01. Owner acceptance and separate authorization are required before another MID phase.
