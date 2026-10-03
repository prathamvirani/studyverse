# MID-04A — Owner Review Corrections, Room Stability & Interaction Cleanup

Status: COMPLETE — AWAITING_REVIEW. MID-04A implementation, regression corrections and implementation visual review are complete. Owner acceptance remains pending.

Authorized scope: the MID-04 working-tree baseline plus the explicitly named MID-04A corrections. Phase 08 and MID-00–03 remain accepted. MID-05, MID-06, MID-08 and Phase 09 have not begun.

## Final Owner Polish Pass

This final owner-review pass follows the 2026-10-02 brief against the current repository state. Status remains **COMPLETE — AWAITING_REVIEW**; owner acceptance is pending and MID-05 has not begun. The required specifications and guides were read completely and checked against the prior read. The v29 living document is absent, so the explicit brief governs this pass. Earlier report sections are preserved as historical evidence; the presentation and geometry described here supersede earlier versions.

### Targeted corrections

- **Room identity:** the grouped immersive room name uses the approved `var(--font-display)` / Instrument Serif, weight 400, with an elegant 20–26px treatment. Privacy retains UI sans. White foreground, text shadow and localized light/complex-scene haze remain. Bright Morning studio, dark After midnight and complex Cedar library were inspected at manual fill 0; no glass-opacity mapping changed.
- **Card headers:** WorkspaceHost composes the move/title, registered Personal/Shared contribution and grouped utilities into common card chrome. Scoped cards wrap the utility group at compact widths and share one row when sufficiently wide. Scope changes preserve header geometry; no duplicate body title or feature-specific renderer was added. Chat and Clock keep the same title/utility family.
- **Menus:** MenuRow owns transparent resting rows, primary foreground on hover/focus, subtle tint, stronger meaningful active tint and muted disabled state. These rules override inherited room-button hover styles. More and the global context host use shared icons; context rows have consistent hit targets, padding and a quiet separated native-browser hint. First custom/second native right-click behavior remains.
- **Dynamic snaps:** the existing Workspace geometry derives candidate columns and vertical free bands from current header, Workspace pill, participant rail and dock rectangles. Width can shrink to actual available space while honoring card minima. WorkspaceHost adds the actual restore-button rectangle, preventing it from covering card utilities. Moving chrome, orientation/popout changes and observed surface resizing invalidate snaps and previews. Browser zoom uses the same observed layout-size path; no separate renderer or static reserved strip was introduced.
- **Preview and top snapping:** card preview and drop call the same item-specific target calculation, including minimum height and displacement of a previous slot occupant. The top participant rail uses current horizontal gaps and safe margins, then clears chrome vertically when a usable top gap does not exist. Its preview and final footprint share the same helper. Free card positions and opposite resize anchors remain intact; constrained viewport fitting changes width only when ordinary chrome avoidance cannot fit the card.
- **Pomodoro:** Reset sits left of centered digits; Play/Pause and adjacent Settings sit right. On very narrow cards the right-side pair stacks vertically instead of moving beneath the digits. Progress stays below, Skip remains centered and the tally stays quiet. Personal/Shared authority, timer persistence and notifications are unchanged.
- **Tasks:** the entire Up/Down/Delete group appears only on row hover or focus, with reserved width. Text aligns left, actions align right, first Up/last Down remain disabled, and inline editing stays. Touching task text focuses the inline editor and reveals only that row's actions.
- **Address:** one outer compound border and focus ring surround the fixed muted nonselectable prefix and stronger editable slug. A padded gap removes the `/rooms/` collision and inner focus seam. Separate availability, Save/Saved and canonical Copy/Share behavior remain.
- **Friend quick context:** a 300px content-sized card aligns to the selected friend and uses the shared overlay's viewport clamp/vertical flip. A compact avatar with presence accompanies name/status on one line and username immediately below. Invite to uses StudySelect beside a compact Invite action; details is a ghost/menu link. Relationship destruction remains secondary.

### Validation

- **Focused checks:** all 17 distinct browser scenarios have passing evidence after targeted repairs. These include seven new final-polish scenarios covering expressive typography and foreground across three backgrounds, stable scope headers, lateral timer controls, row hover/focus/touch and inline editing, compound focus/slug input, compact anchored friend context and overlay selection, shared hover/disabled menu styling/native escape, live chrome snap movement, matching top/card previews and free positioning. The geometry repair selection passed nine of eleven cases first, then both remaining cases passed in a focused 11.6-second run. Existing resize, rail identity, productivity and workspace cases remain covered.
- **Unit checks:** 229/229 tests across 36 files passed. The focused geometry selection passed 18/18 tests across two files, including current occupied rectangles, available column width and matching preview/drop geometry.
- **One relevant browser regression:** 76 cases across 18 suites ran once: 75 passed and one rapid-chat fixture failed, in 11.6 minutes, with no skips or retries. The fixture pressed Enter while the prior send was refreshing history; it now waits for the existing Send message control to become enabled. That single case passed in a scoped rerun (16.9 seconds overall, 10.4 seconds for the case), retaining height, scroll, IME and authorized-action assertions. All 76 distinct cases therefore have passing evidence across the full run plus the scoped correction; this is not a clean 76/76 full-run result. The failure trace is retained locally. No Chat product source changed and no second full regression was run.
- **Preserved behavior:** the relevant regression covers three-account visibility and privacy, stable room/background/productivity/media DOM and shared host ownership, all eight resize directions and fixed anchors, free positioning and saved layouts, rail/header arrangement, zoom-equivalent reflow, Back history, addresses, reusable/revoked invites and referral attribution, selected-room entry, companions and native context escape. Real-provider playback is not certified by the browser embed probe.
- **Static and build checks:** package/Nuxt typechecks, lint and feature-boundary checks, contract generation consistency, source security and secrets scans passed. The production web build passed. Formatting is checked on the files owned by this pass, and Git whitespace checks pass; the existing oversized historical-capture scan warning is not a secret finding.
- **Visual review:** 18 current screenshots were inspected across the eleven requested surfaces, including bright, dark and complex room backgrounds and the 390px viewport. Captures wait for finite transitions and font loading. See [the final evidence index](../references/mid04a/final-polish/index.md) and its machine-readable `validation.json`.
- **Local development:** only the web image/container was refreshed. Web, API readiness and public provider HTTPS smoke requests returned 200. API, LiveKit, PostgreSQL, proxy and Redis container identities were retained. All 22 development tables retain their full row digests, counts and column projections, including the complete migration ledger; no reset or migration was performed.
- **Preservation:** the pass-start manifest contains 700 files. All 685 protected baseline files match their original SHA-256 hashes; all 279 earlier reference files retain their original bytes after restoring test-overwritten captures. Previous report content is preserved exactly outside this new section. Active coordination, accepted specs/guides, backend and migration sources are unchanged. The evidence manifest records the final checks and screenshot hashes.

No backend, authorization, protocol, schema, dependency, migration, RTC/capture or provider-ownership source changed. Standalone RTC/live-SFU/quality suites and heavy service suites are excluded from this pass. Relevant deterministic media/companion browser cases exercise the shared card host. Validation remains local Chromium with synthetic/deterministic fixtures; it does not certify other browsers, physical devices or real-provider playback.

### Deferred polish

- **DEFERRED NON-BLOCKING POLISH:** at 390px, labels in the existing dock are tightly spaced. Controls remain selectable; typography/spacing refinement belongs to the later final polish milestone.
- **DEFERRED NON-BLOCKING POLISH:** icon-to-label spacing in the compact More menu is tighter than the global context rows. Foreground, hover, hit targets and actions work; this minor spacing difference does not warrant another MID-04A cycle.
- **DEFERRED NON-BLOCKING POLISH:** long invite-room names can wrap to two lines in the compact friend select. The card stays bounded, options overlay and the action remains usable.

**FUNCTIONAL BLOCKER:** none found within the verified scope. The remaining known issues above are **DEFERRED NON-BLOCKING POLISH**. Status remains **COMPLETE — AWAITING_REVIEW**; owner review is the acceptance gate. This final MID-04A implementation pass stops here; MID-05 has not begun.

## Owner QA correction — selected-room visuals, workspace geometry and shared controls (2026-10-02)

