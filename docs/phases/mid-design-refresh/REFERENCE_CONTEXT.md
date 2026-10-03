# Reference Context

# Study Space — Post-Phase-08 UX Review, Issues, Additions & Future Feature Notes

**Compiled:** 2026-09-13  
**Purpose:** Preserve the full product-review context discussed after Phase 08 so nothing is lost before implementation continues.

---

## 1. Current Project State

Accepted baseline:

- Phase 00 — Foundations
- Phase 01 — Identity, Sessions, Home & Rooms
- Phase 02 — Canonical Room Shell
- Phase 03 — Presence, Friends & Invitations
- Phase 04 — Realtime Productivity: Pomodoro, Tasks & Chat
- Phase 05 — Backgrounds & Environment Assets
- Phase 06 — Basic RTC: Mic, Camera & Screen Share
- Phase 07 — Advanced RTC & Quality Control
- Phase 08 — Room Media, Ambience & Shared Mix

Repository-wide semantic cleanup/refactor and architecture review are complete.

**Current intention:** perform a post-Phase-08 stabilization / UX pass before Phase 09.

---

# 2. Global Design Principles

## Desktop should feel like desktop

Current non-room pages are too narrow and tablet-like on desktop.

Desired:
- use much more horizontal space on desktop;
- avoid one narrow centered column everywhere;
- use multi-column/contextual-pane layouts where appropriate;
- preserve touch-friendly stacked layouts for tablet/mobile;
- room itself remains immersive/fullscreen and follows its own layout.

## Avoid repeated “AI-vibecoded” hero-card composition

Do not use the same giant pale rounded rectangle + eyebrow + huge serif heading + one sentence + button pattern on every page.

Keep the Study Space identity:
- warm cream / muted green palette;
- calm serif display typography where appropriate;
- soft corners;
- subtle motion;
- quiet study atmosphere.

But use proper application UX:
- conventional page headers;
- sections;
- sidebars;
- grids;
- contextual actions;
- compact cards;
- responsive panes.

## Shared branded controls

Study Space should have reusable branded controls for:
- select/dropdown/combobox;
- radio/select cards;
- segmented controls;
- buttons;
- fields;
- dialogs;
- contextual menus;
- tooltips;
- badges;
- cards;
- loading states.

True dropdowns should use Study Space styling rather than raw Windows/browser-native appearance.

## Footer / bottom-area behavior

On non-room pages:
- shell uses `min-height: 100dvh`;
- footer sits at viewport bottom when content is short;
- footer follows flow when content is long;
- fixed mobile bottom navigation never covers the final element;
- scrolling leaves adequate bottom safe-area/padding.

---

# 3. Authentication / Signed-Out Experience

## ISSUE 01 — Signed-out page feels unfinished

Current signed-out state feels like a sparse homepage rather than a deliberate login page.

Desired:
- minimal signed-out chrome;
- focused auth card;
- stronger hierarchy/spacing;
- subtle Study Space room-oriented visual identity;
- responsive/mobile-friendly design;
- no full marketing page yet.

Suggested direction:

> Your space to focus, together.  
> Join study rooms, work alongside friends, and settle into your flow.

### Deferred
Full marketing/landing page should wait until final polished screenshots exist.

## ISSUE 02 — Provider buttons lack branding

Desired:
- Google icon/logo;
- Discord icon/logo;
- proper capitalization;
- consistent provider-button styling;
- loading/disabled/error states per provider;
- provider-specific failure must not disable the other provider.

Preferred wording:
- `Continue with Google`
- `Continue with Discord`

## ISSUE 03 — Conditional Google One Tap / FedCM

Behavior:
1. Ask backend/current-session endpoint whether user is authenticated.
2. If authenticated: do not show One Tap.
3. If unauthenticated and Google auth is enabled: initialize One Tap where eligible.
4. Keep normal Google + Discord buttons as fallback.
5. Respect dismissal/cooldown.
6. Stale/invalid session state degrades to signed-out rather than “sign-in unavailable”.

Do not expose/read HttpOnly cookies from frontend JS.

---

# 4. Post-Authentication Routing

## ISSUE 07 — Normal sign-in destination is wrong

Desired:
- normal successful sign-in → `/home`;
- reauthentication for sensitive action → return to origin;
- invite/deep-link sign-in → return to validated intended destination;
- never allow arbitrary external return URLs.

---

# 5. Account & Devices

## ISSUE 04 — Account page wastes desktop space

Desired:
- wider desktop composition;
- multi-column layout where useful;
- stacked/touch-friendly tablet/mobile version;
- no giant hero dependence.

Potential desktop organization:
- Profile
- Sign-in methods
- Signed-in devices
- Danger Zone

## ISSUE 05 — Sign-in methods presentation

Replace loose actions like:
- `Reauthenticate with google`
- `Link discord`

with polished provider rows:
- Google
- Discord
- provider icon
- Connected / Not connected state
- Reauthenticate / Link action

## Device presentation

Show readable summaries:
- Windows 11 · Chrome
- Ubuntu 26.10 · Firefox
- macOS 27 · Safari
- iPadOS 27 · Safari
- Android · Chrome

Optional device class if reliable:
- Desktop
- Laptop
- Tablet
- Phone

Do not fabricate exact hardware model names.

### Expandable raw detail
Summary can expand to reveal full raw user-agent string.

### User-defined device names
Allow cosmetic renaming:
- My Gaming PC
- Library Laptop
- iPad Pro

Friendly name must never become security authority.

## ISSUE 06 — No account deletion workflow

Add a clear Danger Zone.

### Current-stage deletion flow
1. User chooses Delete account.
2. Explain consequences.
3. Require step-up reauthentication with an existing provider.
4. Require explicit destructive confirmation such as typing `DELETE`.
5. Final action wording must be explicit, e.g. `Permanently delete my account`.
6. Server performs deletion according to a defined deletion policy.
7. Revoke all sessions/media authority/active leases.
8. Clear local account/session state.
9. Stale sessions must recover cleanly to signed-out.

### Future identity expansion
Later support:
- email OTP;
- SMS OTP where appropriate;
- one-time sign-in links / magic links;
- TOTP;
- passkeys;
- real second-factor challenges.

At that point deletion can require true 2FA.

### Data-policy decision required
Explicitly define behavior for:
- owned rooms;
- shared chat;
- shared tasks/media baselines;
- invitations;
- friendships;
- participant history;
- references from shared content.

Do not blindly cascade-delete.

---

# 6. Global Non-Room Page Layout

## ISSUE 08 — Global desktop density problem

Scope:
- Home
- My Rooms
- Friends
- Discover
- Account & Devices
- room detail/settings
- create/edit room
- auth-adjacent pages

Desired:
- wider desktop shell;
- multi-column layouts;
- contextual secondary panes;
- responsive collapse;
- no giant unused horizontal regions.

---

# 7. Home Page

## ISSUE 09 — Authenticated Home hero has low value

Current hero consumes too much above-the-fold space.

Replace/remove it with useful content such as:
- resume last room;
- create room;
- join via invite;
- recent room activity;
- active friends;
- friends currently studying.

No marketing-style hero on authenticated Home.

## Proposed Home layout

### Left column
Friends, sorted primarily by people the user studies with most often.

Private affinity ordering may use:
- recent shared-room sessions;
- accepted invitations;
- recency;
- study frequency.

This must not become a public ranking.

### Right/main column
- Your Rooms grid
- Public Rooms grid below

Do not hard-limit room grids to 3 columns.

---

# 8. Room Cards

## ISSUE 10 — Cards are visually basic and semantically ambiguous

Use proper title case:
- Public
- Private
- Unlisted
- Owner
- Moderator
- Member

