# MID-04 — Room Shell, Workspace, Presence & Settings

Date: 2026-09-20. Implementation against the owner's accepted, uncommitted MID-03 working tree.

Status: **COMPLETE — AWAITING_REVIEW**. Phase 08 and MID-00–03 remain accepted. MID-05, MID-06 and Phase 09 have not begun.

## Scope and preservation

The immersive room now uses compact floating chrome, independent workspace cards, background-aware glass, a categorized Room Settings sheet and recoverable presentation presets. The global AppRail and footer remain outside the active room. The accepted opaque fade/spinner route veil, room admission/cancellation, authorization, identity, social projections, background lifecycle and media ownership remain in place.

No migration, dependency, new durable table, server presence policy, SFU admission policy or wire contract was introduced. A start-of-task file hash inventory is retained at `.local/validation/mid04/baseline.json` to distinguish this phase from inherited changes. Integrity verification confirms 154 existing migration, dependency, Compose and historical evidence files match that baseline. Historical phase reports and references are preserved.

## Room shell and participants

The header has separate back, room-name/privacy and Invite surfaces. The left rail places presence at bottom-right and a muted-microphone icon at top-right. Names are concise and accessible labels include presence and microphone/speaking state. Visible counts explicitly mean “participants visible to you.” Participant actions open beside the rail rather than being clipped by its scrolling container.

Camera placement still uses the existing RTC renderer map and ownership callbacks. Expansion reparents the same video element; minimizing/closing returns it to the rail. The room's persistent audio host is outside the hideable header, so presentation presets do not unmount audio. Neither the new rail nor the presentation layer enumerates raw LiveKit participants.

Microphone activity comes from the existing provider's measured participant `audioLevel`, propagated through its snapshot and `ActiveSpeakersChanged` event. A level above 0.02 on an unmuted microphone enables the speaking ring and dock state. A microphone track alone does not indicate speech. No second microphone capture, AudioContext analyser or per-frame loop was added. Clipping warnings are not claimed because the provider does not expose reliable clipping measurements.

## Two-account reproduction and privacy interpretation

The browser reproduction uses distinct Google and Discord fixture-authenticated identities against the real application API, database and WebSocket projection. It is not a claim of signing into two external production OAuth accounts.

With both users' room-presence sharing disabled, B's chat reaches A while each participant rail contains only self. This is correct privacy filtering: permission to send room chat does not imply permission to broadcast ordinary room presence. With both users opting in, A and B each see exactly two participants; an offline/reconnect cycle and reload do not duplicate them. Hiding B removes B from A's ordinary presence view, enabling sharing restores B, and leaving removes B. No server privacy workaround was needed.

The existing, narrow authorized media-publisher projection remains separate from ordinary social presence. An active publisher can be visible to authorized room members under the accepted RTC policy; this is not a reason to expose the complete SFU roster. Existing block, membership and admission controls remain authoritative.

## Materials and atmosphere

Room glass derives its opacity from the accepted global Glass Transparency preference. Auto layers a room-specific value over that shared preference; manual values remain effective. Light/Dark appearance influences chrome tint without changing the background asset. Elevated sheets use stronger material than base chrome.

The environment samples a 16×16 canvas once per selected asset and uses mean brightness and variance to classify dark, light or complex backgrounds. Animated frames are not repeatedly analysed. Canvas/read failures use a conservative complex-material fallback. CSS tokens control opacity, tint, blur, highlights and shadow; there are no inline page-opacity overrides. Reduced transparency and increased contrast force opaque, unblurred material; forced colors use system colors, and missing backdrop-filter support receives an opaque fallback.

“THE QUIET HOURS / Make yourself a little space.” retains a background-integrated local haze and responsive type. The previous short-height rule that hid it is overridden. Space remains reserved above the dock at short heights and narrow widths. Presentation settings can intentionally hide it.

## Workspace, geometry and persistence

Pomodoro, Tasks, Chat and Clock register independent `workspaceCard` tile definitions through the existing composition/WorkspaceHost. Pomodoro, Tasks and Chat continue to render their accepted feature components. Clock is a small local time/date renderer whose interval is disposed on unmount. Detailed productivity internals are deferred to MID-05.

