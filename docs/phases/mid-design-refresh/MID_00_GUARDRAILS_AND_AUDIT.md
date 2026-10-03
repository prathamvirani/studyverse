# MID-00 — Guardrails, Inventory & Design-System Audit

## Objective

Prepare the repository for the design refresh without changing accepted product behavior or beginning broad redesign work prematurely.

## Read first

- `docs/UMBRELLA_SPEC.md`
- `docs/ACTIVE_PHASE.md`
- `docs/PHASE_HISTORY.md`
- Phase 08 report
- codebase cleanup review
- architecture docs for room shell, RTC, realtime transport, backgrounds, media
- all guides in this folder
- `REFERENCE_CONTEXT.md`

## Tasks

### 1. Establish refresh coordination

Record that:

- Phase 08 remains accepted.
- Phase 09 has not begun.
- Active work is the Mid-Design Refresh.
- MID-00 is active.

Do not rewrite accepted phase history.

### 2. Inventory current UI primitives

Identify:

- page shells
- nav/header components
- hero-card patterns
- buttons
- select/dropdown controls
- form inputs
- dialogs/sheets
- room cards
- search controls
- segmented controls
- participant tiles
- room dock controls
- productivity panel
- media panel
- settings panel
- loaders
- typography/color tokens
- spacing/radius/shadow tokens

### 3. Identify duplicated/raw controls

Specifically locate:

- browser-native selects that visibly look like default Windows controls
- repeated giant pale hero cards
- duplicated search + button layouts
- duplicated RoomCard-like implementations
- hard-coded colors
- inconsistent spacing
- raw provider IDs/debug text leaking into user UI
- any phase-named production UI files left after semantic cleanup

### 4. Establish or extend shared primitives only where needed

Create a minimal plan for shared:

- GlassSurface
- AppRail / MobileTabBar
- IntegratedSearch
- StudySelect / Combobox
- SegmentedControl
- RoomCard
- SettingsSheet
- IconButton
- StatusBadge
- Loader
- PageHeader
- ContextPane

Do not redesign every page yet.

### 5. Baseline visual regression screenshots

Capture representative current screenshots for:

- signed-out auth
- home
- my rooms
- room detail/settings
- create/edit room
- account
- friends
- discover
- room
- media
- more/settings

These are comparison artifacts, not final marketing screenshots.

## Acceptance

- No user-visible behavior regressions.
- No migrations/data loss.
- Shared primitive plan documented.
- Existing architecture tests pass.
- Baseline test suite passes.
- No Phase 09 work begun.