Separate:
- privacy;
- user permission;
- membership count;
- current presence.

Examples:
- `1 member`
- `4 members`
- `Nobody online`
- `1 online`
- `3 online`

Never let membership count look like “people currently inside”.

Optional metadata:
- last opened;
- last activity;
- background preview.

## ISSUE 14 — Background preview on cards

Preferred direction:
Use current room background as a subtle translucent/blurred full-card layer.

Requirements:
- preserve text contrast;
- overlay/blur/gradient as needed;
- neutral fallback when none exists;
- shared RoomCard everywhere:
  - Home
  - My Rooms
  - Discover
  - side panes

## ISSUE 16 — Background reveal motion

Do not make background appear abruptly.

Use subtle first-render reveal:
- fade + slight scale/spread;
- soft masked wash;
- gentle blur-to-settle.

Guidelines:
- ~200–350 ms;
- subtle ease-out;
- once only;
- interaction not delayed;
- respects `prefers-reduced-motion`.

## ISSUE 17 — Room-card navigation

Desired:
- click card body/title/background → enter room;
- `Open room` → enter room;
- Room settings/gear → detail/settings page;
- nested actions stop propagation;
- keyboard Enter/Space works;
- accessible labels.

Same behavior everywhere RoomCard is used.

---

# 9. My Rooms

## ISSUE 12 — `/my-rooms` layout and consistency

Desired:
- wider desktop shell;
- redesigned shared RoomCard;
- responsive multi-column grid;
- compact search/create toolbar;
- direct room entry from card;
- separate settings action;
- footer at viewport bottom when short.

---

# 10. Layout Width / Ultrawide Support

## ISSUE 13 — Layout width and grid density lack user control

Do not use a fixed 3-column cap.

Default should derive from:
- viewport width;
- content width;
- minimum useful card width;
- user preference.

### Layout width preference
Available to all:
- Auto
- Compressed
- Full-width

### Room grid density
For pages like My Rooms:
- Auto
- manual column count where physically feasible
- 3, 4, 5, 6, 7, 8+ as space allows

Only offer values that safely fit.

### Ultrawide first-run prompt
If viewport is meaningfully ultrawide (roughly wider than 20:9 plus a sensible minimum width), show a one-time prompt:

> We noticed you're using an ultrawide display.  
> How would you like Study Space to use the extra room?

Choices:
- Compressed view
- Full-width view

Use animated miniature previews if practical.

After selection, tell the user where the setting can be changed later.

Persist locally/device-scoped:
- layout width mode;
- room-grid preference;
- ultrawide prompt seen state.

Compressed must remain a multi-column desktop layout, not tablet mode.

---

# 11. Room Detail / Settings Page

## ISSUE 15 — Room detail/settings inherits narrow tablet layout

This is a management page, not a required intermediate step before room entry.

Normal flow:
- click room card → enter room
- click Room settings → room detail/settings

Desired:
- wider main content;
- contextual side pane;
- room info/settings/invites in main area;
- My Rooms / Public Rooms or other useful quick access on the right.

## ISSUE 18 — Hero metadata is misleading/incomplete

Current text like `1 members · Available independently of the owner` is unclear.

Desired:
- correct grammar;
- explicit online presence;
- privacy badge;
- current user role badge;
- availability explanation as secondary text.

Example:
- `1 member`
- `0 online`
- `Available even when the owner is away`

### Badge placement
Right-aligned vertical stack:
- Unlisted
- Owner

Later examples:
- Private
- Moderator
- Invite only

## ISSUE 19 — Contextual Back control

Replace hardcoded `← My Rooms` with generic Back.

Do not blindly use browser history.

Remember internal origin:
- Home → room settings → Back → Home
- My Rooms → room settings → Back → My Rooms
- Discover → room details → Back → Discover
- Friends → room details → Back → Friends

Preserve query/filter/scroll state where practical.

Deep-link fallback → canonical parent such as `/my-rooms`.

Never trust arbitrary external return targets.

---

# 12. Contextual Right-Side Pane

On sufficiently wide non-room pages, use:
- main content;
- contextual secondary pane.

Examples:

### Home
- left: friends
- main/right: My Rooms + Public Rooms

### My Rooms
- main: room grid
- side: recent/public suggestions

### Account
- main: settings
- side: compact active sessions / rooms / useful shortcuts

### Room settings
- main: management
- side: My Rooms / Public Rooms

### Friends
- main: friend management
- side: recently shared rooms / suggested sessions

### Discover
- main: public rooms
- side: Your Rooms / friends studying

Pane content varies by page.

---

# 13. Create Room / Edit Room

## ISSUE 21 — Raw-form UX

Create/Edit may remain separate pages if cleaner.

They should:
- share reusable controls;
- share validation where appropriate;
- share visual structure/spacing;
- avoid duplicated styling logic;
- differ where task context genuinely benefits.

Desired desktop behavior:
- proper page header;
- wider form;
- meaningful grouping;
- potential live RoomCard preview;
- stacked touch-friendly mobile layout.

A live preview should reuse the real RoomCard.

## ISSUE 22 — Dropdowns look like default Windows/browser UI

Desired branded dropdown:
- Study Space trigger;
- custom listbox/popover;
- consistent radius/spacing;
- selected-state indicator;
- hover/focus states;
- keyboard navigation;
- screen-reader semantics;
- search/typeahead for long lists;
- mobile-safe behavior.

Do not use the same control everywhere blindly.

Examples:
- Room privacy → visible radio/select cards may be better
- RTC codec → branded select
- Camera device → branded select
- FPS → combobox + custom entry
- Calendar provider → provider cards
- Grid columns → stepper/segmented/select depending width

---

# 14. Dynamic / Rolling Microcopy System

## Future platform feature

Conversational/playful/user-tailored copy should use reusable variant pools rather than one repeated sentence.

Eligible examples:
- checking calendars;
- results found;
- no good times;
- busy-but-you-can-ask;
- room-entry prompts;
- playful room-entry responses;
- empty states;
- casual success messages;
- invitation flavor;
- non-critical warnings.

### Concept
Central service with named pools:
- `calendar.checking`
- `calendar.results_found`
- `calendar.busy_but_ask`
- `calendar.not_connected`
- `calendar.reauth`
- `room.entry.ready`
- `room.entry.yes`
- `room.entry.no`

Selection:
- shuffle-bag;
- recent-repeat suppression;
- use each variant approximately once before reuse;
- avoid previous 3–5;
- reshuffle when exhausted.

Can use safe context:
- time of day;
- session duration;
- room name;
- online state;
- date;
- availability state.

### Stable text
Do not randomize critical/security/legal/consent copy:
- Delete account
- Reauthenticate
- Permission denied
- Session expired
- destructive confirmations
- privacy/legal text
- accessibility-critical labels

---

# 15. Future Social Layer

These larger features should not be squeezed into pre-Phase-09 stabilization.

Potential revised Phase 11 direction:

**Social Bonding, Messaging, Scheduling & Mini-Games**

---

# 16. One-to-One Personal Chat

Future:
- DMs between friends;
- same app WebSocket control plane as room chat;
- server-authoritative friendship/block checks;
- unread counts;
- notifications;
- room/study-session invite cards;
- typing/read receipts only if intentionally chosen.

---

# 17. Notifications

Build a proper notification module.

Potential types:
- Friend request
- Friend accepted
- Direct message
- Room invitation
- Study-session invitation
- RSVP
- Session starting soon
- Someone joined a scheduled room
- Calendar connection problem
- Calendar availability unavailable
- Social/minigame invites later

Potential delivery:
- in-app notification center;
- unread badge;
- browser push later with explicit permission;
- email/push later if desired.