This fourth owner correction pass implements the latest thirty-seven-item visual QA brief against the current working tree. MID-04A remains **COMPLETE — AWAITING_REVIEW**. Owner acceptance has not been given and MID-05 has not begun. Earlier sections remain historical evidence; the address, selected-room preload, companion layout and productivity presentation below supersede their earlier descriptions. The required repository specifications and guides were read completely. The v23 living design document is absent; the explicit brief is authoritative as instructed.

### Corrections

- **Address and generated invites (1–5):** the fixed `studyspace.my/rooms/` prefix and editable slug occupy one field. Availability is an informational spinner/check/cross with an explicit accessible name. A separate Save control appears only for a changed available slug; successful save produces muted Saved, and editing clears it. Existing validation, debounce, generation fences and authoritative save remain. Useful errors use anchored feedback. Canonical Copy/Share actions remain below the control without a loose URL row. Generated and reusable invite URLs use readonly, selectable, visually truncated inputs with inline Copy/check and optional native Share. Shared 16px/32px separation distinguishes output from creation and history.
- **Actual selected-room preload (6–8):** safe authorized resolution prepares the selected durable background plus device-local preference/custom asset, waits for image decode and the actual mounted environment, and restores safe local arrangement before releasing the opaque route veil and opening confirmation. One existing RoomShell/composition/environment remains through admission. Pre-entry reads do not persist preferences, acquire presence leases, connect RTC, capture devices or activate media/productivity subscriptions. Confirmation activates the existing owners; decline restores the recorded origin. Canonical invite redemption can reuse its page, so entry also prepares that same scene before activation rather than leaving an unprepared management view.
- **Workspace geometry and atmosphere (9–10, 15, 19–21):** the permanent southeast glyph is removed while all eight cursor/hit regions and fixed opposite anchors remain. Workspace bounds use viewport/safe edges and actual visible header, participant rail, dock and workspace controls, removing the old full-width lower band. Move and resize collide with real rectangles; downward resize shortens only active edges. Dock/rail adoption frees their rectangle immediately. Newly opened camera/video cards avoid chrome before their controls become obstructed. Content-aware snap heights and registered minimum dimensions give timer/tasks/chat real content space; flexible regions reflow before genuine scrolling. The approved uppercase kicker and serif atmosphere default are restored in normal mode, with localized haze, independent rearrangement and existing lifecycle continuity.
- **Tasks and timer composition (11, 16–18):** task text edits in place, with semantic Up/Down/Delete ghost icons, disabled end moves, reserved action space and hover/focus/touch delete discovery. Replacing the task history subscription now detaches its predecessor. Personal/Shared segments contribute through a generic UI header slot to the existing Tasks/Pomodoro toolbar, eliminating duplicate body headings and retaining geometry. Timer digits lead a compact Reset/Play/Settings cluster, and Skip remains centered beneath progress.
- **Menus and companions (12–14):** one shared menu-row primitive gives More, quick/context actions transparent resting rows and restrained hover/focus tint. The companion dock uses compact padding and a measured initial controller size, horizontal when wide and stacked when narrow. The adopted participant rail becomes an available-width responsive grid in its companion; the in-room rail stays unchanged. Existing DOM/video nodes, subscriptions and single RTC/media/capture owner remain. Each card still fills its companion and restores through the existing lifecycle.
- **Popover, dropdown and identity cleanup (22–25):** participant controls use a compact close icon, the shared StudySelect overlay and a compact secondary camera action or camera-off copy. Status, camera/microphone devices and the basic voice preset were the remaining native immersive selectors and now use that same primitive; Room Settings, media, timer, quality, appearance and privacy were audited. Nested Escape closes the top overlay before its parent. The room name is a stronger primary foreground/type hierarchy, with secondary privacy and localized background-aware haze for light/complex environments. Bright, dark and complex backgrounds were reviewed at minimum manual glass without an opaque identity rectangle.
- **Timer settings, sliders and spacing (26–34):** durations align in four columns, then two and one at narrower widths. Auto-start is a compact checkbox row. Existing paused/versioned Personal/Shared authority makes explicit Save appropriate: it remains compact, disabled when unchanged/unavailable/running, with quiet Saved. The running-duration helper stays immediately below duration fields. One shared slider separates a 44px input hit area from its 4px visible track and maps thumb-center travel, endpoints and fill consistently; alert, glass and six media sliders retain their numeric ranges. Shared 4/8/12/16/24/32px tokens and field/section stacks improve timer alerts, advanced settings, appearance, configuration/invites, participant popovers, media, account and context sheets. The accepted glass alpha mapping, 0% bokeh, 100%, Auto, persistence, theme/accessibility resolution and opaque veil are unchanged.

### Validation and preserved boundaries

- **Focused browser evidence:** the initial new checks found nested Escape dismissing both select and parent; the shared overlay stack now handles only the top panel. The 28-case focused set initially passed 22 and found six issues: newly opened camera/video controls beneath the header, obsolete loose-link selectors, a settings test assuming Save dismissed the dialog, and identity CSS accidentally placed inside the external-style block. Targeted fixes and an 11/11 repair selection establish passing evidence for all 28 distinct cases. The social status-selector correction passes separately. All six new visual QA cases pass, including held selected-image preload, inert admission and node identity, independent slug availability/Save, readonly invite geometry, inline Tasks/header scopes, timer reflow, exact slider travel, full lower drag/resize, freed dock space and responsive participant adoption.
- **One final browser regression:** the relevant 73-case run across eighteen suites completed with **69 passes and four failures in 10.4 minutes**, with no skips or retries. It exposed a canonical-invite scene preparation path and three test assumptions: cumulative corner expansion reached the enlarged header, all four default cards now fit at 900px, and a five-second playback-progress threshold had a five-second polling deadline. The first 14-case correction selection passed 11 and exposed the remaining same-page invite navigation suspension and the guide test's assumption of a zero starting x despite chrome avoidance. Entry now avoids that redundant navigation and uses the common preparation path. Geometry tests use a collision-free location, verify hit testing and relative movement, and preserve their exact anchor/persistence assertions; playback gets a ten-second deadline without weakening the progress threshold. The final **7/7 selection passes in 58.7 seconds**, covering canonical/legacy invite redemption, same-shell pre-entry, late-entry cancellation, every resize direction and workspace persistence. All **73 distinct scenarios have passing evidence across the full run and scoped corrections**; the full run itself was not a clean 73/73. No second full browser chain was run. Unrelated standalone live/SFU/quality and heavy service suites were excluded.
- **Unit/static/build:** **226/226 cases across 36 files** pass, including delayed image decode, readonly pre-entry preferences, one activated background subscription, content minima and free workspace bounds. Final owned-file formatting, lint/architecture boundaries, package/application typecheck, contract parity, source/secrets scans, production API/web build and Git whitespace checks pass. The inherited `.env.example` CRLF warning remains; no environment file was changed.

- **Development and integrity:** only the web image/container was rebuilt and refreshed. HTTPS web, API readiness and sign-in-provider checks return 200 at `https://localhost:8443`. All **22 development table counts, complete row digests and column projections match the fresh pass-start snapshot**, including the entire migration ledger and existing archive migration. No reset, migration, API/SFU restart or volume replacement occurred. All **650 protected files from the 683-file baseline** match their starting hashes; all **263 historical reference files** are preserved byte-for-byte after restoring overwritten browser captures. Dependencies, runtime configuration, approved glass mapping, accepted docs and later-phase specs are preserved.

Fourteen new captures were inspected and indexed in the [visual QA evidence](../references/mid04a/visual-qa/index.md); its `validation.json` records capture hashes and final checks. Logs, failed-run traces, owned-file inventory and preservation snapshots are retained under `.local/validation/mid04a-visual-qa/`. Removing only this section reproduces the preceding report content. The inherited working tree, accepted phase documentation, coordination status and previous evidence remain intact.

No backend, contract, schema, dependency or migration changes were introduced in this pass. Authorization, privacy-filtered application presence, invite encryption/referral/revocation/archive authority, stale-background fencing and one RTC/media/capture owner remain. Local Chromium and deterministic provider/synthetic media coverage establish implementation behavior; they do not certify other browsers, physical capture devices or real YouTube playback. Native popup/PiP policy, window chrome, clipboard permission and browser throttling remain platform-controlled. Heavy unrelated service/live-SFU chains were not repeated. These are implementation QA results, not owner acceptance. Stop at **COMPLETE — AWAITING_REVIEW**; MID-05 requires explicit owner authorization.

