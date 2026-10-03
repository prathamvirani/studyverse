# MID-08 — Nuxt 4 Migration & UX Module Integration

## Status

Planned post-refresh maintenance phase.

This phase occurs **after MID-07 is accepted** and **before Phase 09 begins**.

Phase 08 remains the accepted product baseline until the Mid-Design Refresh is fully accepted. Phase 09 must not begin during MID-08.

## Objective

Modernize the Study Space web frontend onto Nuxt 4 and integrate a small set of mature Nuxt modules that directly improve user experience, asset delivery, icon consistency, typography, responsive behavior, and appearance handling.

This is **not** a frontend rewrite.

The goals are:

- migrate the existing Nuxt application to Nuxt 4;
- preserve the accepted Vue/Nuxt architecture and route structure;
- remove obsolete Nuxt 3 assumptions;
- improve font delivery;
- improve image delivery and responsive media presentation;
- standardize icons;
- adopt VueUse utilities where they replace fragile custom browser glue;
- consolidate appearance handling where doing so is an improvement over custom code;
- preserve the complete Mid-Design Refresh visual language;
- preserve all accepted Phase 00–08 and MID-00–07 behavior.

## Why MID-08 exists

Nuxt 4 is the current supported Nuxt major version. Nuxt 3 reached end of life on 31 July 2026.

Study Space should not continue new feature development on an unsupported Nuxt major when a controlled migration can be completed before Phase 09.

The selected modules are not being added because they are fashionable. Each must provide a concrete UX or maintainability benefit.

## Read completely before implementation

Core coordination:

- `docs/UMBRELLA_SPEC.md`
- `docs/ACTIVE_PHASE.md`
- `docs/PHASE_HISTORY.md`
- latest accepted Phase 08 report
- all accepted MID-00 through MID-07 reports

Architecture:

- `docs/architecture/CODEBASE.md`
- `docs/architecture/TRANSPORT_PLAN.md`
- foundation contracts
- identity architecture
- room architecture
- RTC architecture
- room-media architecture
- current web build/deployment configuration

Mid-refresh guidance:

- `docs/phases/mid-design-refresh/README.md`
- `GUIDE_APPLE_LIQUID_GLASS.md`
- `GUIDE_TYPOGRAPHY_AND_COLOR.md`
- `GUIDE_MOTION_AND_TRANSITIONS.md`
- `GUIDE_COMPONENT_AND_INTERACTION_PATTERNS.md`
- `GUIDE_ACCESSIBILITY_AND_PLATFORM.md`
- `GUIDE_QA_AND_REGRESSION.md`
- `REFERENCE_CONTEXT.md`

Nuxt migration references:

- current Nuxt 4 upgrade guide;
- current module compatibility documentation;
- current documentation for every module actually installed.

Do not rely on stale assumptions from older Nuxt 3 documentation.

---

# 1. Nuxt 4 Migration

## Migration goal

Upgrade the existing web workspace to Nuxt 4 while preserving application behavior.

Do not replace the current frontend architecture with a new framework.

Do not perform a broad unrelated refactor.

## Expected migration work

Audit and update where required:

- `apps/web/package.json`
- root lockfile
- `apps/web/nuxt.config.ts`
- Nuxt/Vite configuration
- TypeScript configuration
- generated Nuxt types
- plugins
- middleware
- composables
- layouts
- route behavior
- page transitions
- SSR/client-only boundaries
- runtime config
- aliases
- auto-import assumptions
- `useAsyncData` / `useFetch` usage
- hydration-sensitive code
- test harnesses
- Playwright configuration
- Docker build/runtime configuration where Nuxt-specific build behavior changes

## Preserve the current app directory model

The current repository already uses:

`apps/web/app/...`

which aligns well with Nuxt 4's app-directory direction.

Do not relocate working source files merely to make the migration look larger.

## Migration discipline

Prefer the smallest correct migration.

If an official codemod is useful, it may be used only after:

1. reviewing what it changes;
2. committing/reviewing the intended change set;
3. verifying it does not perform unrelated restructuring.

Never run a codemod blindly across the repository.

## Compatibility

All installed Nuxt modules must be verified against Nuxt 4 before acceptance.

Do not suppress module compatibility warnings without understanding them.

---

# 2. `@nuxt/fonts`

## Purpose

Use `@nuxt/fonts` to make Study Space typography reliable and performant across Windows, Linux, Android and Apple platforms.

## Typography target

Primary UI:

- **Inter**

Expressive serif:

- **Instrument Serif**

Do not bundle Apple SF or New York font files unless redistribution rights have been explicitly verified.

## Requirements

Use the module to improve:

- font discovery/delivery;
- preload behavior where useful;
- caching;
- fallback handling;
- consistent cross-platform rendering;
- avoidance of layout shift.

