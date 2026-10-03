# MID-04A — Owner Review Corrections, Room Stability & Interaction Cleanup

## Status

**PLANNED — corrective owner-review pass after MID-04 implementation and before MID-05.**

Phase 08 remains **ACCEPTED**.  
MID-00, MID-01, MID-02 and MID-03 remain **ACCEPTED**.  
MID-04 implementation is **COMPLETE — AWAITING_REVIEW** and is the baseline being corrected by this pass.  
MID-05 and later MID phases have **not** begun.  
Phase 09 has **not** begun.

This is an inserted owner-review correction pass created after a detailed visual and runtime review of the current application.

It captures the owner-review corrections discovered while reviewing the completed MID-04 implementation. Some fixes also touch behavior that overlaps later MID-05 and MID-06 scopes because the current implementation already exposes those problems and they materially affect usability or room stability.

After MID-04A is accepted:

- treat MID-04 plus MID-04A together as the reviewed room-shell/workspace baseline;
- update downstream MID-05/MID-06 coordination so already-completed items are not implemented twice;
- continue with MID-05 only after explicit authorization;
- do not reinterpret this pass as authorization to begin Phase 09.

---

# Objective

Correct the currently observed Study Space UX, visual, room-layout and state-stability problems before continuing the remaining Mid-Design Refresh.

The goals are to:

- make Study Space clearly branded across normal app surfaces;
- normalize interaction primitives such as links, dropdowns, checkboxes and validation feedback;
- clean up Home, My Rooms, Discover, Friends and Account;
- introduce safe public room addressing, vanity room names and reusable invite tracking;
- establish a referral-attribution backbone without implementing a paywall;
- fix the current in-room participant-visibility behavior;
- make the immersive room genuinely rearrangeable;
- stabilize the room so unrelated realtime updates do not remount Pomodoro, backgrounds, Chat or YouTube;
- simplify Tasks, Pomodoro and Media interactions;
- preserve all accepted authorization, RTC, media and lifecycle guarantees.

This is a correction and stabilization pass, **not** a framework rewrite.

---

# Read completely before implementation

## Core coordination

- `docs/UMBRELLA_SPEC.md`
- `docs/ACTIVE_PHASE.md`
- `docs/PHASE_HISTORY.md`
- latest accepted Phase 08 report
- `docs/reports/MID_00_GUARDRAILS_AND_AUDIT_REPORT.md`
- `docs/reports/MID_01_VISUAL_FOUNDATION_AND_SHELL_REPORT.md`
- `docs/reports/MID_02_AUTH_ONBOARDING_ACCOUNT_REPORT.md`
- `docs/reports/MID_03_HOME_ROOMS_DISCOVER_FRIENDS_REPORT.md`
- latest `docs/reports/MID_04_ROOM_SHELL_AND_WORKSPACE_REPORT.md` (or the actual MID-04 report path/name in the repository)

## Mid-refresh specifications and guides

- `docs/phases/mid-design-refresh/README.md`
- `MID_04_ROOM_SHELL_AND_WORKSPACE.md`
- `MID_05_PRODUCTIVITY_CARDS.md`
- `MID_06_MEDIA_AND_YOUTUBE.md`
- `GUIDE_ACCESSIBILITY_AND_PLATFORM.md`
- `GUIDE_APPLE_LIQUID_GLASS.md`
- `GUIDE_COMPONENT_AND_INTERACTION_PATTERNS.md`
- `GUIDE_MOTION_AND_TRANSITIONS.md`
- `GUIDE_QA_AND_REGRESSION.md`
- `GUIDE_TYPOGRAPHY_AND_COLOR.md`
- `REFERENCE_CONTEXT.md`

## Relevant architecture

Read the current architecture for:

- identity/session/authz;
- rooms and room entry;
- presence/privacy;
- friends/social;
- invitations;
- backgrounds;
- WorkspaceHost;
- room lifecycle;
- realtime control plane;
- RTC / `RealtimeMediaProvider`;
- room media / YouTube;
- persistence / IndexedDB preferences;
- feature SDK/event boundaries;
- generated contracts and migration ownership.

---

# Preservation rules