All cards share the existing drag/resize, bounded layout, z-order, minimize/restore, fullscreen and keyboard mechanisms. Arrow keys move/resize; Shift uses a larger step. The Workspace menu and Appearance category independently show/hide each card and expose Recover card layout. Fresh narrow rooms start with recoverable minimized cards rather than covering the entire room. Smaller desktop heights may minimize cards that do not fit the initial column.

Dragging toward the right third reveals a vertical snap column and highlights the proposed slot before drop. Releasing snaps; pointer cancellation does not commit a snap. Dragging or keyboard movement unsnaps; toolbar buttons provide a keyboard-accessible snap/unsnap alternative. An occupied target displaces its previous card into bounded free placement. Slots and free geometry reflow with the viewport. Reduced motion removes spring travel while retaining placement behavior.

Validated IndexedDB preferences are scoped to user and room. They retain geometry, stacking, individual visibility, snap membership and local dimming; legacy room-only layouts are imported once. Unsupported/corrupt layouts recover through existing validation. RTC media tiles remain non-persistent, and fullscreen is cleared in snapshots. Identical state is not written repeatedly as audio snapshots update. Storage failure retains usable memory behavior with a notice.

## Dock and settings

The dock order remains Media, Background, Microphone, Camera, Screen Share, More. Shared Lucide icons replace glyphs; short labels, tooltips and accessible names remain. RTC source buttons distinguish inactive, starting, active, speaking (microphone only) and error. Per-source error descriptions accompany visible error icons. Explicit user actions alone acquire media; permission denial and picker cancellation do not retry automatically. Camera/mic remain off after reload.

More opens Room Settings using the accepted native-dialog SettingsSheet. Desktop has categories beside a bounded scrolling content pane; narrow screens use category selection and a Categories back action. Categories are Media & Devices, Quality, Audio, Camera, Appearance, Room & Privacy, Notifications and Diagnostics. The sheet retains native inertness, Tab containment, Escape/outside close and opener restoration, with fade/scale and a blurred/dimmed backdrop.

Feature-owned settings render through a generic `roomSettings` contribution with category context. QualityModel remains the single owner of media preferences. Quality presets, mode and voice presets apply immediately; advanced custom stream parameters retain a transactional Apply action to avoid repeated live renegotiation while editing several interdependent values. Saving a named profile remains explicit. Raw requested/effective/actual transport detail is under Diagnostics. Notifications honestly describes existing in-room notices; it does not introduce browser-notification permissions.

Appearance reuses `useAppearance` for global theme/transparency and the accepted preference store for room-only layout/presentation. It does not create a second global preference source.

## Presentation and accessibility

Standard shows normal chrome and cards. Minimal shows timer/clock, Ambient shows clock and atmosphere, and Projector enlarges timer/clock with stronger material and hidden chrome. Custom exposes individual chrome/card choices. Quiet presets hide minimized-card restore buttons as well as the dock.

One visible Reveal controls hotspot temporarily restores chrome. Escape restores normal controls and focuses More; it first respects an open dialog, participant menu or fullscreen tile. Closing settings with chrome hidden focuses the recovery hotspot. Re-entry always restores header, rail and dock, even when a quiet preset was saved. Device-local card choices remain recoverable.

Buttons have visible focus, accessible state and non-color cues. Native settings containment is retained; fullscreen workspace containment includes enabled buttons, links, inputs, selects and textareas while other room controls and minimized restores are inert. The rail, settings contents and card contents scroll independently. Safe-area offsets protect the dock and outer controls.

## Lifecycle and boundaries

RoomShell remains a generic host and imports no concrete room feature composition. WorkspaceHost remains the only geometry controller. The presentation module contains only validated local preference semantics. The existing route owns admission, RTC session and disposal; this phase does not introduce a second route tree or transition owner. Workspace observers, document listeners, preference stores and clock timers are cleaned up. Background URLs/effects and RTC nodes retain their accepted disposal paths.

## Validation and evidence

The full regression covered **326 passing tests**: 200 unit/integration/security/architecture, 78 real-service, 46 browser and 2 Docker checks. No skipped tests were reported. Logs are under `.local/validation/mid04/`; 19 browser screenshots and their index are under `docs/references/mid04/`.

