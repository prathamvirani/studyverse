# MID-08 — Nuxt 4 and UX modules

STATUS: COMPLETE — AWAITING_REVIEW

Owner-authorized unattended continuation from MID-07; no owner acceptance is claimed. Phase 09 and Docker → Podman are NOT STARTED.

## Baseline and migration decisions

The inherited web workspace already pinned **Nuxt 4.5.2**, Vue 3.5.42 and nuxt-security 2.6.0. The resulting framework pins remain the same. This phase audits and completes Nuxt 4 integration rather than claiming a Nuxt 3 upgrade occurred. The existing `apps/web/app/` structure is retained. No codemod, framework replacement, broad upgrade or domain refactor was needed.

Manifest/config snapshots and source hashes were captured before dependency edits under `.local/validation/mid05-08/pre-mid08-manifests`, `mid07-complete.json` and `pre-mid08-references`. The original run checkpoint preserves the inherited dirty tree, historical evidence and migrations.

Web TypeScript uses Nuxt 4's generated app/server/shared/node project references. Root domain TypeScript isolation remains unchanged. There are no existing plugin or middleware directories to migrate. Runtime public config contains only the existing RTC stage. Current application requests use the accepted ports; there are no active `useAsyncData`/`useFetch` cache contracts requiring migration.

## Modules and exact use cases

| Module                     | Version       | Decision/use                                                                                                                                                                                                                                                      |
| -------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @nuxt/fonts                | 0.14.0        | Owns Nuxt font-face generation and fallback handling for Inter Variable 100–900 and Instrument Serif 400 normal/italic.                                                                                                                                           |
| @nuxt/image                | 2.1.0         | Local IPX optimization for public curated room-card/background thumbnails and canonical public YouTube thumbnails.                                                                                                                                                |
| @nuxt/icon                 | 2.5.1         | Five bundled Lucide icons for primary navigation and favorites; no runtime icon API or server icon bundle.                                                                                                                                                        |
| @vueuse/nuxt, @vueuse/core | 15.0.0        | Scoped `useDocumentVisibility` in the existing YouTube renderer; domain state/geometry/authority stay with their existing owners.                                                                                                                                 |
| @nuxtjs/color-mode         | Not installed | Existing validated SSR cookie mirrors, CSS System behavior and IndexedDB persistence already prevent wrong-theme first paint under strict CSP. A second theme owner would add migration risk without a demonstrated benefit. Glass/page width remain independent. |

`@iconify-json/lucide` is pinned at 1.2.138. The existing Fontsource 5.3.0 packages are explicit web dependencies as well as shared UI dependencies. The five-icon client bundle is 1.69 KB uncompressed. All other accepted SVG semantics remain usable without wholesale conversion.

The installed npm font provider assumes unhoisted workspace packages and rewrites local CSS URLs to a CDN. A narrow build-only provider in `infra/nuxt/local-font-provider.ts` reads the three pinned Fontsource CSS entries, preserves Unicode ranges/weights/styles, copies their WOFF2 files into an ignored build cache, and exposes content-hashed same-origin assets through Nitro. Remote providers are disabled. Font preload is intentionally disabled so unused subsets/serif faces load on demand. Shared token families and fallbacks are retained; `@study/ui/styles/fonts.css` provides explicit font imports for non-Nuxt consumers. Existing license notices remain. No Apple font/icon files are distributed.

Public image components preserve native load/error/decode behavior. Optimization uses sized WebP variants with 1x/2x density and only the allowlisted `i.ytimg.com` remote domain. Private/authenticated avatars, custom uploads/object URLs, procedural/animated scenes and the full selected-room preparation path are untouched.

VueUse replaces only the renderer's document visibility listener. Hidden documents pause local provider playback; visibility recovery follows shared state without publishing a new media revision. The same iframe survives minimize/restore. Existing player destruction and room disposal remain authoritative.

## Preservation and SSR/client audit

Global SSR remains enabled. Browser storage, RTC/MediaDevices, observers, popouts, context menus, provider playback and capability detection retain their existing mount/gesture/disposal boundaries. No hydration suppression was introduced. The build-only font provider is outside the browser source graph.