---

# 18. Study-Session Invitations / RSVP

A DM can create a study invitation.

Example:

**Grind out Chapter 4**  
Today · 8:00 PM  
Expected duration: 1 hour  
Room: Physics Grind

Responses:
- Going
- Maybe
- Can't

Composer asks:
- date;
- proposed start time;
- expected duration;
- room;
- optional title/description.

---

# 19. Calendar-Aware Invite State Machine

1. Choose friend.
2. Choose day.
3. Choose preferred start time.
4. Choose expected duration.
5. Check availability.
6. Show result + alternatives.
7. Enable send.

### Send rule
While checking:
- Send is truly disabled.

Once state is:
- Green
- Yellow
- Red
- Unknown
- Error

sending is allowed.

Calendar availability never becomes a hard dependency for basic social interaction.

---

# 20. Calendar Search Scope

Alternative times are searched **only within the selected local calendar day**.

Do not silently suggest another date.

If no good window:
- say so honestly;
- still allow busy-time invite;
- user can change date deliberately.

---

# 21. Availability Traffic-Light Model

Session duration defines the requested interval.

Comfort buffer is fixed:
- 1 hour before
- 1 hour after

Examples:
- 18:00–19:00 → Green comfort window 17:00–20:00
- 18:00–18:30 → Green comfort window 17:00–19:30

## GREEN
- requested interval free;
- full 1h before free;
- full 1h after free;
- no relevant personal meal-preference overlap.

## YELLOW
Possible reasons:
- session itself available but buffer is tight;
- tentative provider state;
- own lunch/dinner preference overlaps;
- provider marks slot non-blocking/free but uncertainty exists and can be known without reading event contents.

## RED
- requested interval overlaps Busy;
- requested interval overlaps Out of Office;
- blocking availability conflicts with session.

## UNKNOWN
- no calendar;
- provider unavailable;
- auth expired;
- sharing disabled;
- connection failed;
- availability cannot be determined.

Unknown/error never disables invitations.

---

# 22. Calendar Privacy Invariant

Hard rule:

> **The scheduling engine operates on availability-only data.**

Do not expose to scheduling logic:
- event titles;
- descriptions;
- notes;
- locations;
- attendees;
- conference links;
- event bodies;
- private metadata.

Provider adapters normalize only states such as:
- FREE
- TENTATIVE
- BUSY
- OUT_OF_OFFICE
- UNKNOWN

Use least-privilege provider scope/API.

If a provider requires event-content access for a feature, reduce/omit the feature rather than expanding permissions without explicit owner approval.

Friends receive only derived availability:
- 🟢 Looks clear
- 🟡 Might be a tight fit
- 🔴 They may be busy, but no harm asking
- ⚪ Availability unavailable

Never expose actual event meaning.

---

# 23. Calendar Connection Privacy Messaging

At link time, tell the user clearly:

> **Your calendar stays private.**  
> Study Space does not read or display your event names, descriptions, locations, attendees, or notes. We only ask your calendar provider whether a time slot is available or unavailable so we can suggest good study times. Your friends never see your calendar.

Suggested bullets:
- We check availability only
- We do not read event titles
- We do not read descriptions or notes
- We do not read locations
- We do not expose your calendar to friends
- Friends only receive an availability result
- Calendar access can be disconnected at any time

---

# 24. Busy / Free / Out-of-Office Semantics

Where provider API exposes availability directly:
- Busy → Red
- Out of Office → Red
- Tentative → Yellow
- Free → available

Privacy tradeoff:
If determining that an explicit “Free” event exists requires reading event metadata, do not read it. Trust the provider free/busy boundary.

---

# 25. Meal Preferences

Allow personal settings:
- Preferred lunch time
- Preferred dinner time

These are preferences, not fake calendar events.

For the user making the invite:
- own meal overlap → Yellow;
- explain why to that user.

For another person:
- do not reveal their exact meal preference/reason unless explicitly shared;
- expose only derived availability.

Meal overlap alone should not create Red.

---

# 26. Calendar Failure / Reauthentication Notifications

If availability could not be checked because target user lacks a working calendar connection, the affected user may receive a private notification.

Wording must never imply a friend saw/accessed the calendar.

Better examples:
- “We couldn’t check your availability for a recent study invite because no calendar is connected.”
- “Someone tried to coordinate a study time with you, but your availability couldn’t be checked.”
- “Study Space couldn’t verify your availability because your calendar connection needs attention.”
- “Your calendar connection needs a refresh before we can check availability again.”
- “Want better study-time suggestions? Connect a calendar so Study Space can tell friends when you’re generally free — never what your events are.”

Potential internal reasons:
- calendar_not_connected
- calendar_auth_expired
- calendar_permission_revoked
- calendar_provider_error
- calendar_sync_stale

Each reason should use a rolling microcopy pool.

---

# 27. Unified Calendar — Future Feature

Provider abstraction concept:

`CalendarProvider`

Capabilities:
- connect/disconnect;
- get calendars;
- get free/busy intervals;
- create/update Study Space session events where permitted.

Potential providers:
- Google Calendar
- Apple Calendar / appropriate availability interface
- Outlook / Microsoft Graph if practical

Unified calendar can show connected calendars and Study Space sessions.

Availability engine still uses free/busy only.

---

# 28. Smart Same-Day Slot Suggestions

When duration/start time changes, rank same-day candidate windows.

Example:
- 4:00–5:00 PM → Green
- 6:30–7:30 PM → Yellow
- 8:00–9:00 PM → Red

Red never greys out the friend or disables asking.

All conversational status copy uses rolling variants.

---

# 29. Scheduled Room-Entry Experience

If users join a scheduled study room within a configurable window, e.g. ±30 minutes, show a lightweight playful entry prompt.

Example:

> Chapter 4 grind starts now.  
> Ready?

Possible rotating positive responses:
- READYYYY
- Lock me in
- Unfortunately yes
- Let's cook

Possible playful negative responses:
- nooo
- five more minutes
- my brain has left the chat
- absolutely not

Follow-up rotating lines:
- “Grab the coffee. You're going in.”
- “Monster acquired? Excellent.”
- “Motivation optional. Attendance mandatory.”
- “We respect the honesty. Entering anyway.”

Then proceed into room.

This is flavor only:
- never traps the user;
- Back/navigation remains available.

---

# 30. Future Landing Page

Full marketing/landing page is intentionally deferred until:
- final UI is polished;
- representative screenshots exist;
- room experience is stable;
- current UX issues are resolved.

---

# 31. Immediate Stabilization Scope vs Future Features

## Fix before Phase 09
- login page redesign
- provider logos / auth-button polish
- Google One Tap
- post-login → `/home`
- Account desktop-density redesign
- provider rows
- device summaries + friendly names
- baseline account deletion
- global desktop layout shell
- Home hero replacement
- Home social/dashboard composition
- room-card redesign
- footer/bottom-bar behavior
- My Rooms responsive grid
- ultrawide/layout-width preference
- manual room grid columns
- background preview/reveal
- room card direct navigation
- room-detail/settings redesign
- room metadata corrections
- contextual Back navigation
- contextual right-side panes
- Create/Edit room polish
- Study Space branded dropdown/select design
- shared responsive/design-system cleanup

## Larger future capabilities
- direct friend messaging
- notification center
- study-session invitations / RSVP
- scheduled room-entry experience
- dynamic microcopy platform
- calendar provider integrations
- privacy-preserving availability engine
- meal preferences
- same-day smart slot suggestions
- unified calendar
- calendar connection/re-auth notifications
- full 2FA / OTP / magic-link / passkey identity expansion
- social bonding / mini-games

