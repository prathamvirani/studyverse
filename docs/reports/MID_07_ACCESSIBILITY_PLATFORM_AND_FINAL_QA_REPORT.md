# MID-07 — Accessibility, Platform Capability Layer & Final QA

STATUS: COMPLETE — AWAITING_REVIEW

Owner-authorized unattended MID-05 → MID-08 continuation. This report does not claim owner acceptance. Phase 09 and Docker → Podman remain NOT STARTED.

## Delivered changes

- Added an SSR-safe, passive capability abstraction and read-only Room Settings → Diagnostics panel. Supported means API availability, with visible permission/device/installation caveats. System camera/audio effects are System-managed; widgets, shortcuts, Live Activities and conversations Require native. No permission prompts, credential requests, notification subscriptions, wake locks, device capture or Media Session handlers are installed by discovery.
- Kept video PiP and Document PiP distinct. Existing popout fallbacks and RTC/media ownership remain intact. Future native guidance is in [PLATFORM_CAPABILITIES.md](../architecture/PLATFORM_CAPABILITIES.md).
- Keyboard focus now brings an overlapping workspace card forward through the existing WorkspaceHost owner. Escape closes Clock settings and restores its invoking button. Existing keyboard move/resize, dialogs, select typeahead, context menu escape/native second click, Shift+F10, editable selection and focus restoration remain covered by the broader suite.
- Essential workspace toolbar, Clock, Timer and room-header buttons have 44px minimum touch targets. Task actions stay visible on touch layouts and occupy a separate row with 44px buttons. Existing chat actions already reveal on focus and touch. No essential action depends exclusively on hover.
- Forced colors retains system Canvas/CanvasText materials and now explicitly uses Highlight for keyboard focus. Existing System/Light/Dark, reduced motion, reduced transparency, contrast preferences and separate glass settings remain in their current presentation owner.
- Raised the isolated browser harness startup allowance from 30 to 120 seconds after an observed cold-start timeout. This changes test startup tolerance, not product timing, assertions or retries.
- Added an optional Linux browser configuration under `tests/visual/platform.config.ts`. An ephemeral official Playwright 1.63.0 Docker server binds only host loopback and forwards loopback requests to the same guarded test fixture. Application services/volumes are untouched by this QA container.
- Added a narrowly scoped Gitleaks allowlist requiring both the exact historical MID-04A manifest path and its verified log SHA-256. The original raw finding is retained; historical evidence bytes are preserved. No general hash or source-path exemption was added.

## Accessibility and platform evidence

Windows Chromium: both focused tests passed. Linux Chromium: both passed. Linux Firefox: capability, keyboard, preference and responsive test passed; its touch-emulation test is explicitly skipped because Playwright Firefox does not support `hasTouch`. Windows and Linux Chromium both exercise that touch test. Linux uses the official `mcr.microsoft.com/playwright:v1.63.0-noble` image, observed digest `sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`.

The focused matrix checks widths 1440, 2560, 768, 390 and 320px, reduced motion, light/dark system preference, increased contrast, forced colors, Chromium reduced-transparency emulation, visible accessible names, settings reflow, same room/timer DOM identity, passive capability labels and Clock dialog focus restoration. Browser/font diagnostics and screenshots are in [mid07](../references/mid07/). Linux Firefox and Windows forced-color captures were visually inspected. Existing first-paint/theme, browser zoom and comprehensive interaction tests provide additional coverage.

Actual mobile devices, Safari, VoiceOver, NVDA and hardware OS effects are not available in this environment. Mobile widths and coarse-pointer emulation are bounded desktop-browser evidence. Firefox reduced-transparency and real OS permission outcomes are not certified. The status text and existing mute/activity labels convey state without color alone. This is an implementation audit and regression matrix, not a formal WCAG certification.

## Validation

- Unit/integration: 238/238, including two capability tests for SSR safety, secure context, API presence and absence of API invocation.
- Guarded PostgreSQL/Redis services: 83/83 across six files.
- Docker contract/readiness tests: 2/2.
- Focused Windows browsers: 2/2. Linux browsers: 3 passed, 1 explicitly unsupported touch-emulation skip.
- Lint/architecture, package/Nuxt typechecks, contract consistency, source security and secret scanning passed. The Linux config was moved under tests after the architecture checker rejected its initial root-to-root relative import; boundary rules were retained.
- API/Nuxt production build passed: Nuxt 4.5.2, Vue 3.5.42, whole output 6.75MB / 1.58MB gzip. This is total build output, not initial browser transfer.
- Formatting passes with only the two inherited MID-01 historical JSON records excluded; their bytes remain preserved. New evidence is formatted when written.
- Full browser regression: 90 passed / 2 failed in the single 92-test run; the two failures were historical expectations for touch-only task-action hiding and old media controls. Their expectations were updated for the required always-visible touch actions and current Show video/main playback surface. Both scoped repairs passed. All 92 distinct browser scenarios are therefore covered, without claiming an uninterrupted all-green full run. Assertions for inline editing, synchronized advancing collapsed playback, explicit pause/removal and single iframe ownership remain intact.
- Signed-out browser resource measurement: 15 JavaScript resources / 400,205 encoded bytes and two fonts / 70,384 encoded bytes, with no page errors. Raw resource records are in `.local/validation/mid05-08/mid07-performance.json`. This is one local load, not a general performance benchmark or compressed deployment-transfer guarantee.
- Development data: all 22 tables, column projections, row digests and migration ledger match the original baseline. No migration or reset occurred.

Logs: `.local/validation/mid05-08/mid07-*.log`. The initial focused startup timeout and touch-test fixture correction remain visible in earlier logs; successful settled runs are reported separately.

## Dependency audit boundary

The baseline audit reports 11 findings (1 low, 2 moderate, 8 high, including transitive package propagation). MID-08 will apply scoped, compatible patches for the framework serialization path. The unpatched [node-forge signature-verification advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) reaches this dependency tree through Nuxt CLI → listhen's development certificate generator. The inspected listhen path generates/parses/signs certificates; it does not invoke the affected RSA signature-verification function. No node-forge import was found in the built web/API runtime output. No arbitrary signature-verification input is added by this phase. The audit is not reported as green; the remaining upstream finding and exact post-integration audit will be recorded in MID-08. No blind downgrade, force upgrade or unrelated dependency sweep is authorized.

## Deferred polish and continuation

Minor card spacing, additional ambience art, optional thumbnail polish and further native/device/browser certification remain deferred non-blocking final-product review work. No new native integration, personal player, provider, scheduling, messaging, capture tree or membership path was introduced.

Functional blocker classification: NONE. The dependency audit boundary remains explicit; it is not an observed product failure. Historical reference and migration file hashes were restored/verified against the initial baseline after the browser runs. Checkpoint: `.local/validation/mid05-08/mid07-complete.json`. Continue automatically to MID-08 under the owner's instruction, without claiming acceptance.