## Owner follow-up — doorway admission, context actions and companion windows (2026-10-02)

This third follow-up implements the twenty-nine corrections in the latest owner brief from the current working tree. MID-04A remains **COMPLETE — AWAITING_REVIEW**; owner acceptance has not been given and MID-05 has not begun. Earlier sections below are historical evidence. The room-first entry flow and fixed linked copy here supersede the earlier originating-page sheet and timed rotation.

### Corrections and ownership

- **Inline rearrangement:** reserved grips reveal through hover or keyboard focus inside the Workspace pill, grouped header, participant descriptor, dock, atmosphere row and tile headers. Opacity/translation changes do not change object geometry. Normal mode hides grips; grab/grabbing and existing arrow-key movement remain. The dock uses one aligned horizontal row, and the atmosphere receives pointer access during rearrangement.
- **Chat:** history is the flexible, independently scrolling region; the bottom composer has a reserved height and Chat resizes clamp at 200px. Send is an integrated 44px icon button. Enter sends trimmed nonempty text; Shift+Enter adds a newline and composition/key-code guards avoid accidental IME submission. Authorized deletion is an edge-positioned trash icon, revealed on hover/focus and visible on touch. The server's `canDelete` projection and mutation authorization still determine access. Pagination replaces its previous history subscription rather than accumulating listeners.
- **Fractional resize correction:** at fractional snap positions, subtracting anchored coordinates could produce a size infinitesimally below the registered minimum and make the existing layout validator reject the resize. The shared edge calculation now bounds its resulting dimensions at that same minimum, preserving the opposite anchors and per-edge behavior. A regression exercises all four corner combinations through the actual Workspace validator.
- **Address and invites:** availability validates in the background through the existing authoritative schema and endpoint. A right-edge loader/check/cross replaces persistent availability text and the separate save button. Clicking an available check saves; a muted Saved state retains the populated field, and editing returns to validation. Useful error help uses the shared anchored overlay. Invite limits share a balanced desktop/tablet row and stack on narrow screens; shared spacing separates creation from history. Revoked invites expose a 44px destructive trash target and a compact confirmation.
- **Revoked invite removal:** the new owner-authorized `rooms.invite-delete` operation archives only already-revoked invites belonging to the managed room. Active, foreign-room and nonowner attempts are denied; repeated archive is idempotent. Archived rows disappear from management, retain the invalid token hash/revocation marker and clear encrypted token material. Existing join and referral links/events remain intact. Migration `rooms/0005_invite_archive` adds the archive timestamp, a revoked-only constraint and a listing index; previous migrations are unchanged.
- **Shared buttons:** context-pane action links use inline flex, centered labels/icons, controlled line height and symmetric padding. The conflicting page-level block display is removed. All my rooms and the existing shared action classes use the common primitive.
- **Safe Back:** one app-root history records known, authenticated in-app visits with their query and scroll state. Back/Forward select recorded visits, never an arbitrary referrer or external browser entry. Direct loads have no Back; account changes reset history. The 44px circle appears immediately left of the wordmark, whose short 52px spatial transition leaves the brand-row footprint fixed. Reduced motion uses the existing global override. Declining entry returns through the recorded origin where available.
- **Linked entry bundles:** four authored question/positive/negative bundles each include a coherent secondary reconsideration bundle. One bundle remains fixed throughout an opening and advances on the next opening without immediate repetition. Accessible actions remain Join room, Cancel room entry and Return to room entry. There are no rotation timers.
- **Room-first pre-entry:** card actions resolve safe metadata, navigate to the canonical room and render the existing RoomShell/background preview before the glass/scrim decision opens. The preview is inert, has no participant lease or feature/RTC/media/capture activation, and must signal that its shell is prepared before confirmation can commit. Decline restores the origin without admission; late resolution is fenced by account, generation and origin route. Server join remains authoritative if access changes. Its existing account/room-bound, one-use admission handoff activates the same already-rendered shell and normal single lifecycle. Direct and bearer-invite entry retain their existing admission paths.
- **Shared context actions:** one typed app-root provider/host owns context events for the main document and companions. Cards, friend rows/context controls, the room canvas, rail/dock and workspace cards contribute their permitted descriptors. Page Back/Forward, appearance, links/share, room open/new-tab/settings/invite, friend invite/copy/remove/block, room arrangement/settings/background/media and tile minimize/popout/front/reset/hide use existing owners and endpoints. Text fields preserve selection for Cut/Copy/Paste/Select all; readonly/unsupported clipboard operations are disabled, and native numeric/date/email editors retain their browser handling.
- **Native escape and accessibility:** the first supported context event opens a glass ARIA menu and is canceled. A second while open closes it without canceling that event, allowing the browser menu. Pointer clamping, arrows/Home/End, Enter/Space, Escape, outside dismissal, Shift+F10, focus restoration and destructive styling are shared. Clipboard/platform failures produce an actionable status message.
- **Shared host compatibility:** context contributions explicitly import their Vue helpers so the existing standalone RTC composition can use the same room hosts outside Nuxt. A missing optional context provider leaves feature controls usable. Participant anchors track selection before the rail first mounts, then resolve the selected button's current document; companion participant controls open and restore focus in that companion rather than the owner document.
- **Individual companions:** Pop out all synchronously reserves separate windows for each visible workspace card, participant rail, room-controls dock and visible camera through the existing expansion path. A stable per-element handle prevents duplicate windows; each room owner has a unique window namespace. Closing one restores only that view; Restore all recovers every companion. Blocked reservations leave views in the room and report their names. Minimizing a popped tool restores it to the normal room tray rather than leaving a blank companion.
- **Fluid presentation:** companion roots fill their actual viewport, with compact padding and container-based rail/dock layouts. Tall rails are vertical and wide rails horizontal; all six existing dock controls act on opener state. Tile content fills available space and Chat retains its composer. Existing application styles are copied from already-loaded stylesheets with their nonce and resolved asset URLs, so layout does not depend on refetching room CSS. Alternate-controller content scrolls within its available area. Transient popup sizes never update normal tile or chrome geometry.
- **Same media owner:** camera companions adopt the existing renderer and media element/stream. Visibility and size follow its owning document while the same provider/session continues to control reception. Authorized participant name, microphone and speaking overlays remain available; local tracks resolve the existing self participant rather than comparing the account UUID with the self key. The YouTube iframe/provider stays visibly in the owner room; its separate companion is the existing alternate controller, which uses the same playback model and creates no iframe, audio extraction or rebroadcast. Both SPA room unmount and owner-page `pagehide` close companion windows and detach their listeners/observers.
- **Glass range accepted and locked:** the owner's latest approval supersedes historical tuning requirements. This pass does not change the slider mapping, its 0% bokeh/high-transparency appearance, 100% endpoint, Auto, persistence, theme resolution, accessibility overrides or opaque route-loading veil. Endpoint/intermediate browser regression covers both themes; protected glass files are checked against the pre-pass hashes.

### Validation and evidence