---

# 32. Critical UX Consistency Rules

1. Use correct title casing for room privacy/roles.
2. Correct singular/plural grammar (`1 member`, `2 members`).
3. Never confuse membership count with online count.
4. Use same room terminology everywhere.
5. Whole room cards behave consistently everywhere.
6. Settings actions never accidentally trigger room entry.
7. Desktop uses available space intentionally.
8. Tablet/mobile remain touch-friendly.
9. Do not fabricate unavailable device/provider/calendar details.
10. Never expose private calendar content to friends or scheduling engine.
11. User-tailored conversational copy comes from rolling variant pools.
12. Security/legal/destructive text remains stable.
13. No future feature weakens accepted server-authoritative auth/permission model.

---

# 33. Suggested Next Workflow

1. Continue reviewing remaining pages/screens.
2. Append newly discovered issues to this document.
3. Convert the “Fix before Phase 09” section into one focused Codex stabilization prompt.
4. Perform visual/product QA on desktop, tablet, mobile, and ultrawide.
5. Run full accepted regression/security validation after stabilization.
6. Only then continue to Phase 09.


---

# 34. Global Visual Direction — Liquid Glass

Study Space should move toward a modern **liquid-glass / layered translucent visual system** instead of the current flat cream/yellow-green presentation.

This is a global design-system change, not a one-page styling tweak.

## Desired visual language

- translucent surfaces that allow some background context to show through;
- controlled backdrop blur and saturation;
- subtle edge highlights/borders;
- layered depth through shadows and elevation;
- background-aware tinting where appropriate;
- glass used primarily for navigation, panels, dialogs, menus, cards, overlays and controls;
- flatter/more opaque surfaces where readability is more important;
- avoid “glassmorphism everywhere”.

The room experience should particularly benefit from this because room backgrounds can subtly influence surrounding UI rather than being hidden behind opaque surfaces.

## Performance rule

Do not spray `backdrop-filter` or animated blur across every element.

Glass effects must be used deliberately because:

- video can already be present;
- animated room backgrounds may already be present;
- multiple translucent/blurred composited layers can become expensive;
- lower-powered mobile/tablet hardware must remain usable.

Provide cheaper/more opaque fallbacks where required.

---

# 35. Theme System — Light / Dark / System

Add an accessible appearance preference:

- System
- Light
- Dark

## Requirements

- default to System;
- persist per device/user preference;
- react live if the OS/system appearance changes while in System mode;
- avoid flash-of-wrong-theme during initial render;
- use real theme tokens, not simple color inversion;
- ensure accessible contrast in every mode.

Also account for platform accessibility preferences where possible:

- `prefers-reduced-motion`
- `prefers-reduced-transparency`
- `prefers-contrast`

For reduced transparency, glass surfaces should fall back to a more opaque version of the same design.

---

# 36. Color-System Redesign

The current yellowy / yellow-green cast should be replaced with a more neutral and deliberate design system.

Desired structure:

- neutral light-mode base;
- neutral/darker charcoal or navy-adjacent dark-mode base;
- one recognizable Study Space accent;
- semantic success/warning/error colors;
- room/background colors may subtly influence translucent surfaces;
- no hardcoded color values scattered throughout components.

Design tokens should conceptually include:

- page/background surface;
- glass surface;
- elevated glass surface;
- primary text;
- secondary text;
- muted text;
- border/highlight;
- accent;
- success;
- warning;
- danger.

The exact final palette can be chosen during implementation after reviewing the selected visual references.

---

# 37. Approved Motion / UI Inspiration Sources

Approved inspiration sources:

- `animejs.com`
- `reactbits.dev`
- `uiball.com`

These are **inspiration/reference sources**, not blanket dependency approvals.

## Anime.js

Anime.js is appropriate as the primary advanced motion toolbox where native CSS/View Transitions are insufficient.

Good use cases:

- coordinated route transitions;
- card/background reveal;
- springy micro-interactions;
- timelines;
- responsive motion;
- staggered list insertion;
- room-entry motion;
- drag/snap enhancements where appropriate.

Use modular imports and avoid animation spaghetti.

## React Bits

Study Space is Nuxt/Vue, not React.

React Bits should primarily be used as a **visual/motion reference**, not as a reason to introduce React.

Relevant inspiration includes restrained versions of concepts such as:

- Glass Surface
- Fluid Glass
- Reflective Card
- Spotlight Card
- Pill Nav
- Dock
- Animated List
- Fade/Animated Content
- Gradual Blur
- Border Glow
- Magnet
- tasteful navigation/hover effects

Avoid overly flashy effects in core product UI, such as:

- Galaxy
- Lightning
- Ballpit
- Hyperspeed
- aggressive 3D tilt
- shader-heavy visual spectacle
- excessive cursor gimmicks

The product target is:

> **quiet glass + small delightful motion**

not a portfolio/demo-effects site.

## UI Ball / LDRS

Use UI Ball-style loader inspiration for a small standardized loader set.

Potential mapping:

- generic navigation/loading → subtle Ring / Squircle-style loader;
- calendar availability checking → Dot Pulse / Line Wobble-style loader;
- RTC connecting → subtle connection/ring loader;
- media buffering → compact spinner;
- background processing → simple line/ring loader.

Do not use a different random loader for every feature.

---

# 38. Motion Design Tokens

Create a small motion-token system rather than allowing every component to invent timing/easing.

Conceptual timing:

- micro: ~120–160 ms
- quick: ~180–220 ms
- standard: ~240–320 ms
- expressive: ~350–500 ms

Conceptual easing tokens:

- standard
- enter
- exit
- soft spring
- interactive spring

All motion must respect reduced-motion preferences.

---

# 39. Global Route Transitions

Current navigation is often instantaneous, but it feels like the page was simply swapped rather than the user **entered another part of the application**.

Study Space should introduce route-transition continuity.

## Desired navigation model

When the user navigates:

1. navigation starts;
2. a liquid-glass transition layer/veil appears;
3. critical first-frame assets/data for the destination are prepared;
4. a short minimum transition duration is satisfied;
5. the already-prepared destination page is revealed;
6. the glass layer softly clears/recedes.

The goal is spatial continuity, not artificial slowness.

## Precache / first-frame preparation

Before reveal, prepare only what is necessary for a stable first frame:

- route JS/component chunk;
- critical page data;
- authenticated account/navigation state;
- essential fonts already needed;
- primary visible room-card thumbnails/background thumbnails;
- required UI components.

Nonessential/below-the-fold content should remain lazy-loadable.

Do not block navigation while trying to cache absolutely everything.

---

# 40. Transition Timing

Do **not** deliberately hold a ready page for 0.5–3 seconds.

A multi-second fake wait would eventually make the application feel slow despite being technically fast.

Preferred behavior:

- short minimum visual duration, roughly 350–600 ms;
- a slightly variable/organic minimum such as ~350–650 ms or ~400–800 ms is acceptable;
- if genuine loading takes longer, the transition stays visible for the real load duration;
- do not add extra fake delay after the page is ready;
- actual long loading should eventually transition to useful retry/error feedback.

This preserves the feeling of “entering” a page without punishing responsiveness.

---

# 41. Route Transition Visual Language

Preferred route transition:

- current page subtly dims/softens;
- liquid-glass veil moves forward;
- standardized loader appears;
- destination mounts/prepares underneath;
- glass clears/recedes;
- new page settles in.

Avoid:

- blank white screen;
- generic OS spinner;
- abrupt DOM replacement.

The transition should reinforce Study Space's spatial metaphor: rooms, spaces, people and movement through the application.

---

# 42. Context-Specific Navigation Motion

