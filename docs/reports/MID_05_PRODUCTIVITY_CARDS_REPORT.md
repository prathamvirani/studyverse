# MID-05 — Productivity Cards

Status: COMPLETE — AWAITING_REVIEW. Owner acceptance has not been claimed. Continuation to MID-06 is explicitly authorized.

The 2026-10-02 owner instruction authorizes continuation through MID-08 without intervening review. MID-04/MID-04A remain awaiting review. This phase extends the current dirty working tree, captured as 721 file hashes and a 22-table development-data inventory in `.local/validation/mid05-08/`.

## Implementation

Clock now has device-local 12/24-hour format, seconds, flip presentation, greeting controls, rolling local-time greetings, six visual styles and scale. Its existing workspace registration lazily loads the panel and retains the same workspace owner. Time display supports real SVG dot glyphs, per-digit flip motion, progress, gauge and pie presentations, with reduced-motion fallbacks and accessible text.

Pomodoro adds visual previews, scale, original synthesized sound previews/volume, bounded personal alert runtime and owner-authoritative shared runtime. Natural completion is distinguished from snapshots, reset and manual Skip, including completion with auto-start disabled. Completion shows a finite soft bloom and dismissible status. Sound contexts start only after a gesture and dispose with the card. Skip makes two finite arrow passes. Validated paused duration/configuration changes now apply through the existing versioned command immediately; this explicitly follows MID-05's no-Save requirement. The owner brief's four-column duration grid is retained with native numeric step controls and responsive collapse.

Tasks adds a completed/total count and Escape cancellation for inline creation. Deleted Chat messages have quieter tombstone styling. Existing MID-04A inline task create/edit/reorder/delete, hover/focus/touch actions, integrated headers, Chat IME/newline/authorization/scroll/composer behavior, projector presets and presentation transitions are retained.

## Ownership and data

There is one RoomShell, WorkspaceHost and existing timer/task/chat authority. Display preferences use the existing per-account/device IndexedDB adapter with backward-compatible defaults. Timer runtime is optional in existing validated timer JSON; no migration, dependency, volume reset or development-data mutation is required. Contracts are regenerated rather than edited manually. Shared changes remain server-authorized and version checked; sound/style/local Clock settings do not issue room mutations.

## Validation

- Focused unit checks: 31/31 across productivity, display, workspace and stability tests.
- Unit regression: 232/232 across 37 files.
- Shared productivity services: 22/22, including owner/member alert authorization, durable round trip and strict bounds.
- Focused browser: four distinct checks passed, including real one-minute completion with auto-start off, manual Skip exclusion, local appearance persistence, card DOM identity, tasks and Clock reflow. The first narrow pointer attempt encountered retained overlapping cards; keyboard activation passed.
- Lint and architecture boundaries passed. Package/Nuxt typecheck and production build passed. A concurrent Nuxt preparation/build attempt failed due to generated-tsconfig contention; the sequential build passed and subsequent preparation/build operations are kept sequential.
- One broader relevant browser regression: 37/38 passed initially. The remaining corrupt-layout fixture raced the live layout writer; retiring the room before injecting corruption fixed the fixture. Both that scoped case and final preview-grid/sound-preview checks passed, for 38/38 distinct cases across the broad run and repair. No unrelated standalone RTC suite was repeated.
- Versioned contracts and source security passed. The full secret scanner flags one inherited SHA-256 record named `security-secrets.log` in the MID-04A validation manifest, a verified false positive rather than a credential. The historical manifest is preserved; the raw failed scan is retained honestly.
- All 22 development tables retain exact counts, column projections and row digests, including the migration ledger. Existing Docker services are healthy. No reset, migration or container replacement occurred during MID-05.

Logs: `.local/validation/mid05-08/mid05-*.log`. Screenshots: [desktop](../references/mid05/productivity-desktop.png), [narrow Clock settings](../references/mid05/clock-settings-narrow.png). Screenshot review caught shared sheet CSS overriding style grids; selectors now explicitly retain grid layout and independent preview fonts.

## Limitations and deferred polish

Evidence is Windows Chromium, mobile-width simulation and deterministic application fixtures, not certification of physical mobile devices or screen readers. Saved floating cards can overlap at narrow widths; existing rearrange/minimize/keyboard mechanisms remain. Minor card/header spacing, preview typography and additional greeting copy are deferred non-blocking polish. No new projector renderer, RTC/capture lifecycle or external audio asset is introduced.

Functional blocker classification: NONE. Historical formatting exceptions and the documented digest false positive are validation limitations. Minor visual polish is non-blocking. Checkpoint: `.local/validation/mid05-08/mid05-complete.json`. Phase 09, Personal Study Player and Docker → Podman are not started.