- **Unit and backend:** 224 unit/integration cases across 36 files passed. The focused identity/rooms service suite passed 28 cases, including nonowner/foreign-room/active-invite denial, idempotent revoked archival, invalid bearer tokens, cleared ciphertext and unchanged referral/join attribution. No unrelated heavy service chain was repeated.
- **Browser regression:** one complete 73-case run finished with 68 passes and five failures (15.4 minutes). These exposed missing standalone imports for the new context helpers and an IndexedDB test that reloaded before its hidden-panel state was committed. A 17-case focused correction run passed 13 and exposed four remaining failures: one local-caption assertion assumed the rail's “You” display label instead of the authorized name, and three camera cases found a participant anchor cached before the rail mounted. After correcting the assertion and tracking the anchor dependency, the final six-case selection passed all six (43.3 seconds), covering each remaining failure, companion participant controls/focus, local/remote renderer identity, advancing remote frames, restore/blocked recovery, owner navigation cleanup, synthetic mic/camera/screen behavior and live social participant actions. All 73 distinct browser scenarios have passing evidence across the complete run and focused corrections; the complete run itself was not a clean 73-pass run, and no second full browser chain was executed.
- **Preserved behavior:** the complete run retained three-account room visibility, external privacy filtering, room background and feature-node stability, reconnect/leave behavior, native individual Document PiP, existing YouTube/controller ownership, actual LiveKit publishers and independent same-account tabs, access revocation, source grants, Stage A quality, responsive layouts, opaque route loading, appearance persistence and accessibility overrides.
- **Static/build checks:** owned source/test formatting, lint and architecture boundaries, application/package typecheck, contract parity, source/secrets scans, production API/web build and Git diff whitespace checking passed. The last build includes the standalone helper imports, tracked participant anchor and local caption correction. Dependencies, accepted migrations, runtime configuration and the approved glass mapping were preserved.
- **Visual evidence:** 13 new PNG captures were inspected. The [evidence index](../references/mid04a/companion-review/index.md) records dimensions, scenarios and platform limits; `docs/references/mid04a/companion-review/validation.json` records counts, capture hashes and preservation results. Bulk-window images use bounded direct Chromium surface capture because normal Playwright page screenshot preparation stalled after fonts loaded; no images or playback outcomes were fabricated. Admission and direct-navigation captures wait for the actual sheet/loading state to settle.
- **Development review stack:** only API/web/migration images were rebuilt, the archive migration was applied, and API/web were refreshed. PostgreSQL, Redis, LiveKit and proxy containers/volumes were retained. HTTPS web, readiness and provider smoke checks return 200. Exactly one `rooms/0005_invite_archive` ledger row matches the source checksum, previous ledger rows match their snapshot, and existing invites remain unarchived. All 22 original table counts and column projections are preserved; 20 original table digests match. `core.sessions` and `rooms.memberships` digests differ from the morning snapshot. Since that snapshot stores whole-row digests rather than prior values, exact changed values cannot be reconstructed; complete row equality is not claimed. No data reset or row-restoration operation was performed.
- **Integrity and review gate:** all 625 protected files from the 657-file turn-start baseline match their hashes, including 248 historical reference files. Eighty-seven overwritten historical captures were restored from the pre-pass backup while retaining the new companion-review evidence. Removing only this new section reproduces the previous report content hash. The inherited working tree, earlier review sections, ACTIVE_PHASE, PHASE_HISTORY and later-phase specs remain intact. MID-04A is **COMPLETE — AWAITING_REVIEW**; MID-05 has not begun.

Local execution records are under `.local/validation/mid04a-companion-review/`: `browser-regression.log` and its retained traces, `focused-final-corrections.log`, `focused-camera-and-context.log`, final unit/static/build logs, `integrity.json`, development inventory/migration checks and HTTPS smoke evidence.

### Browser and platform limits

Companions require the owning room/tab to remain open. Browser popup policy may allow only some requested windows after one gesture; blocked items stay available and the UI names them. Native Document Picture-in-Picture is used when available for an individual view; bulk presentation uses separate utility windows because native PiP does not provide independent arbitrary companion windows. Browser chrome, minimum outer window dimensions, clipboard permission and native dialogs remain platform-controlled. Numeric/date/email editors keep their native context menu when their selection APIs are unavailable, while supported text editors provide the shared menu and second-click escape.

Media evidence uses Chromium, the local LiveKit SFU and explicit synthetic browser capture; it does not certify physical camera hardware, other browsers or operating-system screen pickers. YouTube evidence uses the deterministic provider fixture and confirms application ownership/controller behavior, not real provider playback. Browsers/providers can throttle or suspend background tabs; the application does not bypass those policies.

## Owner follow-up — rail layout and focused room entry (2026-10-02)

This second follow-up implements the sixteen corrections in the owner's latest brief against the current working tree. MID-04A remains **COMPLETE — AWAITING_REVIEW**. The earlier follow-up and initial delivery evidence below remain historical records; MID-05 has not begun.

### Interaction and visual corrections

- **Compact rail drag:** grabbing the existing rail grip collapses the same rail into a 220×56 horizontal descriptor containing its grip and “Participant Rail” label. The descriptor follows the pointer, with a fluid size transition and a reduced-motion fallback. Participant elements remain mounted and temporarily inert/hidden; release expands the same rail into its committed orientation. Cancellation retains its previous placement. No renderer, participant subscription or room owner is recreated.
- **Localized previews and controls:** rail previews match the proposed final footprint and appear only near a valid edge. Workspace snapping now shows one nearest target instead of the previous grid of oversized dotted targets. Rails, the indivisible header, dock, workspace cards and atmosphere controls share a restrained solid outline, grip treatment and active-state emphasis. The detached dotted box came from a grip around the nonvisual remote-audio host: its grip, outline and layout obstacle are removed, while its existing audio renderers remain mounted.
- **Bottom rail and dock:** the horizontal rail sizes to its participants within the available width and ends at the usable bottom safe edge. Safe-area padding, measured header/dock sizes and actual rail/workspace rectangles determine collision placement. The dock takes the nearest usable horizontal segment, or moves above the rail when a narrow viewport has no segment. Preview geometry anticipates the expanded rail during a drag. Derived displacement never overwrites the user's requested dock position.
- **Free horizontal header:** Back, room identity and Invite remain one horizontal object. Pointer movement permits free x placement and magnetizes near each of four named anchors; y remains fixed. Device persistence distinguishes a free `headerX` from the named slot, with old records defaulting safely. Arrow keys move freely; Alt+Left/Right steps between named anchors. Rail collisions use the actual header rectangle.
- **Copy and Share:** the shared CompactLink component uses the existing Lucide Copy and Share2 icons with visible labels and padded 44px targets. Room/invite links retain full-value clipboard and native-share behavior, including keyboard access. No dependency was added.
- **Ambient app shell:** one shared blue bloom composition covers Home, My Rooms, Discover, Friends, Account & Devices, configuration and other authenticated app-shell pages. Route composition varies the bloom mildly, with coherent light/dark palettes, smooth falloff and no arch artwork. Accessibility contrast overrides and the opaque loading veil remain intact.
- **Focused room entry:** RoomCard consumers select a room and open a compact, dimmed, centered decision sheet on their current page. Explicit settings gears still route to configuration. Privacy-filtered friend join actions use the same sheet after a read-only room resolution. The sheet presents name, privacy and member count; only its primary Open room action invokes the existing server join endpoint.
- **Rotating prompts and reconsideration:** short deterministic prompts rotate every ten seconds without immediate repetition. Reserved prompt/error space holds the dialog geometry stable. Reduced motion disables timed rotation. Maybe later opens a second compact confirmation with its own prompt inventory; Back to room returns to the first step, while Leave for now, Escape and outside dismissal exit without admission. Rotation is confined to this decision sheet.

The existing server authorization remains authoritative. A successful committed join creates an in-memory, account/room-bound, single-use handoff with a fifteen-second lifetime; the room page consumes it to avoid a duplicate join. Route transition begins only after the server succeeds. Direct/invite entry keeps its existing admission path, and RTC/media/capture starts through the existing room lifecycle after navigation. A selected public card becoming private before commit is denied by the server and leaves the decision on the original page.

### Focused validation and regression

The focused unit run passes **18/18 cases in two files**, covering magnetic/free persistence, safe bounds, rectangle displacement, narrow stacking and existing room stability. All seven distinct focused browser cases pass across the focused and corrective runs. They cover all four rail edges, descriptor pointer following, retained DOM/subscription identity, preview/drop agreement, bottom safe area and narrow dock displacement; four header magnets and exact free-position reload; entry rotation, secondary confirmation, cancellation, held server response and one committed join/RTC admission; a stale-public-to-private authorization denial; icons, keyboard actions and six app routes at desktop/narrow widths in both themes; shared RoomCard behavior and settings navigation; and existing stability coverage.

Two initial focused assertions needed synchronization/targeting corrections: the entry test measured the dialog during its opening animation, and the Home test matched duplicate room cards across sections. Both failures remain in their original logs; the corrections wait for the opening transform to settle and target the owned-room section respectively. These changes did not alter application behavior.