Not every navigation should use the exact same transition.

## Standard route changes

Examples:

- `/home` → `/my-rooms`
- `/home` → `/friends`
- `/account` → `/home`

Use:
- restrained glass veil;
- short loader;
- soft reveal.

## Entering a room

Entering a room may use a richer contextual transition.

Preferred concept:

- room-card/background preview begins expanding/spreading;
- the selected room background grows into the viewport;
- transition resolves into the actual immersive room background.

This should feel like **entering the room**, not opening another settings page.

## Leaving a room

Can use a restrained reverse/contraction transition.

## Details/settings navigation

Opening room details/settings should use something lighter:
- fade;
- slight slide;
- restrained glass transition.

## Local interactions

Do **not** invoke full-page navigation transitions for:

- Pomodoro
- Tasks
- Chat
- Background
- Media
- More
- dropdowns
- dialogs
- local panels

These interactions should remain immediate and use local micro-motion only.

---

# 43. Standardized Navigation Loader

Use one primary Study Space navigation loader design.

Possible direction:

- subtle ring/squircle-like animation;
- positioned on a translucent glass layer;
- optionally accompanied by a small Study Space mark/text where tasteful.

Do not make page navigation look like a Windows/system loading spinner.

Loader design should integrate with:

- light mode;
- dark mode;
- reduced transparency mode;
- reduced motion mode.

For reduced motion:
- use a short opacity transition or very low-motion indicator rather than scale/distortion.

---

# 44. Global Motion Principle

The design goal is:

> “I entered another part of the app.”

not:

> “The DOM changed.”

Motion should communicate:
- hierarchy;
- direction;
- cause/effect;
- continuity;
- room/place identity.

It should not exist simply because an animation library makes effects possible.



---

# 45. Native OS Ecosystem Integration Strategy

Study Space should progressively integrate with useful native capabilities from each major OS ecosystem rather than reimplementing features that the platform already provides well.

The product should remain fully usable without these integrations, then expose richer behavior when a browser/OS/native client supports it.

Architectural principle:

> **Do not fight the OS. Use the excellent parts each ecosystem already provides while keeping one consistent Study Space core experience.**

Two layers should be supported:

1. **Web/PWA capabilities available now through browser/platform APIs**
2. **Deeper native integrations available later in the native-app phase**

---

# 46. Platform Capability Abstraction

Avoid scattering platform checks throughout feature code.

Introduce a capability-oriented abstraction later, conceptually:

```text
PlatformCapabilities

auth.passkeys
share.nativeShare

notifications.push
notifications.badge

media.osControls
media.hardwareKeys

display.wakeLock

video.pictureInPicture
video.systemEffects
video.continuityCamera

audio.systemEffects

system.liveActivities
system.widgets
system.appShortcuts
system.conversations
system.shareTarget
system.focusIntegration
```

Potential adapters:

```text
WebPlatformAdapter
MacOSNativeAdapter
WindowsNativeAdapter
IOSNativeAdapter
AndroidNativeAdapter
LinuxNativeAdapter
```

The UI should ask the platform what is actually available and progressively expose supported functionality.

Do not show fake toggles for platform features that Study Space cannot control.

---

# 47. Camera / Video Ecosystem Integrations

## macOS

macOS system camera effects can include capabilities such as:

- Center Stage
- Portrait
- Studio Light
- Edge Light
- Reactions
- virtual backgrounds
- Desk View
- Continuity Camera

For the web version:

- Study Space should accept the already-processed camera feed provided by the browser/OS.
- Do not recreate Apple system effects unnecessarily.
- If a capability cannot be controlled from the browser, present it as system-managed rather than pretending Study Space can toggle it.

For a future native macOS client:

- integrate with AVFoundation/system camera-effect APIs where supported;
- detect Continuity Camera;
- expose supported effects directly in Study Space media settings;
- follow system preferred-camera behavior where sensible.

Potential native Mac UI:

```text
Camera
MacBook Camera

System Effects
[ Center Stage      ON  ]
[ Portrait          ON  ]
[ Studio Light      OFF ]
[ Reactions         ON  ]

Continuity Camera
iPhone
```

## Windows

On supported Windows 11 hardware, Windows Studio Effects may provide:

- Background Blur
- Eye Contact
- Automatic Framing
- Voice Focus
- Portrait Light
- Creative Filters
- Teleprompter Eye Contact

For the web version:

- if the OS applies these effects before the camera reaches the browser, Study Space should simply use the processed feed;
- do not duplicate those effects badly;
- if direct browser control is unavailable, label them system-managed.

For a future native Windows app:

- detect compatible effects;
- expose native controls when the platform API allows it.

## Android

Android camera capabilities vary heavily by device/vendor.

Study Space should:

- consume the best processed stream the browser/native camera stack provides;
- avoid assuming one universal Android effect set;
- surface vendor/system enhancements only when reliably exposed.

Do not promise live conferencing camera effects merely because a still-capture CameraX extension exists.

---

# 48. Native Audio / Microphone Integrations

Where the OS provides microphone processing or voice modes, Study Space should prefer native capabilities rather than recreating poor approximations.

Potential integrations include:

- macOS microphone modes;
- Windows Voice Focus / Studio Effects;
- platform echo cancellation/noise suppression;
- platform beamforming / microphone-array processing;
- native device routing.

For the web version:

- use browser/WebRTC constraints and receive OS-processed audio where applicable;
- expose only controls Study Space can actually influence.

For native apps:

- integrate directly with platform audio-session/device APIs;
- detect system processing capabilities;
- allow system-managed vs Study-Space-managed processing to coexist clearly.

---

# 49. Passkeys / Platform Authentication

Future identity work should support passkeys using the platform's native authentication experience.

Examples:

- Touch ID
- Face ID
- Windows Hello
- Android Credential Manager
- security keys

The browser/native platform should handle biometrics.

Study Space must never receive biometric data itself.

Passkeys fit naturally into the future identity/security expansion already planned.

---

# 50. Native Share Integration

Use OS sharing surfaces whenever available.

Examples:

- Apple share sheet
- Android Sharesheet
- Windows share UI
- compatible browser Web Share API

Useful Study Space actions:

- Share room
- Share invite
- Share scheduled study session
- Share public profile/room link where appropriate

Avoid building a giant custom “WhatsApp / Discord / Mail / Messages” picker if the OS can already provide a better share surface.

---

# 51. Share Target Integration

Where supported, an installed Study Space PWA/native app may become a share target.

Example:

A user shares a YouTube URL from another app into Study Space and receives:

```text
Add to:

○ Personal Study Player
○ Shared media in Studyyyyy
```

This can later extend to:

- images/backgrounds;
- links;
- documents;
- media URLs;
- room resources.

Always validate shared content before use.

---

# 52. OS Media Controls

The Personal Study Player should integrate with the operating system's media controls where supported.

Potential surfaces:

- keyboard media keys;
- Bluetooth headset controls;
- macOS Control Center;
- Windows media controls;
- Android lock-screen controls;
- compatible mobile/browser media surfaces.

Study Space should publish appropriate media metadata and support:

- play
- pause
- seek
- next/previous where meaningful

This is especially relevant to Phase 09 Personal Study Player.

---

# 53. Wake Lock / Keep Screen Awake

Study Space can offer a user-controlled setting such as:

```text
Keep screen awake while studying
[ ON ]
```

Potential use cases:

- Pomodoro
- long study sessions
- desk-side room display
- shared timer

Requirements:

- opt-in/user-controlled;
- clearly mention battery impact where appropriate;
- release the wake lock when no longer needed;
- degrade gracefully when unsupported.

---

# 54. Picture-in-Picture