1. Preserve all accepted Phase 00–08 behavior unless this specification explicitly changes it.
2. Preserve MID-01 route-loading behavior: opaque fade in, centered spinner, opaque preparation, fade out.
3. Preserve MID-02 internal UUID identity and server-authoritative auth/session behavior.
4. Preserve MID-03 privacy-safe room/friend projections unless explicitly corrected below.
5. Do not weaken HttpOnly/Secure/SameSite cookies, CSRF/Origin validation, OAuth state/nonce/PKCE, server-side authorization, or IDOR/BOLA protection.
6. Do not use raw LiveKit/SFU rosters as social/presence authority.
7. Do not create duplicate room trees, LiveKit connections, camera/mic capture, screen-share capture, YouTube renderers or media ownership.
8. Do not add React or another frontend framework.
9. Do not broadly refactor unrelated architecture.
10. MID-04 is already implemented and awaiting review. Do not begin MID-05, MID-06 or Phase 09 automatically after completing this pass.
11. Where this spec corrects the completed MID-04 implementation or overlaps downstream MID-05/MID-06 specs, this spec takes precedence for the named behavior only.
12. Do not invent owner copy that has not yet been approved.

---

# Workstream A — Global shell, branding and interaction primitives

## A1. Study Space branding on normal app pages

The current authenticated pages do not establish product identity strongly enough.

Add the Study Space logo/wordmark to the **shared non-room shell**, not individually to every page.

Requirements:

- place the Study Space wordmark/logo at the top-left above the page-title region;
- keep it restrained, approximately 28–34 px visual height;
- leave roughly 16–20 px between branding and page heading;
- move normal page headings down enough to give the branding breathing room;
- keep the top-right reserved for contextual page actions such as Create Room;
- do not place the brand as a bottom-right watermark;
- immersive room mode continues to hide normal global shell branding.

Do not duplicate the logo in each page component.

---

## A2. Home H1 as an explicitly rotating text location

Home is an approved rotating-headline location.

Requirements:

- separate persistent Study Space product identity from the rotating H1;
- support a restrained rotating headline component in the Home H1 area;
- reserve stable geometry so text rotation does not cause layout shift;
- honor `prefers-reduced-motion`;
- **do not introduce rotating text elsewhere unless explicitly authorized**;
- the final phrase set is owner-controlled.

Until final phrases are supplied, do not invent a marketing copy library. It is acceptable to leave one existing/temporary phrase in the rotation data structure.

---

## A3. Action links become forgiving button-like controls

Bare underlined action links are too precise to click.

Across the product, UI actions/navigation such as:

- See all
- Find a study friend
- All my rooms
- Explore rooms
- Open room
- similar action links

should become reusable compact text/ghost/tertiary button treatments.

Requirements:

- meaningful vertical and horizontal padding;
- roughly 44 px touch target height where practical;
- semantic links remain links when they navigate;
- commands remain buttons;
- arrow icons stay inside the same hit target;
- hover, active, focus-visible and disabled states;
- ordinary prose hyperlinks are not automatically converted.

---

## A4. Dropdown/select behavior becomes a true overlay primitive

The current select implementation expands in normal document flow in multiple locations.

Replace this behavior with one shared overlay/popover select pattern.

Requirements:

- menu overlays surrounding content;
- no page/card reflow;
- anchored to trigger;
- appropriate z-index/elevation;
- flip upward or reposition near viewport edges;
- keyboard navigation;
- Escape dismissal;
- outside-click dismissal;
- focus restoration;
- mobile may use a responsive sheet/popover fallback;
- no duplicate page-specific select implementations.

Apply this to:

- My Rooms filters/sort/grid;
- Discover filters/sort/grid;
- Friends invite-room selector;
- Account presence status;
- Advanced Room Settings;
- other shared selects using the same primitive.

---

## A5. Temporary global glass-opacity tuning range

For the next owner review cycle, expose the **existing global Appearance glass control** across a temporary full tuning range.

Requirements:

- one global control in the existing Appearance surface;
- 0–100% **glass fill opacity** tuning range;
- changing it previews live across shared glass surfaces;
- persists through the accepted global appearance preference path;
- do not create page-local transparency controls;
- the slider changes material fill alpha, not text/icon opacity;
- blur, border and shadow remain separate material characteristics;
- Auto remains available;
- OS reduced-transparency/increased-contrast overrides remain honored;
- route loading overlay remains fully opaque regardless of slider value.

This 0–100 range is for owner tuning. The final production range may be narrowed after visual review.

---

# Workstream B — Login and non-room page cleanup

## B1. Login/auth background and hierarchy

Keep the current centered auth-card composition and current Google/Discord button direction.

Replace the arch-heavy background treatment.

Preferred direction:

- soft light-blue radial/elliptical glow behind the sign-in card;
- brightest behind the center of the card;
- fade gradually to darker blue outward;
- glow may spill beyond the card;
- overall glow can occupy roughly the central 50% of the page;
- remove abrupt shade changes and decorative arch seams;
- no obvious hard gradient boundary.

Typography:

- Study Space/product name carries stronger emphasis;
- tagline is supporting copy and should not be bold;
- rework the current main line hierarchy so product identity, main statement, supporting tagline, and sign-in actions are clearly separated.

Do not replace the existing provider button behavior.

---

## B2. My Rooms control layout

Preserve the My Rooms page content model, but refine the top control area.

Requirements:

- inherit shared Study Space branding;
- large search remains primary;
- filter chips plus member selector read as one group;
- Sort rooms and Grid columns form a clean secondary group;
- consistent control heights, spacing and baselines;
- responsive wrapping preserves the grouping;
- dropdowns use the shared overlay primitive.

The current room-card click-to-enter behavior remains **pending owner review**. Do not redesign that interaction further in this pass unless separately authorized.

---

## B3. Discover control layout and glow

Apply the same control cleanup as My Rooms:

- shared branding;
- search primary;
- coherent filter group;
- aligned sort/grid group;
- overlay dropdowns;
- responsive layout.

Also add a subtle page-background ambient glow inspired by the login direction:

- light-blue focus glow around the main content region;
- smoothly darkens toward the page edges;
- no arches;
- no extra card/container;
- remains restrained enough not to compete with room cards.

Discover uses the same global glass-opacity control; no local slider.

---

# Workstream C — Friends social surface cleanup

## C1. Friend clicks from compact lists stay in context

Clicking a friend from Home or another compact friend list must not automatically navigate to the full Friends page.

Instead:

- remain on the current page;
- open a compact contextual card beside/near the selected friend;
- card is lightweight, dismissible and not a full focused page;
- Escape/outside click dismisses;
- selecting another friend switches context;
- preserve page scroll position.

Card contents may include:

- display name;
- username;
- avatar;
- authorized presence;
- current room only if the viewer is allowed to see it;
- relationship state;
- Add friend / Remove friend / Block / Unblock as applicable;
- Invite to room where authorized.

No hidden room/presence leakage.

The full Friends page opens only from explicit Friends/See all navigation.

---

## C2. Consolidate Friends search

Remove the two-search-box model.

Use one search field that can search:

- username;
- display name.

Results appear in an overlay/dropdown with tabs:

- **Global**
- **Met before**

Rules:

### Global
- privacy-safe discovery;
- server-authoritative filtering;
- rate-limited;
- no raw UUID/provider/email exposure;
- respect blocks and account visibility;
- avoid unrestricted enumeration.

### Met before
- people discoverable through existing authorized prior/shared context;
- no hidden relationship or room leakage.

The result surface overlays rather than pushing the page downward.

---

## C3. Friend detail identity/presence hierarchy

Tighten identity layout.

Desired format:

`Display Name · Presence`

with:

- display name primary;
- presence text quieter/darker;
- username directly beneath with reduced spacing;
- presence dot on avatar/profile image.

Presence visibility remains subject to existing privacy rules.

---

## C4. Blocked people moves to Account

Remove the Blocked people section from the Friends page.

Move blocked-account management into Account/Settings under privacy/safety/social controls.

Friends should focus on active social interactions, not safety administration.

---

# Workstream D — Account & Settings cleanup

## D1. Denser content-driven layout

The current two-column settings grid leaves excessive blank space.

Requirements:

- cards hug content rather than stretching to match neighboring row heights;
- desktop/ultrawide uses independent content-driven vertical columns or equivalent masonry-like packing;
- preserve logical keyboard/reading order;
- rebalance columns to avoid one side ending far earlier than the other;
- maintain comfortable internal padding without giant empty blocks.

Prefer focused cards such as:

- Profile
- Username
- Sign-in methods
- Appearance
- Privacy & safety
- Blocked people
- Devices/sessions
- Danger Zone

---

## D2. Presence & invitation privacy controls

Move the explanatory description directly under the section heading.

For more detailed per-option help:

- use an accessible information icon/help popover where useful;
- do not leave a long paragraph awkwardly between status dropdown and controls.

Checkbox rows:

- whole row clickable;
- roughly 40–44 px minimum interactive height;
- clearer custom Study Space visual treatment;
- preserve native checkbox semantics and keyboard behavior.

Status dropdown uses the global overlay select primitive.

---

## D3. Username card cleanup

Current username UI is too busy.

Requirements:

- normalize spacing between heading, description, label, field, helper copy and save action;
- description stays directly under the Username heading;
- remove large success banner;
- integrate the `@` prefix cleanly with the input;
- right-edge validation state inside the field:
  - circular check = available;
  - circular cross = unavailable;
  - small loading indicator = checking;
- unavailable state opens a compact anchored message below the input such as `Username isn't available.`;
- that message overlays and does not reflow the card;
- available state needs no large popup;
- validation must remain accessible and not rely only on color/icon.

---

# Workstream E — Room public addressing, configure route, invites and referrals

This work changes persistent product behavior and must use owned migrations/contracts where necessary.

## E1. Canonical room configure route

The management page opened by the room-card cog should use:

`/rooms/<public-id-or-slug>/configure`

Normal room route:

`/rooms/<public-id-or-slug>`

Requirements:

- internal permanent UUID remains the database/authorization identity;
- public route identifiers resolve to UUID server-side;
- remove long internal UUIDs from normal user-facing URLs;
- contextual back navigation uses safe app/history state with `/my-rooms` fallback rather than arbitrary return URLs.

---

## E2. Short public room identifiers

Add a separate stable public room identifier.

Owner preference is a short hex-style address in approximately the 7–12 character visual range.

Security requirement:

- do not use a sequential or monotonic counter;
- do not leak creation order/volume;
- use random collision-checked identifiers;
- prefer approximately 10–12 hex characters initially unless implementation evidence justifies another safe length;
- public ID is an address, not authorization.

Do not replace internal UUID foreign keys.

---

## E3. Vanity room slug / room username

Room owners can optionally claim a unique human-readable room slug.

Example:

`https://studyspace.my/rooms/late-night-study`

Requirements:

- live availability check;
- authoritative server-side uniqueness;
- normalization;
- reserved names;
- allowed-character rules;
- abuse/rate-limit protections;
- slug resolves to permanent room UUID;
- if no slug exists, use public room ID;
- slug is not an ownership key.

Slug-history/redirect policy may remain deferred.

---

## E4. Compact room/invite links

Do not display large full-width raw URL fields.

Use compact link rows/cards with:

- truncated visual URL where needed;
- full accessible/copy value;
- Copy action;
- optional native Share action.

---

## E5. Reusable invite links

Current `shown only once` behavior is not desired.

Room invite URL:

`https://studyspace.my/rooms/<slug-or-public-id>?invite-code=<opaque-token>`

Requirements:

- cryptographically random bearer token;
- authorized managers can re-display/copy active invites until revoked/expired;
- distinguish active/revoked/expired;
- secure storage design supports re-display;
- invite possession grants only the rights defined by the invite;
- referral attribution never substitutes for room authorization.

---

## E6. Per-room invite tracking

Persist invite metadata sufficient for:

- creator;
- created time;
- expiry;
- max uses;
- current uses;
- revoked/expired state;
- successful room joins;
- signup attribution where invite caused registration.

Present this as a compact management tracker.

---

## E7. Global referral-attribution backbone

Add a generic referral-attribution model separate from room-access authorization.

At minimum make the data model capable of tracking:

- referral/link creation;
- landing/click where collected;
- free signup;
- future conversion to supporter/paid tier;
- source/campaign metadata where useful.

Important:

- do **not** implement supporter benefits/paywalling now;
- do not expose sensitive invitee/payment details to referrers;
- aggregate counts are the safe default;
- room invites may contribute attribution while authorization and referral remain logically separate.

---

# Workstream F — In-room presence correction

The current three-account behavior is unacceptable if all users are actively in the same room yet cannot see one another.

## Product rule

Separate:

1. **in-room active participant visibility**
2. **out-of-room social disclosure of current room**

`Show current room` should control external social surfaces such as Home/Friends.

It should not silently remove an active authorized user from the participant rail of the room they are currently using.

## Expected behavior

With three authorized users A/B/C actively in the same room:

- A sees A+B+C;
- B sees A+B+C;
- C sees A+B+C;
- live count is correct;
- join adds promptly;
- leave removes promptly;
- reconnect does not duplicate.

Do not expose raw LiveKit roster as the fix.

Reproduce the current behavior before changing it and determine whether the privacy coupling is the only cause or whether a second synchronization bug exists.

---

# Workstream G — Room layout becomes fully rearrangeable

## G1. Everything is a room layout object in Rearrange View

In Rearrange View, every visible room element becomes a movable layout object.

Examples:

- grouped top bar;
- participant rail;
- bottom dock;
- atmosphere text;
- Pomodoro;
- Tasks;
- Chat;
- Clock;
- media/player surfaces;
- other visible tool cards.

This does **not** mean every element has identical geometry rules.

Each element type can define valid orientation, snap zones and minimum/maximum geometry.

All critical controls must remain recoverable.

---

## G2. Bottom dock `...` quick menu

The bottom dock ellipsis must open a compact quick-actions menu rather than the full Room Settings modal.

Confirmed quick actions:

- Rearrange view
- Pop out all
- Advanced settings

Additional quick actions may be added only if genuinely high-frequency.

Advanced settings opens the full settings surface.

---

## G3. Rearrange View behavior

Requirements:

- clear edit mode;
- visible movable affordances/handles;
- Done action;
- Reset layout;
- safe bounds;
- per-user/per-room persistence;
- recover invalid/off-screen geometry after viewport/zoom changes;
- reduced-motion support;
- no independent drag engine per element.

Use/refactor the accepted WorkspaceHost/layout layer into the shared geometry authority.

---

## G4. Top-bar group

Back + room identity/privacy + Invite are one movable group.

They cannot be rearranged independently.

Provide four canonical horizontal snap locations:

1. far left;
2. near-left / rail-clear;
3. center;
4. far right.

The near-left point must leave enough room for the participant rail to extend upward.

Participant-rail interaction:

- if grouped top bar occupies the rail footprint, rail moves slightly lower;
- when top bar clears the rail footprint, rail may extend upward;
- collision response is derived, not stored as a separate arbitrary layout value.

---

## G5. Participant rail orientation

Participant rail becomes a movable room layout object.

When docked:

- left/right edge → vertical participant rail with vertical scrolling;
- top/bottom edge → horizontal participant rail with horizontal scrolling.

The layout should reflow, not merely rotate the old pixels.

Remove the isolated participant-count number at the bottom.

When vertical, rail extends to the bottom edge of the usable room area.

---

## G6. Atmosphere text

`THE QUIET HOURS / Make yourself a little space.` remains a lightweight atmospheric element.

Requirements:

- movable freely in Rearrange View;
- must avoid other room elements;
- safe bounds;
- persistence;
- recover after resize/zoom.

Readability treatment:

- soft localized haze/gradient travels with text;
- no abrupt black-gradient start edge;
- use a wider feathered cinematic fade rather than a visible black strip;
- preserve readable but integrated background treatment.

---

# Workstream H — Room Settings and quick room identity

## H1. Room-name pill opens quick settings

Clicking the room name/privacy pill in the top bar opens an anchored compact card.

For authorized managers:

- edit room name;
- edit Public / Unlisted / Private;
- apply via existing authority/version rules;
- update top-bar state after success.

For non-managers:

- read-only info or no management actions.

Escape/outside click closes and restores focus.

Full configure page remains for deeper management.

---

## H2. Advanced Room Settings modal

The existing full Room Settings UI is visually messy and must be cleaned across all tabs.

Requirements:

- dimming scrim behind modal;
- subtle backdrop blur allowed if performant;
- room clearly recedes;
- modal does not compete with background;
- two-pane desktop category layout can remain;
- responsive narrow behavior;
- consistent spacing and section hierarchy;
- no horizontal overflow;
- overlay dropdowns;
- avoid unnecessary Apply/Save actions when live apply is appropriate;
- keep explicit Save only where transactional semantics genuinely require it.

Current categories may remain conceptually similar:

- Media & Devices
- Quality
- Audio
- Camera
- Appearance
- Room & Privacy
- Notifications
- Diagnostics

but implementation should refine all of them, not only the first three.

---

# Workstream I — Pop-out / multi-window workspace

## I1. Pop out all

Add **Pop out all** to the bottom-dock `...` quick menu.

Intent:

Allow Study Space room tools to remain visible alongside another site/app, such as a university portal, without constant tab switching.

Web constraints:

- use minimal browser chrome where supported;
- do not promise a truly frameless/title-bar-free normal browser window;
- evaluate Document Picture-in-Picture for appropriate surfaces where supported;
- native desktop can later provide true frameless utility windows.

## I2. Individual Pop out

Eligible workspace cards support individual Pop out.

Important:

- Pop out action must live in a dedicated card-header action area;
- it must not overlap the resize hit region;
- resizing perimeter/corners and header actions are separate hit targets;
- individual pop out remains clickable even when a card is flush against a viewport edge.

## I3. Ownership

Popouts are alternate views/controllers of the same room state.