The opaque route veil, cancellation/readiness gates, initial theme mirrors, actual selected-room preparation/confirmation/activation and single room tree remain in place. WorkspaceHost, room lifecycle, RTC, media/player and capture ownership are unchanged. Sessions/OAuth, authorization/privacy, app presence and authoritative productivity/media models remain the accepted architecture.

## Dependency security

The inherited devalue 5.9.2 serialization advisory is addressed by a compatible root override to **5.9.4** and targeted lockfile reification. No broad `audit fix` or Nuxt downgrade was applied.

The final dependency audit remains non-green: **11 findings (2 low, 2 moderate, 7 high)**. The seven high entries propagate from unpatched node-forge 1.4.0 through the development certificate/toolchain dependency graph. Installed listhen certificate generation/parsing does not call the affected RSA verification path, and node-forge was not found in the final built web/API runtime output. This is a documented upstream risk, not a claim that the audit passes. Low/moderate findings are esbuild/serialize-javascript and fast-uri/Fastify; no unrelated dependency sweep was applied. The inherited devalue finding is absent and `npm ls` confirms the valid 5.9.4 override.

## Validation

- Unit: 239 tests across 40 files passed with the new module dependencies, including the exact build-provider boundary and continued browser Node-import rejection.
- Services: 83 tests across six files passed against the guarded test database.
- Typecheck/build compatibility fixes: installed font preload is boolean; NuxtImg errors can be Event/string; Linux QA config needs an explicit `.ts` import under NodeNext; build-only font code must remain outside the browser graph.
- Final lint/architecture, package/Nuxt typechecks, contract consistency, source security and secret scans passed. Formatting passes with only the two inherited MID-01 historical JSON records excluded; the raw whole-repository check still flags those two preserved records. No blanket historical reformat or scanner suppression was introduced.
- Focused production asset/browser test passed: actual variable/UI and normal/italic serif faces, four accessible 22px navigation SVGs, responsive background image/favorite icon, public YouTube thumbnail, denied unallowlisted remote IPX request, no external font/icon calls, no CSP/hydration/page exceptions, visibility pause/resume without shared revision changes, and same minimized iframe identity.
- Development loopback SSR/font serving passed (200/200; 48,256-byte Inter asset; readiness probe 9.8s including compilation/request warmup). The owned dev process was stopped. Auth flows are validated separately through the isolated production harness.
- Production API/Nuxt build passed on Windows; a fresh source-based Docker Linux build passed. The first clean image exposed late font asset registration, which a warm local build had hidden. Registration now occurs in Nuxt config before Nitro initialization, and the corrected image serves the actual font successfully. Expected Vite warnings for Nitro-served font URLs were checked against successful runtime delivery rather than suppressed. Existing dependency annotation/export warnings remain in raw logs.
- Only API/web containers were refreshed. API/SFU Docker tests passed 2/2 on the final images. HTTPS proxy checks returned 200 for SSR, the public API providers route, the 48,256-byte local Inter font with immutable one-year caching, and the 1,916-byte IPX WebP thumbnail. PostgreSQL, Redis, LiveKit and proxy container IDs are unchanged. The first three retain healthy checks; Caddy has no configured healthcheck and is verified running with successful HTTPS routing.
- All 22 development tables, columns, full row digests and migration ledger match the original snapshot after the final refresh. All 299 inherited reference files, 20 migration files and 18 MID-05–07 evidence files retain their checkpoint hashes. No migration service was rerun and no volume was replaced.
- Final Linux matrix: four passed / one failed / one explicit unsupported touch-emulation skip in its six-case run; the failed Firefox module case then passed its scoped repair. Thus all five supported scenarios are covered. Chromium exercises touch and retained provider/visibility behavior; Firefox verifies fonts, SVG icons, public image optimization, responsive/accessibility behavior and the existing fail-closed credentialless-iframe explanation. No fake browser capability, COEP relaxation or provider substitution was added. The moved config's server cwd was corrected to the repository root, and its optional config typing was narrowed explicitly.