Use Picture-in-Picture where supported for appropriate Study Space media.

Possible targets:

- expanded participant camera
- screen share
- personal media playback
- native video call surfaces later

Do not force PiP where the browser/platform cannot support the source cleanly.

Native Android/iOS/macOS/Windows clients can later use richer system PiP capabilities.

---

# 55. Push Notifications and App Badges

Web/PWA support should be used where available before native apps exist.

Potential notifications:

- friend request
- DM
- room invite
- study-session invite
- RSVP
- session starting soon
- calendar connection problem

Where supported:

- show app icon badge/unread count;
- integrate naturally with OS notification settings;
- respect Focus / Do Not Disturb behavior;
- never bypass OS notification permissions.

---

# 56. Apple Live Activities / Dynamic Island / Widgets — Future Native Feature

A future native Apple client could make excellent use of Live Activities.

Potential Study Space Live Activity:

```text
Physics Grind
37:42 remaining
3 friends studying
```

Possible surfaces:

- Lock Screen
- Dynamic Island
- Apple Watch Smart Stack
- Mac menu bar
- Home Screen / other Apple-supported activity surfaces

Potential scheduled-session activity:

```text
Chapter 4 Grind
Starts in 12 min
3 going
```

Possible native actions:

- Pause timer
- Resume
- Open room
- Join room

This should be treated as a future native-app enhancement, not a dependency for the browser product.

---

# 57. Apple App Intents / Shortcuts / Control Center — Future Native Feature

Potential future integrations:

```text
Siri
“Start my Study Space timer”

Action Button
→ Start Focus Session

Control Center
→ Focus / Pomodoro control

Shortcut
→ Join last room
```

Possible uses:

- start/pause Pomodoro;
- join last room;
- open scheduled session;
- create quick study session;
- toggle selected study state.

Only expose actions that are safe and predictable when invoked outside the full app UI.

---

# 58. Android Native Ecosystem — Future Feature

Potential native Android integrations:

- Credential Manager / passkeys
- Android media controls
- native Picture-in-Picture
- Android Sharesheet
- app shortcuts
- rich notifications
- conversation notifications
- Conversation Widgets
- platform share targets

The future DM system is particularly well suited to Android's conversation surfaces.

A friend conversation could become a first-class OS conversation rather than every DM appearing as a generic Study Space notification.

---

# 59. Linux Desktop Integration — Future Feature

A future Linux desktop client should integrate with common freedesktop standards where possible instead of targeting one desktop environment only.

Potential integrations:

- MPRIS media controls
- XDG Desktop Portals
- native file chooser
- notifications
- desktop share/open flows
- protocol/deep-link handlers

Maintain graceful behavior across GNOME, KDE and other environments.

---

# 60. Device Capability UI

Future Settings may expose a device-specific capability panel.

Example:

```text
This Mac

✓ Passkeys
✓ Native sharing
✓ Notifications
✓ Media controls
✓ Continuity Camera
✓ Center Stage
✓ Portrait
✓ Studio Light
✓ Reactions

○ Live Activities
  Requires native app

○ App Shortcuts
  Requires native app
```

Requirements:

- show only capabilities Study Space can detect reliably;
- distinguish `Supported`, `System-managed`, `Unavailable`, and `Requires native app`;
- do not fabricate support from OS name alone;
- do not imply browser control when the feature is only OS-managed.

---

# 61. Progressive Enhancement Rule

Every OS integration must follow this hierarchy:

1. Core Study Space workflow works everywhere.
2. Detect capability.
3. Enhance experience if available.
4. Clearly indicate system-managed features.
5. Gracefully fall back when unsupported.
6. Never weaken privacy/security for platform convenience.

Native integrations should enhance the product, not fork Study Space into separate product experiences per OS.


---

# 62. Friends Page — Full Social Surface Redesign

The current `/friends` page should be redesigned around the future social architecture instead of remaining a narrow settings-like page.

Current problems:

- narrow tablet/iPad-like desktop composition;
- oversized hero treatment;
- presence/privacy controls dominate the page;
- native-looking dropdowns;
- weak social hierarchy;
- empty friend state feels administrative rather than social.

Desired desktop structure:

```text
Friends                                      [ Add friend ]

[ Search friends / username ]

┌───────────────────────┬─────────────────────────────────────┐
│ Friends               │ Selected friend / social context    │
│                       │                                     │
│ ● Jerome              │ Jerome                              │
│   In Physics Grind    │ Online · Studied together recently │
│                       │                                     │
│ ○ Sarah               │ [ Message ] [ Invite to room ]      │
│   Offline             │                                     │
│                       │ Recent shared rooms                  │
│ + Pending requests    │ ...                                 │
│ + Blocked people      │                                     │
└───────────────────────┴─────────────────────────────────────┘
```

On smaller screens, collapse into list → selected-friend detail while preserving good touch behavior.

Presence/privacy settings should live primarily under Account / Privacy / Presence instead of dominating `/friends`.

---

# 63. Dedicated Direct-Messaging / Chat Surface

Future personal messaging should live in a dedicated `/chat` experience rather than being forced into `/friends`.

Desired desktop model:

```text
Chats
┌───────────────────────┬──────────────────────────────────────┐
│ Search                │ Jerome                               │
│                       │ Online                               │
│ Jerome             2  │──────────────────────────────────────│
│ Sarah                 │                                      │
│                       │        message history               │
│                       │                                      │
│                       │──────────────────────────────────────│
│                       │ [ Message... ]               [ Send ]│
└───────────────────────┴──────────────────────────────────────┘
```

Potential routing:

- `/chat`
- `/chat/@username`

Future capabilities:

- unread counts;
- presence;
- room-invite cards;
- study-session invitation cards;
- blocked-user enforcement;
- contextual friend actions;
- responsive/mobile chat layout.

---

# 64. Public Username + Stable Internal Identity Model

Accounts should separate:

```text
internalUserId
username
displayName
```

Internal ID is permanent, opaque and authoritative for relationships/ownership/messages/blocks.

Username is unique, user-facing, changeable under rules, and suitable for profile/chat URLs and friend search.

Display name is human-readable and non-unique.

Prefer human-facing routes such as:

```text
/u/pratham
/chat/@pratham
```

rather than exposing raw UUIDs in normal UI.

---

# 65. Username Rules and Account Editing

Account settings should include a clear username editor.

Rules to define:

- case-insensitive uniqueness;
- normalization;
- reserved names;
- min/max length;
- allowed characters;
- impersonation protections;
- rate limits;
- old-URL behavior.

Username must never become the database identity.

---

# 66. First-Run Onboarding Flow

New users should not be dropped directly into the app after OAuth.

Recommended steps:

1. Identity
   - display name
   - username with inline availability check
2. Appearance
   - System
   - Light
   - Dark
3. Layout
   - Auto
   - Compressed
   - Full-width
   - integrate ultrawide choice here when relevant
4. Optional defaults
   - only genuinely useful first-run choices

Do not overload onboarding with permissions/settings that can wait.

---

# 67. Central Onboarding / Prompt Coordinator

Introduce a coordinator/state machine so users are not bombarded by unrelated first-run prompts.

Conceptual buckets:

```text
required:
  username

recommended:
  appearance
  layout

deferred/contextual:
  notifications
  calendar
  passkey
  microphone
  camera
  native app
```

Contextual permissions should be requested only when relevant.

---

# 68. Resume-Safe and Versioned Onboarding

Persist onboarding progress and version it.

Example:

```text
onboardingVersion: 1
completed:
  identity: true
  appearance: false
  layout: false
```

Existing users who predate usernames should get a lightweight username setup, not silent public-handle assignment.

---