The final implementation must preserve the typography system established during MID-01.

Do not allow the module to silently replace the selected typefaces.

## Acceptance

- Inter reliably renders on Windows/Linux without depending on local installation;
- Instrument Serif loads only where needed;
- no visible flash/layout jump beyond reasonable browser behavior;
- no proprietary Apple fonts are shipped.

---

# 3. `@nuxt/image`

## Purpose

Improve responsive image delivery and loading for image-heavy Study Space surfaces.

## Initial candidates

Evaluate adoption for:

- room-card backgrounds;
- Discover thumbnails;
- Home room previews;
- avatars where compatible with authenticated delivery;
- background selector previews;
- YouTube thumbnails resolved during MID-06;
- future public/static visual assets.

## Requirements

Use responsive sizing rather than serving unnecessarily large files.

Prefer modern formats such as WebP/AVIF where appropriate and where image source/provider behavior supports them.

Use lazy loading for below-the-fold imagery.

Critical first-frame imagery used by route transitions or immersive room entry may require eager/preloaded handling.

Do not route private/authenticated image URLs through an optimization path that breaks authorization or leaks credentials.

Do not alter original user media semantics purely for optimization.

## Room backgrounds

Room backgrounds are visually important and may already have custom lifecycle/caching behavior.

Do not replace the accepted background model blindly.

Use Nuxt Image only where it demonstrably improves delivery without damaging:

- local uploads;
- animated backgrounds;
- procedural backgrounds;
- object URLs;
- user-owned assets;
- environment effects.

---

# 4. `@nuxt/icon`

## Purpose

Create a coherent cross-platform icon language and eliminate placeholder Unicode glyphs / inconsistent icon sources.

## Primary use cases

- global navigation rail;
- mobile tab bar;
- room dock;
- Media;
- Background;
- microphone;
- camera;
- screen share;
- More;
- account/settings;
- search;
- clear;
- room privacy;
- invite;
- playback controls;
- status badges;
- task/chat actions.

## Visual direction

Icons should follow Apple/SF-Symbol-like semantic clarity without illegally redistributing SF Symbols.

Choose a coherent web-compatible icon family or tightly controlled small set.

Do not mix unrelated visual families indiscriminately.

## Requirements

- consistent stroke/weight;
- accessible labels on icon-only controls;
- deterministic sizing;
- active/disabled/error states;
- avoid random Unicode symbols;
- no AI-generated one-off interface icons unless there is a genuine documented need.

Custom Study Space SVG icons may be added where the established icon library genuinely lacks an appropriate semantic symbol.

---

# 5. `@vueuse/nuxt`

## Purpose

Use VueUse for well-tested browser/reactivity utilities instead of maintaining unnecessary custom glue.

## Candidate uses

Evaluate existing code for appropriate replacement or future use in:

- media-query handling;
- viewport size/breakpoints;
- pointer/hover capability;
- element/resize observation;
- visibility state;
- fullscreen;
- wake lock;
- event listeners;
- click-outside behavior;
- focus helpers;
- storage wrappers where compatible with the accepted preference architecture;
- drag-related support where it does **not** replace the accepted WorkspaceHost geometry engine.

## Important boundary

Do not rewrite working architecture just because VueUse has an equivalent helper.

In particular:

- do not replace WorkspaceHost's accepted drag/resize geometry engine wholesale;
- do not replace server-authoritative state with browser storage;
- do not alter preference keys/versions casually;
- do not use VueUse `useFetch` in ways that conflict with Nuxt's own `useFetch`;
- follow documented Nuxt auto-import caveats.

Use VueUse only when it improves correctness, readability or browser compatibility.

---

# 6. `@nuxtjs/color-mode`

## Purpose

Evaluate whether `@nuxtjs/color-mode` should become the foundation for the System / Light / Dark behavior introduced during MID-01.

## Decision rule

Do **not** replace the current appearance implementation automatically.

First compare:

- current MID-01 appearance implementation;
- system-theme following;
- persistence;
- SSR/hydration behavior;
- flash-of-wrong-theme prevention;
- test coverage;
- integration with Study Space tokens;
- integration with Glass Transparency.

Adopt `@nuxtjs/color-mode` if it simplifies and strengthens the implementation without breaking the Study Space appearance architecture.

If the existing implementation is demonstrably better for the product, document the reason and do not add the module merely to satisfy a checklist.

## Required appearance behavior regardless of implementation

- System / Light / Dark;
- System reacts to OS changes;
- no obvious flash of incorrect theme;
- preference persistence;
- glass transparency remains a separate Study Space preference;
- room background itself is not recolored by theme;
- route loading surface remains opaque regardless of glass transparency.