They must not create:

- extra LiveKit room connections;
- duplicate mic/camera capture;
- duplicate screen-share capture;
- duplicate YouTube/media renderers;
- separate conflicting authoritative sessions.

Closing a popout restores/recover its in-room representation.

---

# Workstream J — Workspace geometry and minimize behavior

## J1. Boundary-resize bug

Observed bug:

When a panel is resized into a viewport boundary, continuing to drag can make the card grow from the opposite side.

Fix in shared geometry.

Rules:

- active dragged edge/corner is the only edge/corner that moves;
- opposite anchor remains fixed throughout gesture;
- once active edge reaches a boundary, that axis stops changing;
- pointer movement beyond the boundary does not grow from the opposite side;
- moving pointer back into valid space resumes smoothly;
- move operations clamp position only;
- resize operations clamp size around the fixed opposite anchor.

Test all edges and corners.

---

## J2. Minimized tool docklet

Pomodoro, Tasks, Chat and Clock minimize into circular icons inside a compact top-right pill/capsule.

Requirements:

- recognizable icon per tool;
- clicking restores the card;
- restore prior position/state where practical;
- smooth spatial transition;
- minimized state is persistent enough to survive normal room updates without losing the tool.

---

# Workstream K — Tasks and Pomodoro card redesign

## K1. Personal / Shared switch

For Tasks and Pomodoro:

- remove large body-level Personal and Shared buttons;
- use one compact two-position segmented switch beside the card title;
- switching mode must not cause geometry jump.

---

## K2. Tasks interaction

Remove dedicated Add Task button.

Use inline task creation:

- text input row;
- right-edge checkmark saves;
- created task has checkbox on left;
- completed task remains visible but subdued/struck through;
- hover/focus on task reveals small delete action;
- keyboard accessible;
- compact and fast.

---

## K3. Pomodoro in-room layout

Redesign the live timer card to stay minimal.

Desired control hierarchy:

- Reset compact control on the left;
- prominent timer numerals in the center;
- Play/Pause compact control on the right;
- settings cog beside Play/Pause;
- progress bar below numerals;
- dedicated `Skip cycle` action below progress bar.

Remove the current inline timer-settings form from the live card.

---

## K4. Pomodoro settings surface

Timer settings should use a clean structured settings surface inspired by the good information architecture of Flocus, without copying proprietary branding/assets.

Relevant features to support where appropriate:

- focus duration;
- short break duration;
- long break duration;
- cycles;
- timer visual style:
  - default
  - flip
  - progress-bar emphasis
  - gauge
  - dot matrix
  - pie
- optional progress display;
- auto-start/segment-end behavior;
- notification behavior;
- alert sound selection;
- alert volume;
- session tally / focus-session tracking;
- related clock/timer display preferences where relevant.

Keep the live room card minimal; richer configuration belongs in settings.

Personal/shared authority must remain correct.

---

# Workstream L — Room Media / YouTube simplification

## L1. Compact Media card

Clicking Media in the bottom dock should open a compact card directly above the dock.

Default card contents:

- title `Media`;
- settings cog;
- one prominent URL input.

Do not open the current large form-heavy Room Media surface by default.

---

## L2. One-step YouTube flow

Current flow is unacceptable:

paste URL → Add to room → Play room → Open YouTube tile → Enable YouTube → Resume YouTube.

Target:

- paste/submit supported YouTube URL;
- metadata can resolve automatically;
- playback begins from that intentional action when provider/browser policy permits;
- if another user gesture is required, expose **one clear Play action only**.

Remove normal-user steps for:

- Enable YouTube;
- Resume YouTube;
- separate Play room chain.

Do not bypass YouTube/provider policies or extract/rebroadcast audio.

---

## L3. Remove debug/implementation clutter

Do not show raw normal-UI status such as:

- `YouTube: Playing · 117s`;
- raw seek seconds;
- provider-state explanations;
- technical sync details.

Real diagnostics belong under Advanced settings → Diagnostics.

Advanced Media settings may contain:

- queue;
- ambience/mix;
- authority/suggestion policy;
- playback settings;
- diagnostics.

---

## L4. YouTube short-loop sync bug

Explicitly reproduce current behavior:

- local player starts;
- authoritative room state remains paused/older time;
- reconcile loop repeatedly seeks/pauses;
- user sees 2–3 second loop;
- only Resume YouTube stabilizes it.

Required result:

- initiating playback updates authoritative shared state and local renderer coherently;
- remote clients reconcile once;
- no 0–3 second loop;
- no hidden second resume step;
- pause, seek, resume, controller changes and late join remain deterministic.

---

# Workstream M — Room runtime stability

The following symptoms are correlated and must be treated as a shared lifecycle/state issue until proven otherwise:

- Pomodoro disappears/reappears;
- background flashes the previous wallpaper then returns to the new one;
- YouTube iframe reloads/reinitializes;
- Chat reloads/remounts.

## Investigation

Instrument/reproduce:

- keyed room-shell remounts;
- route/page key changes;
- snapshot replacement vs merge;
- stale WebSocket snapshot replay;
- reconnect handlers;
- duplicate subscriptions;
- persistence/IndexedDB racing authoritative room state;
- workspace layout reconstruction;
- timer resubscription;
- background preload/fallback behavior;
- media renderer lifecycle;
- Chat component lifecycle.

## Required behavior

Unrelated updates must not recreate unrelated UI.

Examples:

- participant join/leave does not reset background;
- timer tick does not reload YouTube;
- chat message does not remount Pomodoro;
- background change does not recreate Chat;
- reconnect reconciles feature state without replacing whole room UI unless absolutely necessary.

Keep one stable room-shell tree wherever possible.

---

# Implementation order

Use the following sequence to reduce debugging ambiguity.

## Pass 1 — Instrument and lock runtime baselines
Before large visual changes:

- reproduce three-account participant issue;
- reproduce Pomodoro/background/YouTube/Chat remount issue;
- reproduce YouTube 2–3 second loop;
- reproduce WorkspaceHost resize-anchor bug;
- add focused failing/regression tests where practical.

## Pass 2 — Shared primitives
Implement:

- global branding slot;
- action-button link primitive;
- overlay select/popover;
- global opacity tuning range;
- checkbox-row hit targets;
- validation status/popover primitives.

## Pass 3 — Non-room page cleanup
Implement:

- login;
- Home header foundation;
- My Rooms;
- Discover;
- Friends;
- Account.

## Pass 4 — Room identity/invite/referral backend
Implement migrations/contracts for:

- public room ID;
- room slug;
- canonical routes;
- reusable invite tokens;
- invite tracking;
- referral backbone.

Do not mix these schema changes into visual commits without clear migration ownership/tests.

## Pass 5 — Room presence and lifecycle
Fix:

- in-room participant projection;
- room-shell/state stability;
- background/Pomodoro/Chat/YouTube remount behavior.

## Pass 6 — Room layout system
Implement:

- quick More menu;
- Rearrange View;
- movable room objects;
- top-bar snapping;
- participant rail orientations;
- atmosphere positioning;
- workspace boundary fix;
- minimize docklet;
- popouts.

## Pass 7 — Productivity/media interaction cleanup
Implement:

- Tasks;
- Pomodoro;
- Media;
- YouTube synchronization;
- Advanced Room Settings cleanup.

## Pass 8 — full regression and visual review
Only after all focused groups are green.

---

# Accessibility requirements

Preserve or add:

- visible focus;
- keyboard traversal;
- semantic links/buttons;
- semantic checkbox state;
- accessible select/listbox behavior;
- Escape handling;
- focus restoration;
- meaningful status announcements for username validation;
- reduced motion;
- reduced transparency / high contrast;
- sufficient hit targets;
- no color-only status communication;
- popout accessibility where browser capabilities permit;
- layout recovery so controls cannot become unreachable.

---

# Security and privacy requirements

Explicitly verify:

- public room IDs/slugs never become authorization primitives;
- invite-code is treated as bearer access material;
- referral records never grant room access;
- username/room-slug search cannot bypass privacy/authorization;
- presence projection does not leak hidden current-room state outside the room;
- raw SFU roster is not exposed as social presence;
- popouts require the same authenticated/authorized room context;
- no extra capture/session is created in popouts;
- no open redirects are introduced by route cleanup;
- existing block rules remain enforced.

---

# Testing requirements

## Global / shell
- branding on all non-room pages;
- immersive room excludes global brand;
- action-link hit targets;
- overlay dropdown no-reflow;
- keyboard select behavior;
- opacity 0/25/50/75/100 and Auto;
- route loader unaffected by opacity.

## Login
- glow/background visual regression;
- provider buttons unchanged functionally;
- responsive layout.

## Home/My Rooms/Discover
- search/filter/sort alignment;
- Discover glow;
- action buttons;
- responsive widths.