The single full Windows browser run finished **92 passed / one failed (93 total, 16.4m)**. The failure was an inherited room-card assertion expecting the literal unoptimized thumbnail URL. It now requires the optimized URL to retain the exact selected curated source and checks successful decoding. Admission by card/button/keyboard, no admission from Settings, safe Back behavior and broken-image fallback assertions remain intact. Both the scoped room-card repair and final module case passed (2/2), and the final measured module case passed again after test-only capability/reporting refinements. All 93 distinct Windows scenarios are covered; this is not presented as an uninterrupted green full run. The final packaging-only change was followed by targeted asset/entry and Linux checks; unchanged domain flows are covered by the full run.

The full run covers auth/session/OAuth/deep links; desktop/mobile navigation and Back; actual selected-room preparation/no early lease/same scene; presence/privacy/reconnect; Clock/Pomodoro/tasks/chat; backgrounds/custom imports; companions/popouts; queue/mixing; real LiveKit camera/mic/screen forwarding, revocation, advanced quality and hostile admission; appearance/glass, zoom/reflow, loader cancellation and critical first frame.

Final real YouTube observation: both clients Playing, owner 13.52s / late joiner 12.70s (separately sampled difference about 0.83s), one remote iframe, same owner iframe and advancing minimized playback. Provider 401/PiP-policy/aborted-request warnings are retained in `.local/validation/mid05-08/mid08-real-youtube.json`; this bounded observation does not certify arbitrary videos/networks/regions or Firefox embedding.

Windows/Linux screenshots and structured font/image/capability records are in [MID-08 evidence](../references/mid08/README.md); the Windows module and Linux Firefox explanation frames were visually inspected. Raw full-run and Linux failure traces, corrected runs and build/proxy records remain under `.local/validation/mid05-08/`. The owned dev process and ephemeral Linux QA container were stopped; application Docker services remain running.

## Measured performance and footprint

One same-size signed-out production-harness load after the modules: **23 JavaScript resources / 450,338 encoded bytes**, compared with MID-07's 15 / 400,205 (**+50,133 bytes, approximately 12.5%**). Font transfer remains two faces / 70,384 bytes; no page errors occurred. This is a local resource measurement, not a production-compression benchmark or proof of a universal speedup.

The 160×90 curated Cedar thumbnail is **1,916 bytes**, compared with the original 7,772 (**approximately 75.3% fewer bytes**). Its 2x variant remains available. The measurement applies to this image/viewport only.

The reported Nitro output total grows from MID-07's 6.75 MB / 1.58 MB gzip to 28.6 MB / 10.6 MB gzip on Windows and 28 MB / 10.4 MB gzip on Linux, principally because IPX includes platform-specific Sharp/native image processing. These are server artifact totals, not initial client transfers. Docker builds from source on Linux; Windows native output is not copied into its runtime. Final Windows module evidence confirms the same 23 / 450,338 JavaScript bytes and two / 70,384 font bytes after corrected packaging.

## References used

Current official [Nuxt 4 upgrade guide](https://nuxt.com/docs/4.x/getting-started/upgrade), [font configuration/providers](https://fonts.nuxt.com/get-started/configuration), [Nuxt Image configuration](https://image.nuxt.com/get-started/configuration), [Nuxt Icon](https://github.com/nuxt/icon), [VueUse document visibility](https://vueuse.org/core/useDocumentVisibility/), [color-mode](https://color-mode.nuxtjs.org/) and the [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv), cross-checked against installed package metadata/types/source. Where live documentation differs from installed types, installed compatible APIs govern implementation.

## Classification and stop

FUNCTIONAL BLOCKERS: NONE. The cold-build font packaging issue is fixed and verified. The inherited Firefox credentialless-iframe limitation remains explicit and fail-closed; existing accepted isolation behavior is preserved.

DEFERRED NON-BLOCKING POLISH: inherited minor spacing/alignment/icon/animation preferences remain deferred under owner authorization. Native Safari, hardware mobile and screen-reader certification remain unavailable validation boundaries. Unpatched toolchain audit findings remain explicitly disclosed.

No development data reset, migration edit, identity regeneration, volume replacement, container-runtime migration or Phase 09 implementation occurred.

Checkpoint: `.local/validation/mid05-08/mid08-complete.json`. Final coordination and the [consolidated report](MID_DESIGN_REFRESH_FINAL_REPORT.md) leave MID-05, MID-06, MID-07 and MID-08 COMPLETE — AWAITING_REVIEW without owner acceptance. STOP after MID-08; no later work is authorized by this completion.