| Validation                                   | Result and evidence                                                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused development                          | Workspace, RTC, quality and architecture checks; room browser corrections validated before the full run. Initial failures and corrections remain in the logs.                                                                               |
| Unit / integration / security / architecture | 200 passed in 32 files; `unit-final.log`.                                                                                                                                                                                                   |
| Real-service integration                     | 78 passed in 6 files; `services-final.log`.                                                                                                                                                                                                 |
| Full browser regression                      | 46 passed in 6.5 minutes; `browser-full.log`. Includes identity/account, room browsing, social privacy, productivity, backgrounds, media, route veil, global appearance and the new room checks.                                            |
| Accepted RTC / SFU regression                | All real two-publisher, same-account/two-tab, block/revocation, advanced quality, signed admission and orphaned credential cases passed in the full browser run. Measured speaking feedback is asserted on both local dock and remote rail. |
| Lint / types / contracts                     | ESLint, architecture boundaries, package/Nuxt typecheck and generated-contract check passed; `lint-final.log`, `types-final.log`, `contracts-final.log`.                                                                                    |
| Security                                     | Source and secret scans passed; dependency audit reported zero vulnerabilities; `security-*-final.log`.                                                                                                                                     |
| Build                                        | API and Nuxt production builds passed; `build-first.log` and subsequent web build logs. Final presentation-only changes receive a delivery build and focused room checks.                                                                   |
| Docker / local environment                   | Two Docker checks passed. Only the web container was rebuilt/recreated; PostgreSQL, Redis and LiveKit were retained. HTTPS smoke verified branded sign-in, stale-cookie public fallback, protected account 401, and no page/CSP errors.     |
| Data / accepted baseline                     | All 19 development tables retain identical counts and content digests; `data-preservation.log`. Protected-file integrity passed; `integrity-final.log`.                                                                                     |
| Formatting / whitespace                      | Changed files formatted; `git diff --check` passed. Repository-wide Prettier reports only the two unchanged historical MID-01 reference JSON files listed below.                                                                            |

The whole-repository formatter still reports `docs/references/mid01/corrections-2026-09-20/layout-matrix.json` and `ready-reveal.json`. These inherited evidence files match the baseline and were deliberately preserved. The full validation groups were run explicitly rather than claiming an all-green `validate:phase08` wrapper that would stop at those historical formatting exceptions.

Responsive checks cover 3440×1440, 1440×900, 820×1024, 390×844, 320×568, 1024×480 and 640×450 CSS-pixel viewports. The final size represents desktop 200% zoom-equivalent reflow, not a certification of every browser's native zoom implementation. Room/header/rail/dock/quote bounds and sheet overflow are asserted. Glass fixtures exercise light, dark and complex backgrounds, global manual/Auto settings, Light/Dark, reduced transparency and forced colors/reduced motion.

Older browser tests were updated to address independent cards and category navigation while retaining their security, lifecycle, productivity and media assertions. The isolated RTC fixture now loads the new room material/geometry stylesheet as well as the legacy base. Focused failures identified and corrected the recovery-focus selector, an accessibility CSS precedence issue, and assertions that read asynchronous state too early or assumed fullscreen retained the article role.

Final visual review reserved another 22 CSS pixels below the workspace in short windows, separating restore controls from the atmosphere quote. A focused geometry assertion checks that separation and header/workspace-control separation. The final three room presentation checks passed (`browser-delivery.log`); the final screenshot/readiness and recovery check also passed (`browser-capture-final.log`). The delivery production build passed (`build-delivery.log`). These spacing and explanatory-copy corrections do not change transport, authorization or media ownership; the expensive SFU group was not repeated after them.

## Limits and explicit deferrals

- Auto classification is a cheap whole-image brightness/variance proxy, not a per-surface photographic contrast audit. Complex/read-failure fallback is conservative; unusually mixed backgrounds still benefit from manual transparency.
- The first snap implementation is one vertical column with up to four slots. Slot collisions displace a card; a 2×2 arrangement and drag ordering are not added.
- Device-local layouts do not sync between devices. Re-entry deliberately restores discoverable chrome instead of automatically hiding it again.
- Test media is synthetic browser capture through the real local SFU. This does not certify physical devices, WAN performance or all browser/platform combinations.
- Detailed Pomodoro, Tasks, Chat and Clock redesign is deferred to MID-05. Detailed media/YouTube/ambience redesign is deferred to MID-06. Existing behavior remains.
- **Phase 09 was not started. Stop after MID-04 for owner review.**