## Friends
- contextual friend card stays on originating page;
- unified search tabs;
- privacy-safe Global/Met before results;
- friend detail identity/presence;
- blocked management absent from Friends and present in Account.

## Account
- content-driven card heights;
- username validation states;
- unavailable overlay no-reflow;
- full-row checkbox hit targets;
- status dropdown overlay.

## Room IDs / routes / invites / referrals
- UUID remains internal authority;
- public-ID uniqueness;
- slug uniqueness/races;
- reserved names;
- canonical configure route;
- short room route;
- invite re-display;
- expiry/revoke/max uses;
- invite attribution;
- referral signup attribution;
- future conversion event schema path;
- referral cannot authorize room entry.

## Presence
- three accounts visible in same room;
- external Show current room privacy remains enforced;
- leave/reconnect;
- no duplicates.

## Rearrange / WorkspaceHost
- all room elements enter rearrange mode;
- top-bar group snaps to four positions;
- participant rail vertical/horizontal reflow;
- rail collision response;
- atmosphere collision avoidance;
- geometry persistence;
- viewport/zoom recovery;
- all edge/corner resize anchors;
- minimize/restore;
- individual popout hit target;
- Pop out all;
- no duplicate RTC/media/capture.

## Runtime stability
Long-running room test with:
- timer active;
- background change;
- participant joins/leaves;
- chat messages;
- media playback;
- reconnect;
- settings changes.

Verify:
- no Pomodoro remount;
- no old-background flash;
- no Chat remount/input loss;
- no YouTube iframe reinit;
- one room tree;
- one WorkspaceHost;
- one expected realtime subscription set.

## Pomodoro / Tasks
- Personal/Shared switch;
- inline task save;
- task complete;
- delete hover/focus;
- timer reset/play/pause;
- progress;
- skip cycle;
- settings cog;
- settings persistence/authority.

## Media
- paste URL;
- metadata;
- one playback gesture where required;
- no Enable/Resume chain;
- no short-loop seek bug;
- remote synchronization;
- late join;
- pause/seek/controller changes;
- provider policy fallback.

Run the relevant accepted RTC/SFU/media regression group once on the final implementation because this pass touches room lifecycle and media synchronization.

Do not repeatedly rerun expensive unrelated suites during every small visual change.

---

# Documentation

Create:

`docs/reports/MID_04A_OWNER_REVIEW_CORRECTIONS_AND_ROOM_STABILITY_REPORT.md`

The report must include:

- exact files changed;
- screenshots/visual review evidence;
- shared-primitives changes;
- non-room page corrections;
- global opacity implementation;
- room public-ID/slug model and migrations;
- invite/referral schema and policy;
- three-account presence reproduction and result;
- WorkspaceHost/layout changes;
- popout capability/limitations;
- runtime remount root cause;
- Pomodoro/Tasks changes;
- Media/YouTube changes;
- security/privacy review;
- validation/test evidence;
- known limitations;
- deferred items;
- downstream MID-04/MID-05/MID-06 reconciliation;
- explicit confirmation that Phase 09 was not started.

Update:

- `docs/ACTIVE_PHASE.md`
- `docs/PHASE_HISTORY.md`
- `docs/phases/mid-design-refresh/README.md`

Add this spec to the mid-design-refresh sequence **immediately after MID-04 and before MID-05**.

---

# Explicitly deferred

Do not implement as part of MID-04A unless separately authorized:

- final Home rotating phrase library/copy if owner has not supplied it;
- final production glass-opacity bounds after owner tuning;
- supporter/paid-tier benefits and paywall;
- payment provider integration;
- full referral analytics dashboard;
- DM system;
- scheduling/calendar;
- full public profiles;
- final native frameless multi-window implementation;
- room-card click behavior beyond the still-pending owner decision;
- unrelated MID-05/MID-06 work not named in this spec;
- MID-08 Nuxt migration;
- Phase 09.

---

# Acceptance gate

MID-04A is complete only when:

1. all named owner-review corrections are implemented;
2. runtime room remount/flicker behavior is fixed or its residual limitation is explicitly reproduced, bounded and approved;
3. three-account in-room presence behaves correctly;
4. dropdowns no longer reflow layouts;
5. room addressing/invite/referral migrations are validated;
6. Rearrange View and WorkspaceHost geometry are stable;
7. Pomodoro/Tasks/Media interaction flows match this specification;
8. full relevant regression passes;
9. owner visual review is complete.

Set status to:

**COMPLETE — AWAITING_REVIEW**

Then stop.

Do not begin MID-05 automatically.