---

# 7. Glass Transparency Compatibility

MID-08 must preserve the appearance architecture defined during the refresh.

Appearance includes:

- System / Light / Dark;
- Glass Transparency: Auto + manual adjustment;
- Page Width: Auto / Compressed / Full-width.

Glass transparency is a Study Space product setting, not something `@nuxtjs/color-mode` owns.

The module integration must not collapse these into one generic theme state.

---

# 8. Motion Compatibility

The Mid-Design Refresh intentionally uses spatially expressive motion.

Nuxt 4 migration must preserve:

- route-transition choreography;
- opaque loading cover;
- route loader;
- room-entry transition;
- navigation motion;
- sheet/popover motion;
- segmented-control motion;
- drag/snap motion;
- media/player motion.

Do not regress the app into static transitions as part of framework migration.

`prefers-reduced-motion` remains an accessibility fallback for users who explicitly request it through their OS/browser.

---

# 9. Route Loading Contract

Preserve the final refresh requirement:

1. navigation starts;
2. current route transitions away;
3. full-viewport branded transition surface becomes opaque;
4. loader appears;
5. destination critical first frame prepares while hidden;
6. completed destination reveals cleanly;
7. transition surface recedes.

Users must not watch partially loaded destination UI assemble underneath the loader.

Nuxt 4 routing changes must not break this contract.

Rapid navigation/cancellation must not leave the cover stuck.

---

# 10. Security and Privacy

Module adoption must preserve:

- HttpOnly session model;
- CSRF / Origin protections;
- authorization boundaries;
- private room/background/media access;
- CSP;
- OAuth callback behavior;
- realtime authorization;
- server-authoritative state.

Do not send authenticated/private asset URLs to third-party optimization services.

Prefer local/built-in optimization for protected content where appropriate.

Do not expose secrets through runtime configuration or module-generated client bundles.

---

# 11. Performance

Measure rather than assume improvement.

Review:

- initial client bundle;
- route chunks;
- font loading;
- image bytes;
- hydration;
- dev startup;
- production build;
- room rendering;
- route transitions.

Avoid loading every icon or utility eagerly.

Prefer tree-shakable/module-native usage.

Do not let image optimization interfere with first-frame room background presentation.

---

# 12. Testing

Run focused migration checks while working.

Before acceptance run the relevant complete regression set.

At minimum verify:

## Framework

- dev server
- production build
- SSR
- hydration
- route navigation
- middleware
- runtime config
- plugins
- composables

## Appearance

- System
- Light
- Dark
- Glass Transparency
- width modes
- no wrong-theme flash

## Navigation

- AppRail
- mobile tab bar
- profile popover
- route loader/opaque cover
- rapid navigation cancellation

## Images

- room-card images
- background previews
- responsive sizes
- missing-image fallback
- authenticated/private-image handling
- YouTube thumbnails if MID-06 already provides them

## Fonts

- Inter
- Instrument Serif
- Windows
- Linux
- production build

## Icons

- global navigation
- room dock
- controls
- accessibility names

## VueUse

- any replaced utility behavior
- SSR safety
- cleanup/disposal of listeners/observers

## Regression

- auth/session
- rooms
- social
- productivity
- backgrounds
- RTC
- room media
- Docker environment

Do not perform the Docker → Podman migration during MID-08 unless separately authorized.

---

# 13. Documentation

Create:

- `docs/reports/MID_08_NUXT4_AND_UX_MODULES_REPORT.md`

The report must include:

- Nuxt version before/after;
- migration steps;
- compatibility issues found;
- modules added;
- modules considered but intentionally not added;
- exact module use cases;
- dependency/lockfile changes;
- files changed;
- build/test results;
- performance observations;
- known limitations;
- confirmation Phase 09 was not started.

Update:

- `docs/phases/mid-design-refresh/README.md`
- active coordination files
- architecture/dependency documentation where the framework/runtime baseline is recorded

Do not rewrite unrelated history.

---

# Acceptance Criteria

MID-08 is complete when:

- web workspace runs on supported Nuxt 4;
- no known Nuxt 3-only assumptions remain in active app code;
- production build succeeds;
- existing accepted flows still work;
- selected UX modules are integrated intentionally rather than merely installed;
- Inter / Instrument Serif delivery is reliable;
- iconography is more coherent;
- image optimization improves relevant public/static media without compromising private media;
- VueUse adoption does not replace accepted domain architecture;
- appearance/theme behavior remains correct;
- glass transparency remains independent and functional;
- spatial motion and route-loader behavior remain intact;
- all relevant tests pass;
- Docker development remains working;
- Phase 09 has not begun.

Stop after MID-08 and wait for acceptance before any container-runtime migration or Phase 09 work.
