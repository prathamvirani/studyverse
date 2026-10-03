# Study Space — Mid-Design Refresh

This folder defines the **post-Phase-08 design, UX, reliability, and room-experience refresh** that must be completed before Phase 09 begins.

The goal is not to rewrite accepted architecture. It is to transform the current functional product into a polished, cohesive, Apple-inspired Study Space experience while preserving all accepted Phase 00–08 behavior, security boundaries, data, migrations, realtime semantics, and modular architecture.

## Current baseline

On 2026-10-02 the owner authorized unattended MID-05 → MID-06 → MID-07 → MID-08 progression with a checkpoint/report for each phase and no intervening review pause. MID-04/MID-04A, MID-05, MID-06, MID-07 and MID-08 are COMPLETE — AWAITING_REVIEW; no acceptance is invented. This explicit authorization superseded the ordinary completion stop rule for the four-phase run. The run has stopped after MID-08; Phase 09 and Docker → Podman remain NOT STARTED. See the [final report](../../reports/MID_DESIGN_REFRESH_FINAL_REPORT.md) and individual phase reports for validation, preserved data/architecture, dependency audit limits and deferred polish.

Accepted:

- Phase 00 — Foundations
- Phase 01 — Identity, Sessions, Home & Rooms
- Phase 02 — Canonical Room Shell
- Phase 03 — Presence, Friends & Invitations
- Phase 04 — Realtime Productivity
- Phase 05 — Backgrounds
- Phase 06 — Basic RTC
- Phase 07 — Advanced RTC & Quality Control
- Phase 08 — Room Media, Ambience & Shared Mix

Do **not** begin Phase 09 while this refresh is active.

## Why this work is split into phases

The refresh touches many surfaces:

- visual design system
- navigation
- authentication/onboarding
- account/device UX
- room cards
- discover/friends/social foundations
- room shell
- Pomodoro/tasks/chat/clock
- media/YouTube
- accessibility
- cross-platform/native capability planning

Doing all of this in one enormous prompt would create unnecessary exploration, regressions, duplicated work, and context loss. The refresh is therefore split into small execution phases with explicit boundaries.

## Execution order

1. `MID_00_GUARDRAILS_AND_AUDIT.md`
2. `MID_01_VISUAL_FOUNDATION_AND_SHELL.md`
3. `MID_02_AUTH_ONBOARDING_ACCOUNT.md`
4. `MID_03_HOME_ROOMS_DISCOVER_FRIENDS.md`
5. `MID_04_ROOM_SHELL_AND_WORKSPACE.md`
6. `MID_04A_OWNER_REVIEW_CORRECTIONS_AND_ROOM_STABILITY.md`
7. `MID_05_PRODUCTIVITY_CARDS.md`
8. `MID_06_MEDIA_AND_YOUTUBE.md`
9. `MID_07_ACCESSIBILITY_PLATFORM_AND_FINAL_QA.md`
10. `MID_08_NUXT4_AND_UX_MODULES.md`

Read the relevant guiding files before each phase:

- `GUIDE_APPLE_LIQUID_GLASS.md`
- `GUIDE_TYPOGRAPHY_AND_COLOR.md`
- `GUIDE_MOTION_AND_TRANSITIONS.md`
- `GUIDE_COMPONENT_AND_INTERACTION_PATTERNS.md`
- `GUIDE_ACCESSIBILITY_AND_PLATFORM.md`
- `GUIDE_QA_AND_REGRESSION.md`

`REFERENCE_CONTEXT.md` contains the consolidated product decisions and issue history. It is reference material, not an instruction to implement every future feature during this refresh.

## Non-negotiable rules

- Preserve accepted Phase 00–08 architecture.
- Do not begin Phase 09.
- Do not refactor the repository broadly unless a targeted change is genuinely required.
- Preserve the accepted feature-oriented module organization.
- Preserve server-authoritative auth, authorization, room permissions, presence, realtime state, RTC grants, and media authority.
- Preserve existing data and migrations.
- Do not replace Nuxt/Vue with React.
- React Bits is visual inspiration only.
- Anime.js may be used as a motion tool where CSS/View Transitions are insufficient.
- UI Ball/LDRS may inspire standardized loaders.
- `liquidglassdesign.com` is an approved visual-reference source.
- Apple SF / New York font files are design references only unless web redistribution rights are explicitly verified. Do not ship proprietary Apple font files merely because they exist locally.
- The site must look intentionally Apple-inspired on **Windows and Linux too**; do not rely on Apple-only system rendering.
- Use Inter as the primary cross-platform UI family.
- Use a licensed expressive serif for selected display/atmosphere text; Instrument Serif is the preferred starting point.
- Keep future features such as full DMs/calendar scheduling/native apps out of implementation unless explicitly included by the active mid-refresh phase.

## Completion discipline

For each phase:

1. Read the phase file and guiding files completely.
2. Update coordination documentation to identify the active mid-refresh phase if the repository uses such coordination.
3. Implement only the active mid-refresh phase.
4. Run focused tests while working.
5. Run the phase acceptance checks.
6. Write a short report under `docs/reports/` describing:
   - changes
   - tests
   - regressions fixed
   - deferred items
7. Stop and wait for user acceptance before beginning the next mid-refresh phase.

## MID-04A owner corrections

MID-04A is COMPLETE — AWAITING_REVIEW, authorized on 2026-10-01 against the completed MID-04 working-tree baseline. Its explicit Tasks/Pomodoro/Media corrections reconcile the named overlap with MID-05/MID-06; they do not authorize either later phase. The MID-04 report remains historical baseline evidence. See [the MID-04A report](../../reports/MID_04A_OWNER_REVIEW_CORRECTIONS_AND_ROOM_STABILITY_REPORT.md) for runtime findings, routes/invites/referrals, privacy, arrangement, popouts and validation.