The requested full browser regression ran **once**, finishing **63/64 passing in 10.5 minutes** with no skips or retries. Its sole failure was the historical glass-alpha test's broad `.ui-settings-sheet` selector: the new closed entry dialog and open Appearance dialog both matched it. The test now targets `.ui-settings-sheet[open]`; its focused correction run passes **1/1**, including all ten manual-fill/theme combinations and both Auto checks. No application or material behavior changed for this correction. All **64 distinct browser cases pass** across the full and corrective runs. This is composite coverage, not a clean 64/64 full-run claim. The failed full log is retained.

Final lint/architecture checks and typecheck pass, as do the production web build and web-only Docker refresh. Web, readiness and sign-in-provider requests return 200 at `https://localhost:8443`. All 22 development tables, including the migration ledger, match their fresh pre-refresh counts and full-row digests. The 600 protected files match their starting hashes, and all 211 historical reference files are restored byte-for-byte. No reset, migration, API/SFU restart or volume replacement occurred. Root formatting reports only the two inherited MID-01 reference exceptions recorded below; changed source/tests/docs pass formatting. `git diff --check` passes with the inherited `.env.example` line-ending warning.

Evidence logs are retained under `.local/validation/mid04a-layout-entry/`: `focused-unit.log`, `focused-browser.log`, `entry-correction-browser.log`, `final-focused-browser.log`, `home-card-correction-browser.log`, `full-browser.log`, `regression-correction-browser.log`, `build.log`, `post-regression-{lint,typecheck,format}.log`, `web-refresh.log`, `dev-data-preservation.log`, `dev-https-smoke.json`, `changed-files.json` and `final-integrity.json`.

Dedicated visual evidence contains 36 captures in `docs/references/mid04a/layout-entry/`, indexed by its README. It covers descriptor/preview states at every edge, narrow bottom stacking, header anchors, both decision steps, and six routes × two widths × two themes. These are local Chromium and synthetic interaction checks, with existing local-SFU cases included in the requested full browser suite; they do not establish cross-browser or hardware coverage. Historical references are restored from their pre-patch copies after browser validation.

### Follow-up boundaries and source availability

This patch starts from `.local/validation/mid04a-layout-entry/baseline.json`, not Git HEAD. Source changes are confined to app-shell/room UI, UI geometry, the entry decision consumer and existing UI icon exports. Tests, this report and dedicated new evidence accompany them. API/contracts, database authority, feature packages, core/RTC/media providers, migrations, dependencies and coordination status are preserved. No unrelated service suite or standalone heavy RTC/media regression is rerun.

The required repository phase/guidance documents were read. `STUDY_SPACE_LIVING_DESIGN_SPEC_updated_v3.md` was not found in the repository, supplied attachments or searched local document locations. Its location was requested from the owner; this patch follows the explicit sixteen-item brief and does not claim verification against the unavailable v3 document.

The exact 57-file inventory is retained in `changed-files.json`: 14 source files, five test files, this report, the evidence index and 36 dedicated screenshots. The non-image changes are:

```text
apps/web/app/app.vue
apps/web/app/components/CompactLink.vue
apps/web/app/components/FriendContext.vue
apps/web/app/components/RoomCard.vue
apps/web/app/components/RoomEntryConfirmation.vue
apps/web/app/components/RoomListing.vue
apps/web/app/components/RoomPage.vue
apps/web/app/components/room/RoomShell.vue
apps/web/app/components/room/WorkspaceHost.vue
apps/web/app/composables/useRoomEntry.ts
apps/web/app/lib/room-arrangement-layout.ts
apps/web/app/lib/room-arrangement.ts
apps/web/app/pages/friends.vue
docs/references/mid04a/layout-entry/README.md
docs/reports/MID_04A_OWNER_REVIEW_CORRECTIONS_AND_ROOM_STABILITY_REPORT.md
packages/ui/src/index.ts
tests/browser/layout-entry-followup.spec.ts
tests/browser/room-browse.spec.ts
tests/browser/room-stability.spec.ts
tests/browser/visual-foundation.spec.ts
tests/unit/room-arrangement-layout.test.ts
```

Work stops at **COMPLETE — AWAITING_REVIEW**. Owner acceptance and final visual approval remain pending; this follow-up does not authorize MID-05.

## Owner QA Follow-up

Owner QA confirmed three-account room visibility, stable wallpaper/timer/chat/YouTube identity, fixed-anchor resizing, individual/all popouts, simplified URL playback, custom slugs and overlay dropdowns. This follow-up preserves those passes and corrects only the six remaining review items. MID-04A remains COMPLETE — AWAITING_REVIEW; owner acceptance is pending.

### Defects and corrections

- **Resize affordances:** a higher-specificity legacy southeast style overrode the directional handles and enlarged their hit areas. The shared workspace now uses 5px side strips and 10px corner targets, with distinct `ew-resize`, `ns-resize`, `nwse-resize` and `nesw-resize` cursors. Header actions sit outside those targets. The accepted fixed-anchor geometry is unchanged.
- **Participant rail:** the same rail DOM follows pointer movement within safe bounds. A single restrained edge preview appears only within 48px of a valid edge. Drop commits the requested edge, transitions into vertical left/right or horizontal top/bottom orientation, and persists through the existing device preference. Collision placement keeps vertical rail grips below overlapping workspace/audio chrome. Cancellation, keyboard placement, reduced motion and viewport recovery remain available; dragging does not recreate participants or subscriptions.
- **Media presentation:** minimizing or closing the YouTube workspace card collapses its existing iframe into a visible 280×286 player with an **Open player** action. It retains the full-size layout for restoration and does not issue an authoritative pause, recreate the provider or reset position. Explicit Pause and removing current media retain their control-plane behavior. Two clients stay synchronized across collapse/restore.
- **Glass:** manual opacity reaches fallback surface/elevated tokens, nested materials, segmented containers, sheets and room materials. At 0% each fill contributes zero alpha; at 100% it uses the opaque material color. Text, borders, shadows, blur and structurally required scrims retain their separate roles. Auto, persistence, both themes, contrast/transparency accessibility overrides and the opaque route loader remain intact. The final production minimum is still undecided.
- **Control alignment:** My Rooms and Discover group Sort/Grid and filters/Members coherently, use 44px controls and consistent label spacing, and wrap those groups without horizontal overflow. Home/Friends compact actions use the existing padded ghost treatment; Home's add action now shares its inline-flex alignment.
- **Invites:** no production invite or schema change was needed. Browser coverage creates a new encrypted invite, verifies its full redisplay after reload and active state, and separately exercises a genuine hash-only fixture's explanatory fallback. The legacy fixture changes only its isolated row in the guarded test database. Tracker responses omit ciphertext and token hashes. Unrecoverable tokens are not reconstructed.