# 69. Discover Page — Full Browse Surface Redesign

`/discover` needs a real browse/discovery layout rather than a narrow tablet-like column.

Desired:

- wide desktop layout;
- integrated search;
- filter bar/chips;
- customizable room grid;
- contextual side pane on wide screens;
- same shared RoomCard component.

Useful filters:

- Online now;
- Friends here;
- Friends studying;
- Member count;
- Current online count;
- Recently active;
- Recently created;
- topic/tags later.

Sorting:

- Recommended;
- Most active now;
- Friends here;
- Recently active;
- Newest;
- Largest;
- Smallest.

Membership count and current occupancy must remain separate concepts.

---

# 70. Global Search-Control Pattern

All pages with search should stop using a separate full-size Search button below the field.

Use one integrated search control:

```text
[ 🔍 Search public rooms...                  ]
```

or:

```text
[ 🔍 physics                         ×   ↵   ]
```

Requirements:

- integrated search icon;
- trailing submit/action icon where needed;
- Enter submits;
- clear `×`;
- live/debounced behavior where appropriate;
- loading indicator can appear inside field;
- consistent liquid-glass styling.

Reuse across Discover, Friends, My Rooms, Chat, member/invite search and future settings search.

---

# 71. Apple-Inspired Product Design Direction

Target:

> Studyverse-style product architecture + Apple-inspired UX discipline + liquid-glass visual language + Study Space's own identity.

Principles:

- clarity over decoration;
- depth/material over giant flat cards;
- translucent/frosted layers;
- content-first layouts;
- restrained shadows;
- deliberate motion;
- strong hierarchy;
- fewer visible borders;
- compact integrated controls;
- contextual sheets/popovers;
- responsive whitespace without wasted space.

Do not literally clone macOS/iOS.

---

# 72. Global Navigation — Executive Direction

Replace the current full-width text-heavy top bar with an adaptive floating liquid-glass navigation system.

Desktop/laptop:

- floating left-side icon-first rail;
- fixed while content scrolls;
- active destination shown with soft material/tint;
- labels on hover/focus/expanded state.

Primary destinations:

- Home
- Rooms
- Friends
- Discover
- Chat once DMs ship

Profile/avatar sits at the bottom and opens account/settings actions.

Remove `Account & devices` from primary navigation.

Mobile:

- floating bottom glass tab bar.

Tablet:

- adapt based on actual width rather than device class.

Inside immersive rooms, hide global nav and use room-specific chrome.

---

# 73. Room — Participant Status Badges

Remove verbose status text such as `Mic off` beneath avatars.

Use avatar-overlay status badges:

- top-right → muted mic;
- bottom-right → presence;
- subtle speaking ring/glow;
- additional camera/share states only where useful.

Keep tooltips and screen-reader labels.

---

# 74. Room — Atmosphere Text Must Survive Zoom / Reflow

Keep the room quote/caption, but treat it as responsive foreground UI rather than fragile background composition.

Requirements:

- viewport-safe anchoring;
- browser zoom must not hide it;
- responsive typography;
- clamp position/width;
- reflow instead of disappearing;
- subtle contrast haze/gradient where needed.

---

# 75. Room — Live Participant Presence Regression

Observed:

- two distinct Google accounts were simultaneously in the same room;
- second user's chat messages arrived;
- only one user appeared in the participant rail.

This indicates realtime room transport works while participant presence/rendering is incorrect.

Expected:

- each connected participant appears exactly once;
- current user marked `You`;
- join/leave/reconnect state remains correct;
- live presence and participant rail agree;
- membership count remains separate from live presence.

Add a two-client regression test.

---

# 76. Room — Compact Top Identity Header

Redesign the current verbose room header into a compact floating glass identity control.

Requirements:

- back action;
- room name as primary content;
- short privacy label (`Unlisted`, `Private`, `Public`);
- separate Invite action;
- remove redundant word `Room`;
- no harsh divider;
- native-titlebar-like proportions;
- advanced actions behind menus where appropriate.

---

# 77. Productivity Pane → Independent Modular Cards

Retire the combined right-side productivity pane.

Split into four independent floating liquid-glass cards:

1. Pomodoro
2. Tasks
3. Chat
4. Clock

If a temporary combined control remains, rename `Hide panels` to something accurate like `Hide productivity pane`.

---

# 78. Room Card Density and Control Hierarchy

Current productivity UI is too touch-oriented and button-heavy for desktop.

Requirements:

- tighter desktop spacing;
- adaptive touch density;
- primary/secondary/tertiary action hierarchy;
- fewer equal-weight rounded buttons;
- consistent spacing;
- use typography/material rather than borders for hierarchy.

`Personal / Shared` becomes a single animated segmented control.

---

# 79. Pomodoro — Main Control Redesign

Visible Pomodoro card should prioritize:

- Personal/Shared segmented control;
- cycle/mode state;
- timer;
- stop/reset;
- skip;
- play/pause;
- completed-focus tally;
- settings access.

Preferred control arrangement:

- left of timer → square stop/reset icon;
- right → play/pause icon;
- between them → long Skip arrow control.

Skip animation:

- arrow travels left→right;
- wraps back to left;
- loops roughly twice;
- returns to initial position;
- respects reduced-motion.

Cycle/focus state should be much more prominent than the verbose private-description text.

---

# 80. Pomodoro Settings — Immediate-Save Glass Popover/Sheet

Replace the current expanded settings form with a clean glass settings popover/sheet.

Mode selector:

- Focus
- Short Break
- Long Break

Edit duration with a prominent value and up/down arrows.

Changes save/apply immediately.

Remove ordinary Save button.

---

# 81. Pomodoro — Timer Visualization Styles

Support visual timer styles such as:

- Default digital
- Flip clock
- Progress bar
- Gauge
- Dot matrix
- Pie

Use visual preview cards instead of a text dropdown.

---

# 82. Pomodoro — Alert Sounds and Runtime

Timer settings should support selectable alert sounds with preview and volume.

Examples:

- Sparkle
- Train Arrival
- Commuter Jingle
- Game Show
- Airport
- Soft
- Chime
- Piano
- Success
- Level Up
- Applause
- No Alert

Sound preference persists regardless of Personal vs Shared timer.

Personal timer runtime:

- fixed duration;
- until dismissed.

Shared timer runtime:

- owner-controlled.

---

# 83. Pomodoro — Visual Alert Effect

When a timer segment ends, complement sound with a visual room alert:

- soft bright vignette/bloom;
- room-aware tint;
- noticeable but not harsh;
- accessible reduced-motion/intensity behavior.

---

# 84. Pomodoro — Completed Focus Session Tally

Track completed focus blocks and show a compact completed-session tally.

Initial display can be simple, with future daily/weekly analytics later.

---

# 85. Clock Card

Add a dedicated Clock card separate from Pomodoro.

Support:

- 12h / 24h;
- flip clock;
- show seconds;
- show greetings;
- dynamic greetings;
- visual clock/font styles.

Potential styles:

- Default Bold
- Default Thin
- Minimal
- Serif
- Handwritten
- Minimal Light

Use visual previews.

---

# 86. Modular Draggable Room Cards + Right-Third Snap Layout

Pomodoro, Tasks, Chat and Clock should be independent draggable cards.

Requirements:

- smooth drag/lift;
- stay within viewport;
- positions persist;
- independent collapse/hide.

When dragged into the right third:

- show snap targets;
- preview landing slot;
- release docks into structured position;
- spring into place.

Initial implementation can use a vertical snap column.

---

# 87. Ambient / Presentation / Projector Mode

Add a room mode for wall projection, ambient display and minimal-focus use.

Presets:

- Standard
- Minimal
- Ambient
- Projector
- Custom

Allow selective visibility of:

- participant rail;
- room header;
- quote;
- Clock;
- Pomodoro;
- Tasks;
- Chat;
- bottom dock.

Reveal via:

- keyboard shortcut;
- mouse move;
- edge hover;
- click/tap hotspot.

Projector behavior can include larger clock/timer scaling, stronger contrast and optional cursor auto-hide.

---

# 88. Tasks Card — Inline Entry Model

Remove the separate `Add task` step/button.

Use the task row itself as entry:

```text
Tasks                         0/0

☐ Add new task…
```

Behavior:

- Enter confirms;
- optional tick confirms;
- Esc cancels.

Show completed/total indicator such as `2 / 5`.

Rows include checkbox + text, with edit/delete/reorder actions shown contextually.

---

# 89. Chat Card — Compact Conversation UI

Room Chat should feel like a real chat surface.

Keyboard behavior:

- Enter → send;
- Shift+Enter → newline.

Composer:

- integrated field;
- small send-arrow icon;
- no chunky separate Send button.

Delete behavior:

- replace full Delete button with small `×` on far right of hovered/selected own-message row;
- tooltip/accessibility label `Delete message`.

Use quieter timestamps and subtle deleted-message tombstones.

---

# 90. Room Bottom Dock — Native-Style Icon and State Redesign

Use consistent native-style icons inspired by Apple/SF Symbols semantics.

Preferred controls:

- Media → music/media;
- Background → photo/landscape;
- Microphone → actual mic;
- Camera → video camera;
- Screen Share → display/share;
- More → horizontal ellipsis.

Microphone states:

- muted → slashed mic;
- enabled/silent → normal mic;
- speaking → animated level ring/waveform;
- clipping → warning;
- device/permission issue → error.

Feedback should reflect actual local input level.

Camera and screen-share controls should also have clear active/error states.

Dock becomes a tighter floating liquid-glass control surface.

---

# 91. More → Proper Room Settings Surface

Replace the current long raw `More` panel with a polished settings sheet.

Preferred desktop structure:

```text
Room Settings
┌───────────────────────┬──────────────────────────────────────┐
│ Categories            │ Selected category                    │
│ Media & Devices       │                                      │
│ Quality               │                                      │
│ Audio                 │                                      │
│ Camera                │                                      │
│ Appearance            │                                      │
│ Room & Privacy        │                                      │
│ Notifications         │                                      │
│ Diagnostics           │                                      │
└───────────────────────┴──────────────────────────────────────┘
```

Use branded controls, immediate-save behavior, and progressive disclosure.

Technical requested-vs-actual diagnostics live under Diagnostics.

---

# 92. Room Appearance — Liquid Glass Opacity

Room settings should include:

- Auto glass opacity;
- manual opacity slider.

Auto is the recommended/default mode and adapts to:

- room background;
- theme;
- text legibility.

Reduced-transparency preferences should force/favor more opaque material.

---

# 93. Media Surface — Full Consumer-Facing Redesign

Clicking Media should open a polished floating Media sheet rather than a narrow form-heavy pane.

Main surface should prioritize:

- Now Playing;
- Up Next;
- Add media;
- playback controls;
- Room vs Personal scope;
- ambience mixer.

Avoid exposing synchronization/provider internals.

---

# 94. Media — Now Playing + Queue

Now Playing should show:

- thumbnail;
- title;
- provider;
- duration;
- seek/progress;
- play/pause;
- previous/next where appropriate;
- optional `Show video`.

Queue should be a readable ordered list with contextual reorder/remove actions.

Remove typed seek seconds and raw queue/debug controls.

---

# 95. Media — Resolve Metadata Instead of Exposing Video IDs

When a YouTube URL is added:

- parse provider ID internally;
- resolve title;
- resolve thumbnail;
- resolve duration where available;
- optionally show uploader/channel.

Raw provider IDs belong only in Diagnostics.

---

# 96. Media — Up Next / Next-in-Queue Tile

Add visible Up Next / next-in-queue UI with title, thumbnail and duration.

This should make progression obvious without exposing internal IDs.

---

# 97. Media — Room vs Personal Scope

Use a clear segmented control:

```text
[ Room ] [ Personal ]
```

Room = authoritative shared controls permitted to the user.

Personal = local listening preferences such as:

- mute room media locally;
- personal media level;
- personal ambience level.

Suggestion-only/read-only behavior should reflect accepted Phase-08 permissions.

---

# 98. Media — Ambience Mixer

Replace the permanent wall of identical sliders with an active-channel mixer.

Show active sources prominently and use `+ Add ambience` to add Rain / White / Pink / Brown noise etc.

Shared-mix changes should apply live with appropriate debounce/throttle.

Remove ordinary `Apply shared mix`.

---

# 99. Media — Permissions Behind Secondary Settings

Keep accepted Phase-08 media-authority behavior, but move it behind secondary settings instead of exposing it on the everyday player.

Preserve:

- owner baseline;
- suggestions;
- moderator/owner/everyone modes;
- temporary/FFA behavior;
- owner-return semantics.

---

# 100. Media — Playback Renderer Is Separate From Playback State

The visible YouTube tile is optional presentation, not the owner of logical playback.

Desired:

- shared playback can continue without visible tile;
- `Show video` opens/focuses visual renderer;
- hiding/minimizing/closing visual tile should not pause shared playback where technically possible;
- reopening joins current shared position.

---

# 101. YouTube — Remove Repetitive Provider Enablement Workflow

Current workflow is too cumbersome:

```text
Media
→ Open YouTube tile
→ Enable YouTube
→ click Play in iframe
→ click Resume YouTube
```

Desired:

```text
Media
→ paste YouTube URL
→ metadata resolves
→ item enters queue / Now Playing
→ user presses Play once if browser requires a gesture
→ shared playback begins
```

Provider enablement should not be a repeated normal user task.

---

# 102. YouTube — Audio-First Shared Playback, Optional Video

Intended behavior:

> YouTube is primarily a shared room audio/media source, with optional video rendering.

Default experience:

- title;
- thumbnail;
- queue;
- audio;
- shared play/pause/seek.

Optional:

- `Show video` opens the visual tile.

If browser autoplay blocks sound, show one clear Play/Join Playback affordance, not multiple activation steps.

---

# 103. YouTube — Current Loop/Resume Bug

Observed behavior:

1. YouTube is enabled;
2. user clicks Play inside iframe;
3. playback advances ~2 seconds;
4. player repeatedly snaps/loops back to the starting position;
5. only pressing the separate Study Space Resume action allows playback to proceed normally.

Likely class of failure:

- iframe begins locally;
- authoritative room state still says paused/stale position;
- reconciliation repeatedly seeks player back;
- Resume updates authoritative state and stops the fight.

Treat this as a Phase-08 regression.

There should be one coherent playback authority/action.

Conceptual shared state:

```text
mediaId
playbackState: playing | paused
position
playbackRate
startedAt
updatedAt
```

A Play action should:

1. authorize;
2. update authoritative room state;
3. play locally;
4. broadcast;
5. let remotes reconcile.

---

# 104. YouTube / Shared Media Regression Tests

Add explicit multi-client tests for:

- add URL and resolve metadata;
- title/thumbnail shown instead of raw ID;
- one Play action starts authoritative shared playback;
- no 0–2 second loop;
- no second Resume action;
- pause sync;
- seek sync;
- hide/reopen visual renderer while audio continues where technically possible;
- late joiner joins current playback state;
- browser autoplay-block case gets one clear Play/Join Playback affordance.

These tests should complement, not replace, the accepted Phase-08 synchronization tests.