YouTube requires a displayed player and prohibits background playback in a player the user cannot view. The collapsed player remains visible and exceeds the 200×200 minimum; this correction therefore does not implement an invisible audio-only YouTube player. Document/tab hiding can still suspend the local provider under its existing policy handling. No audio extraction/rebroadcast or second provider was introduced. See [YouTube developer policies, III.I.9](https://developers.google.com/youtube/terms/developer-policies) and [required minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality).

### Follow-up validation

All eight distinct focused browser cases pass across the recorded focused/correction runs: the six new follow-up cases plus existing media synchronization and glass persistence/loader coverage. The focused stability/media unit run passes 13 cases in two files. Earlier failures and corrective runs remain in the logs rather than being rewritten as clean runs.

Visual verification goes beyond preference variables: computed outer/inner/fallback/pseudo material layers are recorded, and screenshot pixels over a constant RGB(40,70,110) backdrop are compared with expected composited colors at 0/25/50/75/100 in both themes. All ten comparisons pass, including nested surfaces; at 0% both sampled surfaces match the backdrop exactly. Actual Account/room and desktop/tablet/narrow browse screenshots supplement the isolated material probes. Diagnostic probes temporarily remove blur/border/shadow only to measure fill; production materials retain those effects.

The requested full browser regression ran once and finished **56/59**. Its three failures are retained in `full-browser.log`. The browse test submitted its next search before Clear filters finished; it now waits for that response. The workspace test measured a moving corner using the old target offsets and read an animated computed width; it now waits for the handle to settle, drags its center and waits for the exact inline width to commit. The same-account two-tab camera test queried its audience before the viewer's RTC admission completed; it now awaits successful admission for each tab. These are test synchronization/targeting corrections; browse authority, layout persistence and RTC services were not changed. The focused regression correction run passed browse and camera (2/3); the final workspace run passed both the repaired persistence case and the strengthened all-eight-direction case (2/2). All **59 distinct browser cases** now pass across the full and focused runs. This is composite coverage, not a clean 59/59 full-run claim.

The real YouTube probe recorded `minimizedAdvanced: true`, `sameIframe: true`, state `playing`, and position **19.390 seconds** after collapse/restoration. Provider 401/aborted requests and picture-in-picture policy warnings are retained. This is bounded local playback evidence, not a guarantee across providers, networks or browsers.

Final lint/architecture checks, typecheck and the production web build pass. Formatting has only the two inherited MID-01 reference exceptions recorded in the initial validation section; the follow-up source/tests/docs pass. Only the web container was rebuilt/refreshed. Web, readiness and sign-in-provider requests return 200 at `https://localhost:8443`. All 22 development tables, including the migration ledger, match their pre-refresh row counts and full-row digests. The 288 protected source/coordination/historical-reference files match their starting hashes. No reset, migration or volume replacement occurred.

Follow-up evidence includes `focused-unit.log`, the focused/correction browser logs, `full-browser.log`, `regression-corrections-browser.log`, `final-workspace-browser.log`, `material-layers.json`, `fill-pixel-verification.json`, `real-youtube-result.json`, `post-regression-{lint,typecheck,format}.log`, `web-refresh.log`, `dev-data-preservation.log`, `dev-https-smoke.json` and `final-integrity.json`. Diagnostic persistence runs remain recorded as failures; no case was skipped.

Dedicated evidence is indexed in `docs/references/mid04a/owner-qa/README.md`; detailed logs, computed layers, pixel comparisons, baseline hashes and integrity results are under `.local/validation/mid04a-owner-qa/`. Initial MID-04A screenshot evidence is restored from its pre-follow-up copy after browser validation. This follow-up does not alter migrations, API/contracts, database authority, RTC services, dependencies or accepted room-state/resize models, and does not rerun unrelated service suites. The requested full browser regression includes its existing real local-SFU cases.

### Follow-up file boundary

The starting point for this follow-up is `.local/validation/mid04a-owner-qa/baseline.json`, rather than Git HEAD or the earlier MID-04 baseline. The 57 changes comprise 12 source files, five browser-test files, this report, the new evidence index and 38 dedicated screenshots. The exact inventory is retained in `changed-files.json`; original MID-04A screenshots are preserved.

```text
apps/web/app/components/RoomListing.vue
apps/web/app/components/backgrounds/BackgroundSelector.vue
apps/web/app/components/media/RoomVideo.vue
apps/web/app/components/room/RoomShell.vue
apps/web/app/components/room/WorkspaceHost.vue
apps/web/app/pages/index.vue
apps/web/app/room/room-media.ts
apps/web/app/room/room.css
docs/references/mid04a/owner-qa/README.md
docs/reports/MID_04A_OWNER_REVIEW_CORRECTIONS_AND_ROOM_STABILITY_REPORT.md
packages/feature-sdk/src/foundation.ts
packages/ui/src/index.ts
packages/ui/src/styles/primitives.css
packages/ui/src/styles/tokens.css
tests/browser/owner-qa-followup.spec.ts
tests/browser/room-browse.spec.ts
tests/browser/room-media.spec.ts
tests/browser/room-workspace.spec.ts
tests/browser/rtc-live.spec.ts
```

## Baseline and findings

The initial file hashes are retained in `.local/validation/mid04a/baseline.json`. Existing uncommitted changes and historical reports were preserved.

- Three separate accounts with external online/room/study/join disclosure disabled each saw only themselves. The browser baseline expected three active occupants and failed with one. In-room occupancy incorrectly reused external disclosure filtering.
- A transient `RATE_LIMITED` snapshot refresh invoked feature clear handlers. This could remove timer/chat/media state without invalidating room membership. New subscriptions also cleared their predecessor indiscriminately.
- Background snapshots lacked a version fence, and temporary transport loss removed the accepted room asset. An older snapshot could roll back a newly accepted wallpaper.
- A deterministic paused-authority/provider scenario repeatedly sought to zero after native playback reached three seconds. The baseline demonstrates reconciliation behavior, not a full live YouTube reproduction.
- The southeast boundary resize grew the rectangle and then clamped its origin, moving the opposite anchor. All eight edges/corners now derive geometry from the initial gesture rectangle.
- The short baseline retained the room, workspace and feature DOM nodes. A whole-room remount was not reproduced in that baseline; the confirmed causes above concern state clearing, stale snapshots and renderer lifecycle.

Baseline evidence: `baseline-unit.log`, `baseline-browser.log`, `media-loop-baseline.log` under `.local/validation/mid04a/`.

## Implementation

Shared primitives now provide top-layer anchored selects and contextual overlays, viewport flipping, outside/Escape dismissal and focus restoration. Glass fill maps 0–100% directly to manual opacity using the existing device preference/SSR mirror; Auto remains explicit. Accessibility contrast preferences take priority.

The shared wordmark, Home headline component, contextual friend actions, unified name/username search with Global/Met scopes, Discover glow/grouped controls, dense Account sections, Account-only blocked list and compact username validation address the non-room review. The headline inventory contains only the existing owner-approved phrase.

Rooms retain internal UUID authority and gain collision-checked random 12-hex public addresses plus normalized, unique, reserved-name-protected owner slugs. Study and management routes are separate. Compact link rows copy the full value. Active invite redisplay uses AES-256-GCM with an external persistent key and invite-bound authenticated data; hashes remain the redemption lookup. Historical hash-only invites cannot be reconstructed. Tracker output contains creator, creation/expiry, state, uses, joins and aggregate signup attribution; secrets and hashes are excluded.

The referral backbone stores bounded link metadata and deduplicated landing, first free signup and internal future conversion events. Attribution never grants room membership or changes authorization. No payments or public conversion endpoint were added.

Authorized room occupancy now projects active membership leases independently of external disclosure, with block filtering intact. Transient transport failures retain accepted views; authorization failures clear them. Snapshot replacement is generation-fenced, subscriptions are retired explicitly, and background/media snapshots reject older versions.

Room arrangement uses one pointer lifecycle for header, four-edge participant rail, dock, workspace controls, audio status, atmosphere and cards. Header uses four horizontal anchors. Persisted requested positions are bounded; atmosphere collision placement is derived rather than saved as an accumulating offset. Reset/Done recover the layout. Minimized productivity cards retain their component state and restore through the top-right icon capsule.

Popouts use Document Picture-in-Picture where available, with a browser utility-window fallback. Ordinary cards transfer their existing DOM and keep transports in the opener. YouTube opens an alternate controller using the existing media model; its iframe stays in the room because cross-document adoption can reload the player. Closing restores the tool. No new media/capture/RTC owner is created by opening a popout.

Tasks use compact scope controls and inline checkmark creation. Pomodoro keeps Reset, timer, Play/Pause, cog, progress and Skip in its live view; richer duration/cycle/auto-start/display/notification/sound settings live in a sheet. Duration and segment behavior remain authoritative; display and alerts are device-local. Completed focus sessions are projected deterministically.

Media opens a compact dock card. A controller's URL/Play intent atomically enqueues and starts shared playback, then mounts one local player. Browser blocking exposes one Play fallback. Provider status details are in advanced diagnostics. Paused-authority polling does not repeatedly seek; native playback events reconcile through the existing controller permission.

## Validation (initial MID-04A delivery)

The complete regression chain ran once after the implementation stabilized. It passed 214 unit/integration/security/architecture cases in 34 files and 81 service cases in six files. The full browser run passed 43 of 52 cases; its nine failures remain recorded. Focused corrections then covered all nine failed cases, a new canonical-invite signup/join case, and expanded glass levels. Eight of eleven passed on the first correction run; three final assertion fixes passed 3/3. Across the full run and these focused corrections, all 53 distinct browser cases pass. This is composite coverage, not a claim that the initial full browser run was clean.

The final browser corrections addressed actual login-glow horizontal overflow and a timer progress line box that placed Skip inside the south resize hit area. Other assertions were updated for automatic normal-route admission, short public addresses/canonical invite links, the overlay select's button semantics, and combined friend identity/status headings. The new canonical-invite attribution check waits for room admission rather than only the route URL; it verifies exactly one signup and one successful join, stripped query history and no local/session bearer store.

Lint, typecheck, generated contract checks, source-security checks, secret scan, dependency high-severity gate and production API/web builds pass. The corrected final web build also passes lint/typecheck. Formatting retains only two inherited historical reference exceptions: `docs/references/mid01/corrections-2026-09-20/layout-matrix.json` and `ready-reveal.json`; those accepted evidence files were not rewritten.

Relevant accepted RTC/SFU/media groups were included: real authenticated forwarding, independent browser-tab publications, block revocation, hostile/tampered/expired admission rejection, orphan credential sweeps, permission denial/cancellation without retry loops, disabled-authority fail-closed behavior, quality persistence/forwarding, camera renderer movement, screen share and mic transport. Capture inputs are synthetic browser sources through the real local SFU, not hardware-device certification.

The media checks cover deterministic pause/seek/resume, controller changes, late join, local mix and one renderer. A real YouTube probe remained playing at 13.678 seconds, beyond the reported short-loop interval; recorded provider 401/aborted requests and picture-in-picture policy warnings remain in evidence. This is bounded local evidence, not a universal provider/network guarantee.

Glass tests verify exact alpha at 0/25/50/75/100 in both themes, Auto recovery and opaque route preparation. Room tests cover three-account visibility, lease-based leave/reconnect without duplicate participants, all eight resize anchors, four header anchors, rail orientation, atmosphere collision, responsive/zoom recovery, keyboard/focus/dropdown no-reflow, persistent appearance, native and fallback popouts, and stable shell/workspace/timer/chat/background/iframe identity under traffic and reconnect.

Docker checks pass 2/2 against the configured API and pinned local SFU/proxy. Total distinct regression coverage is 350 passing cases: 214 unit/integration/security/architecture, 81 service, 53 browser and two Docker cases. API/web are refreshed at `https://localhost:8443`; web, readiness and sign-in-provider smoke requests return 200. Both new migrations are applied. Original data and original-column digests across all 19 development tables are preserved, with exactly two new migration-ledger rows. No reset or volume replacement was performed. All 157 inherited protected historical report/reference/migration/package-manifest files match their starting hashes.

Evidence is retained under `.local/validation/mid04a/`: `final-regression.json` and its per-step logs, `final-test-browser.log` (initial 43/52), `final-corrections-browser.log` (8/11), `final-followup-browser.log` (3/3), `post-regression-{lint,typecheck,build}.log`, `runtime-result.json`, `real-youtube-result.json`, `glass-alpha.json`, `final-test-docker.log`, `final-web-refresh.log`, `final-data-preservation.log`, `dev-data-after.json`, `dev-https-smoke.json` and `final-integrity.json`. No skips are used to bypass a failing case.

## Operational and browser limits

Provision and retain `ROOM_INVITE_ENCRYPTION_KEY` as a 32-byte hexadecimal secret outside the database. Local `npm run dev` generates it once. Losing/replacing it prevents redisplay of previously encrypted tokens; redemption remains hash-based. Legacy hash-only invites remain redeemable until their existing expiry/revocation and need a fresh invite for redisplay.

Document Picture-in-Picture requires a user gesture and browser support. The fallback has browser-managed chrome and cannot guarantee always-on-top behavior. Popouts close with their owning room. YouTube's alternate controller does not move or duplicate its video renderer. Native frameless windows, slug redirect history, permanent encounter-history indexing, payments, DMs, scheduling, full profiles and unlisted later-phase work remain deferred.

Mechanism references: [Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture), [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference), [YouTube required minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality).

## Migrations and security review

Two new, feature-owned migrations extend the existing schema without replacing UUID foreign keys or editing any accepted migration:

- `packages/features/rooms/migrations/0004_public_addresses_and_attribution.sql`: random public-ID backfill/default, unique public-ID and slug indexes, slug format/reservation constraints, invite encryption/creator fields, successful invite joins, referral links and deduplicated referral events.
- `packages/features/identity/migrations/0003_referral_context.sql`: nullable opaque OAuth-flow attribution reference. It is not a session identity or authorization credential.

Room creation and slug changes serialize uniqueness checks through the existing database transaction layer, with unique indexes as the final constraint. Resolve, configure, mutation and invite listing/redemption retain UUID-backed membership/owner checks. Slug checks and people discovery have bounded authenticated rate limits. People results expose display identity and consent-filtered relationship information, without internal/provider IDs or emails. Block filtering remains bidirectional.

Invite tokens remain bearer credentials: hashes are used for lookup, AES-GCM envelopes are returned only through authorized active-invite listing, and invalid/expired/revoked/exhausted tokens do not authorize entry. URL capture removes the invite query from browser history before further navigation. Attribution is passed through the existing Origin/CSRF-aware authentication entry point and attached only to a first free signup. A landing event cannot create membership; future conversion ingestion exists only as an internal port. Cookie flags, OAuth state/nonce/PKCE, session and RTC/media authorities are retained.

The normal room route admits automatically after server resolution. The configure route retains explicit Enter. A pending join is retired when navigation leaves the route, before a delayed response can construct RTC or feature owners. Authorization failures clear protected state; temporary transport failures retain only the last authorized feature view and never publish a cached server response as freshly authorized data.

## Visual and interaction review

The dedicated evidence directory is `docs/references/mid04a/`; accepted MID-00–04 reference files remain untouched. Desktop and narrow Account captures show separate content-sized Appearance, Privacy, Blocked People and Devices cards, balanced columns and unchanged username-card geometry during validation overlays. The privacy explanation precedes the status control. The live timer was compacted after screenshot review so Reset, digits, Play/Pause, cog, progress, Skip and tally fit the standard snapped card.

The room/settings matrix covers 320×568, 390×844, 640×450, 820×1024, 1024×480, 1440×900 and 3440×1440, including zoom recovery, dock containment, rail orientation, atmosphere collision and modal focus. Light/dark/complex backgrounds and presentation recovery have dedicated captures. A 65-second traffic test plus offline/reconnect verifies identity preservation for shell, workspace, timer, chat, background and YouTube iframe; the chat draft survives.

Native Chromium Document Picture-in-Picture and the forced utility-window fallback both pass focused checks. The native check adopts the exact timer DOM node, controls the same timer, mirrors appearance, keeps one RTC admission and restores that same node on close. The fallback also verifies one original YouTube iframe and one provider, an alternate media controller, no extra websocket in the utility window, and reuse of one utility window for Pop out all. These are local Chromium results, not claims about every browser or hardware capture device.

## Downstream reconciliation and review gate

The MID-04 report stays historical. Its earlier in-room disclosure interpretation is superseded by MID-04A: active authorized room membership is visible in the room independently of external presence/current-room disclosure. External Home/Friends discovery and Join actions remain privacy-filtered.

MID-05 must build on the implemented compact scope switches, inline Tasks creation/completion/deletion, timer control hierarchy, timer settings and device display/alert preferences. Those named corrections should not be implemented again. Remaining MID-05 work requires explicit owner authorization.

MID-06 must build on the compact Media dock card, atomic URL/Play flow, single-player lifecycle, provider fallback and corrected reconciliation. Broader media design, queue refinements or other unnamed work require their own authorization. No MID-05, MID-06, MID-08 or Phase 09 implementation was started.

Owner acceptance and final visual approval remain pending. MID-04A is COMPLETE — AWAITING_REVIEW, not ACCEPTED. Work stops here; MID-05 requires explicit authorization.

## Dependency audit boundary

The first final audit found inherited high-severity `brace-expansion` advisories published after the accepted baseline. Only three compatible transitive lockfile resolutions changed: two `2.1.4` entries to `2.1.7` and one `5.0.9` entry to `5.0.12`. No direct dependency pin changed and no dependency was added. These releases cover the newly reported [nesting-depth denial of service](https://github.com/advisories/GHSA-qhr7-859c-m2p7) and [quadratic rewrite](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) defects. The high-severity audit gate passes; the audit still reports three inherited lower-severity findings (one low, two moderate) in fast-uri, Fastify and serialize-javascript. They are recorded rather than broadening this correction pass into unrelated package upgrades.

## Exact files changed (initial MID-04A delivery)

This inventory compares the inherited MID-04 working tree with this pass, including new evidence; it does not attribute inherited uncommitted changes to MID-04A. The old `apps/web/app/pages/rooms/[id].vue` was replaced by the shared RoomPage and normal/configure wrappers.

```text
.env.example
apps/api/src/foundation.ts
apps/api/src/identity.ts
apps/api/src/server.ts
apps/web/app/app.vue
apps/web/app/components/AuthWelcome.vue
apps/web/app/components/BlockedPeople.vue
apps/web/app/components/CompactLink.vue
apps/web/app/components/FriendContext.vue
apps/web/app/components/GlassPreference.vue
apps/web/app/components/HomeHeadline.vue
apps/web/app/components/PresenceSettings.vue
apps/web/app/components/RoomAddressEditor.vue
apps/web/app/components/RoomCard.vue
apps/web/app/components/RoomListing.vue
apps/web/app/components/RoomPage.vue
apps/web/app/components/SignIn.vue
apps/web/app/components/UsernameField.vue
apps/web/app/components/backgrounds/BackgroundSelector.vue
apps/web/app/components/backgrounds/EnvironmentSurface.vue
apps/web/app/components/media/RoomMediaController.vue
apps/web/app/components/media/RoomMediaPanel.vue
apps/web/app/components/media/RoomVideo.vue
apps/web/app/components/navigation/AppNavigation.vue
apps/web/app/components/productivity/ChatPanel.vue
apps/web/app/components/productivity/PomodoroPanel.vue
apps/web/app/components/productivity/TasksPanel.vue
apps/web/app/components/room/MediaQuality.vue
apps/web/app/components/room/RoomAppearance.vue
apps/web/app/components/room/RoomIdentityCard.vue
apps/web/app/components/room/RoomSettings.vue
apps/web/app/components/room/RoomShell.vue
apps/web/app/components/room/WorkspaceHost.vue
apps/web/app/components/room/room-refresh.css
apps/web/app/lib/api-client.ts
apps/web/app/lib/realtime.ts
apps/web/app/lib/room-arrangement.ts
apps/web/app/lib/room-navigation.ts
apps/web/app/lib/social.ts
apps/web/app/lib/timer-appearance.ts
apps/web/app/lib/workspace-popouts.ts
apps/web/app/pages/account.vue
apps/web/app/pages/friends.vue
apps/web/app/pages/index.vue
apps/web/app/pages/invite.vue
apps/web/app/pages/rooms/[id].vue
apps/web/app/pages/rooms/[id]/configure.vue
apps/web/app/pages/rooms/[id]/index.vue
apps/web/app/pages/rooms/new.vue
apps/web/app/room/background-model.ts
apps/web/app/room/composition.ts
apps/web/app/room/room-media-model.ts
apps/web/app/room/room-media.ts
compose.yaml
docs/ACTIVE_PHASE.md
docs/PHASE_HISTORY.md
docs/phases/mid-design-refresh/README.md
docs/references/mid04a/README.md
docs/references/mid04a/account-desktop.png
docs/references/mid04a/account-narrow.png
docs/references/mid04a/auth-dark-mobile.png
docs/references/mid04a/auth-light.png
docs/references/mid04a/auth-tablet.png
docs/references/mid04a/desktop-discover.png
docs/references/mid04a/desktop-friend-selected.png
docs/references/mid04a/desktop-friends.png
docs/references/mid04a/desktop-home.png
docs/references/mid04a/desktop-my-rooms.png
docs/references/mid04a/discover-narrow.png
docs/references/mid04a/glass-complex.png
docs/references/mid04a/glass-dark-0-sheet.png
docs/references/mid04a/glass-dark-100-sheet.png
docs/references/mid04a/glass-dark-25-sheet.png
docs/references/mid04a/glass-dark-50-sheet.png
docs/references/mid04a/glass-dark-75-sheet.png
docs/references/mid04a/glass-dark.png
docs/references/mid04a/glass-light-0-sheet.png
docs/references/mid04a/glass-light-100-sheet.png
docs/references/mid04a/glass-light-25-sheet.png
docs/references/mid04a/glass-light-50-sheet.png
docs/references/mid04a/glass-light-75-sheet.png
docs/references/mid04a/glass-light.png
docs/references/mid04a/mobile-home.png
docs/references/mid04a/mobile-my-rooms.png
docs/references/mid04a/productivity-desktop.png
docs/references/mid04a/productivity-mobile.png
docs/references/mid04a/productivity-tablet.png
docs/references/mid04a/projector.png
docs/references/mid04a/room-1024x480.png
docs/references/mid04a/room-1440x1000-fresh.png
docs/references/mid04a/room-1440x900.png
docs/references/mid04a/room-320x568.png
docs/references/mid04a/room-3440x1440.png
docs/references/mid04a/room-390x844.png
docs/references/mid04a/room-640x450.png
docs/references/mid04a/room-820x1024.png
docs/references/mid04a/room-configure.png
docs/references/mid04a/runtime-desktop.png
docs/references/mid04a/settings-1024x480.png
docs/references/mid04a/settings-1440x900.png
docs/references/mid04a/settings-320x568.png
docs/references/mid04a/settings-3440x1440.png
docs/references/mid04a/settings-390x844.png
docs/references/mid04a/settings-640x450.png
docs/references/mid04a/settings-820x1024.png
docs/reports/MID_04A_OWNER_REVIEW_CORRECTIONS_AND_ROOM_STABILITY_REPORT.md
package-lock.json
packages/adapters/src/youtube/browser.ts
packages/contracts/generated/openapi-v1.json
packages/contracts/generated/protocol-v1.schema.json
packages/contracts/src/identity.ts
packages/contracts/src/index.ts
packages/contracts/src/productivity.ts
packages/contracts/src/room-media.ts
packages/contracts/src/social.ts
packages/core/src/workspace.ts
packages/feature-sdk/src/foundation.ts
packages/feature-sdk/src/room-media.ts
packages/feature-sdk/src/social.ts
packages/features/friends/src/server.ts
packages/features/identity/migrations/0003_referral_context.sql
packages/features/identity/src/server.ts
packages/features/pomodoro/src/browser.ts
packages/features/presence/src/server.ts
packages/features/room-media/src/browser.ts
packages/features/rooms/migrations/0004_public_addresses_and_attribution.sql
packages/features/rooms/src/invite-vault.ts
packages/features/rooms/src/referrals.ts
packages/features/rooms/src/server.ts
packages/ui/src/components/popover.ts
packages/ui/src/components/primitives.ts
packages/ui/src/index.ts
packages/ui/src/styles/primitives.css
packages/ui/src/styles/tokens.css
scripts/application-migrations.ts
scripts/dev.mjs
tests/browser/account-ux.spec.ts
tests/browser/backgrounds.spec.ts
tests/browser/identity-rooms.spec.ts
tests/browser/media-provider.ts
tests/browser/owner-corrections.spec.ts
tests/browser/productivity.spec.ts
tests/browser/room-browse.spec.ts
tests/browser/room-media.spec.ts
tests/browser/room-refresh.spec.ts
tests/browser/room-settings.ts
tests/browser/room-stability.spec.ts
tests/browser/room-workspace.spec.ts
tests/browser/rtc-live.spec.ts
tests/browser/rtc-quality.spec.ts
tests/browser/rtc.spec.ts
tests/browser/server.ts
tests/browser/social.spec.ts
tests/browser/visual-foundation.spec.ts
tests/services/backgrounds.test.ts
tests/services/identity-rooms.test.ts
tests/services/productivity.test.ts
tests/services/room-media.test.ts
tests/services/social.test.ts
tests/unit/media-loop.test.ts
tests/unit/productivity.test.ts
tests/unit/room-stability.test.ts
```
