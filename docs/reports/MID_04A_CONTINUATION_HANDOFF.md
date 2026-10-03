# MID-04A continuation handoff

## Continuation outcome — 2026-10-02

The owner gave the continue command and this correction pass has now been finalized. The pause notes below are historical; use the current [owner-review report](MID_04A_OWNER_REVIEW_CORRECTIONS_AND_ROOM_STABILITY_REPORT.md) and [evidence index](../references/mid04a/companion-review/index.md) for the completed state. MID-04A remains **COMPLETE — AWAITING_REVIEW**. The only remaining gate is explicit owner review; MID-05 remains unauthorized.

- Completed the bulk-companion capture/recovery checks using bounded actual Chromium surface capture, retaining the existing renderers and owners.
- Corrected the local-camera caption lookup, made context helpers usable by the standalone RTC fixture, and fixed the participant-anchor dependency so controls and focus stay in the companion document. The persistence test now waits for its hidden Tasks state to be committed.
- Validation: 224 unit/integration cases and 28 focused service cases passed. One full browser run produced 68 passes and five failures among 73 cases; subsequent focused corrections provide passing evidence for all five. The final six affected camera/context/social cases passed. Full-run and focused logs remain separately recorded; the full run is not described as a clean pass.
- Reviewed 13 new screenshots; finalized the new report section, evidence index and validation manifest. Restored historical captures. All 625 protected baseline file hashes and the earlier report content match the pre-pass baseline.
- Refreshed the local API/web stack and applied the single archive migration without resetting volumes. All 22 original table counts are retained and the old migration ledger matches. Twenty table digests match; session/membership digests differ from the morning snapshot, and exact prior values were not recorded. The report retains this limitation.

The `previous-evidence` backup is rooted at **docs/references**, so a MID-04A capture is at `.local/validation/mid04a-companion-review/previous-evidence/mid04a/<filename>`. Final integrity records and scripts use that verified layout.

Saved: 2026-10-02, 11:01 MYT (03:01 UTC).

**Work is paused at the owner's explicit request. Resume only after the owner gives a continue command.** No implementation, tests, migration, rebuild, or deployment should continue while paused. The latest focused browser process has finished; no further test run was started after the pause request.

MID-04A remains **COMPLETE — AWAITING_REVIEW**. This correction pass still has validation and delivery work outstanding. Do not mark the phase ACCEPTED or start MID-05. No commit or pull request was requested.

## Authoritative request and operating constraints

Workspace: `F:\Studyverse-Like\Working` (PowerShell).

The latest owner brief is the complete text in:

`C:\Users\prath\.codex\attachments\07cc5c9b-ae98-4658-8b15-16d2b4b0f0dc\Pasted text.txt`

It supersedes earlier correction assumptions and contains 29 requirements. Read it again on continuation if the conversation context has been lost. Earlier pasted briefs remain context, but this latest brief controls the current correction pass.

Before source edits, the complete requested documentation set was read: UMBRELLA_SPEC, ACTIVE_PHASE, PHASE_HISTORY, MID-04, MID-04A, MID-05, MID-06, five relevant architecture guides, and the MID-04A report. The documentation-first workflow was read and applied from `C:\Users\prath\.codex\memories\skills\studyverse-phase-delivery\SKILL.md`.

The repository already contained substantial modified and untracked work at the start. **Do not reset, clean, stash, or overwrite that inherited work.** Git HEAD is not the accepted baseline. No AGENTS.md was found, and no subagent work was authorized. Do not create subagents unless new authorization or applicable instructions permit it. No persistent goal was created. No memory update was authorized.

The current approved glass range is locked. Do not change its mapping, opacity endpoints, Auto behavior, theme behavior, persistence, accessibility treatment, or loader behavior. Preserve existing feature, RTC, media, presence, and composition ownership.

## Engineering decisions and rationale

This section records the implementation decisions needed to resume; it is an engineering handoff, not a private reasoning transcript.

- Keep one room composition and one RoomShell from preview through admission. Render the resolved room before the entry modal becomes ready. Register active room features and RTC owners only after authoritative admission succeeds.
- Record safe application visits and their scroll positions for Back. Reject external paths and sensitive authentication query parameters. Preserve internal query/filter/scroll state instead of inventing parent-page navigation.
- Use one root context-menu provider with typed feature contributions. The first eligible right click opens the custom menu; a second right click closes it and allows the native menu. Preserve text editing and accessible keyboard behavior.
- Give each visible tool, rail, dock, and camera its own companion window. Move the existing node and renderer under one owner; do not create duplicate room connections, subscriptions, capture, or media playback.
- Keep the YouTube iframe under its existing visible owner. A popped-out media controller operates the existing model; it does not recreate the player or extract audio.
- Archive only already-revoked invites. Retain their historical attribution and revoked hash while clearing secret ciphertext and removing archived rows from the active listing.
- Copy already-loaded CSS rules into companion documents. Link-only copies did not settle in browser tests and left popup layout styles unavailable. Preserve nonce and resolve CSS asset URLs against each stylesheet URL.
- Keep normal workspace geometry separate from temporary companion dimensions. Clamp resized dimensions to registered minimums to avoid a floating-point value just below the minimum failing validation.
- Give each room's utility-window names a unique namespace and close companions on owner pagehide as well as component unmount. This prevents reuse across owners and cleans up full-page navigation.
- Preserve historical report sections and screenshots. Add a new follow-up section and a new evidence directory rather than rewriting prior review history.

## Implemented work and achieved behavior

The source changes for the requested areas are in place. These statements distinguish implementation from the outstanding complete regression.

1. **Rearrange grips:** inline, same-row geometry, hidden in normal mode, revealed on hover/focus while editing, keyboard/grab behavior retained. Corrected atmosphere control pointer handling and dock flex alignment.
2. **Chat:** flexible scrolling history, pinned composer, 200px minimum height, integrated 44px send icon, Enter send, Shift+Enter newline, whitespace and IME guards, authorized own-message delete icon, touch affordance, and subscription cleanup.
3. **Room address:** background validation with stale-result fences, loader/check/cross, check-to-save, muted Saved state, contextual overlays, no separate save action. Existing copy/share remain available.
4. **Invite settings:** desktop two-field row, narrow stacked layout, compact spacing, revoked-invite removal confirmation and server-side archival authorization.
5. **Shared action styling:** centrally aligned shared action links, including All my rooms; removed the conflicting local RoomPage display override.
6. **Application Back:** safe actual visit history, query/filter/scroll restoration, no fabricated Back on direct entry, circular 44px header control with a 52px wordmark shift and reduced-motion support.
7. **Entry copy:** linked authored primary and secondary bundles, selected once per opening, no timer rotation or immediate repeat, explicit accessible Join room / Cancel actions.
8. **Room-first entry:** resolve -> room preview -> glass modal -> positive admission -> activate the same rendered shell. Decline restores the origin. Preview readiness, route/account fences, one-use admission handoff, authoritative denial, and no room admission/capture/RTC before consent are implemented.
9. **Global context actions:** one provider/host; page, room-card, friend, canvas, workspace, participant, and text-edit contributions; owner-aware actions; viewport clamping, keyboard navigation, Escape/outside close, focus restoration, Shift+F10, selected-text actions, and native second right click.
10. **Companion windows:** one window per tool/rail/dock/camera, Popout ALL reservations from the user gesture, blocked-window reporting, per-window restore and Restore all, responsive actual viewport layout, and preservation of normal geometry.
11. **Media ownership:** existing video element and MediaStream are moved; participant overlays retain authorized names/mic/speaking state; presentation visibility follows the receiving document. Media controller reuses the existing player/model.
12. **Lifecycle:** room unmount and full-page owner navigation close companions; unique window names prevent cross-owner reuse.
13. **Glass:** source mapping remains unchanged; focused light/dark endpoint and Auto checks passed.
14. **Report:** added a third follow-up section to `docs/reports/MID_04A_OWNER_REVIEW_CORRECTIONS_AND_ROOM_STABILITY_REPORT.md`, preserving the earlier sections. Its new validation subsection still contains a temporary sentence and must be finalized before delivery.

The tiny generic resize correction is in `packages/core/src/workspace.ts`. Its focused test covers fractional coordinates and all resize corners with registered minimums and opposite-edge preservation. It was necessary because Chat's resize reached 199.9999999999px and the existing validator rejected the layout.

## Files and evidence to use on continuation

Main report:

`docs/reports/MID_04A_OWNER_REVIEW_CORRECTIONS_AND_ROOM_STABILITY_REPORT.md`

Validation working directory:

`.local/validation/mid04a-companion-review/`

Important files in that directory:

- `baseline.json`: SHA256 baseline of inherited files captured at turn start. Compare against this, not just Git HEAD.
- `current-owned-files.json`: source/test/generated files edited by this pass. This list predates the final core resize changes and report additions; include `packages/core/src/workspace.ts`, `tests/unit/room-workspace.test.ts`, the new migration, main report, and this handoff when reconciling current edits.
- `previous-evidence/`: complete backup of historical `docs/references/mid04a/` content. Restore those historical files after all browser runs, keeping the new companion-review directory.
- `dev-data-before.json`: original columns, counts, and row digests for 22 development tables, captured before any development migration changes.
- `dev-data-check.mjs`: original-column projection checker. Its after comparison excludes only the newly authorized rooms migration ledger entry; verify that new ledger entry separately.
- `dev-smoke.mjs`: local HTTPS smoke checks for `/`, `/api/v1/ready`, and `/api/v1/account/providers` on port 8443.
- Focused logs, build/lint/typecheck/contract/security logs, and unit/service logs listed below.
- Earlier focused trace backups: `focused-initial-traces`, `focused-second-traces`, `focused-third-traces`, `focused-diagnostic-traces` if present, and `focused-fourth-traces`. Check actual directory names before using them.

The newest failed trace remains in:

`test-results/companion-review-companion-c69b3-ve-companion-with-one-owner/trace.zip`

**Copy current test-results into a new validation trace directory before another browser run overwrites them.** This copy was not done after the owner requested a pause.

New evidence directory:

`docs/references/mid04a/companion-review/`

Currently contains nine PNGs: address-invites-desktop, address-invites-narrow, chat-minimum-touch, global-context-menu, inline-rearrange, room-first-doorway, same-shell-admitted, same-subscription-remote-video, and shell-direct-no-back. No index or final validation manifest has been written yet. The planned bulk-companion screenshots have not completed.

## Validation completed and its limits

- Contracts generation/check and source security checks passed earlier in this pass. Refresh cheap checks after the latest edits.
- Initial focused unit selection: **23 passed** (`focused-unit.log`).
- Identity/rooms service tests: **28 passed**, including archive authorization, revoked-token invalidity, and attribution preservation (`focused-services.log`).
- Full non-browser unit regression before the final resize test: **223 passed across 36 files** (`regression-unit.log`). Rerun after the final core change; expected count is 224, but use the actual result.
- Focused final resize/history tests: **12 passed across 2 files** (`focused-resize-unit.log`).
- Lint and typecheck passed before the latest core/CSS-copy/lifecycle edits. They need final refresh.
- Latest production build passed after the pagehide and unique-window-name changes (`implementation-build.log`).
- Earlier focused browser runs verified existing room layouts, three-account privacy/presence, feature stability, media-controller/YouTube ownership, and native individual Document PiP behavior. Do not present those selections as the complete browser regression.
- The fourth focused selection ran nine scenarios: **7 passed, 2 failed** (`focused-browser-fourth.log`). Passing areas were inline grips, Chat minimum/IME/touch, address/invite archival, Back, room-first linked entry, global/native/edit context menus, and locked glass. At that point the bulk-popup test stopped at a screenshot timeout, and the remote-video test found missing full-page owner cleanup.
- The most recent focused selection ran two popup scenarios: **1 passed, 1 failed** (`focused-popouts-final.log`). The remote-video test now passes after the pagehide fix. It checks the same subscribed video element and stream, advancing frames, unchanged peer count, no popup WebSocket, restore, reopening, and owner full-page navigation closing the companion.
- The bulk-popup test still times out at screenshot capture. Its preceding assertions pass, but its later close-one / Restore all / blocked-popup assertions have not yet been reached in that run.

**One complete browser regression has not yet been run for this correction pass.** Do not claim full completion or clean browser validation.

## Immediate unresolved issue

`tests/browser/companion-review.spec.ts`, bulk-companion scenario around line 591:

```ts
await chat.bringToFront();
await chat.screenshot({ path: `${evidence}/chat-companion-wide.png` });
```

The test hits its 100000ms timeout inside page.screenshot. Playwright reports fonts loaded, then capture does not finish. Bringing the popup to the front did not fix this. The last run finished with one failed bulk test and one passed remote-video test; session 87576 has exited with code 1.

Before the capture call, the bulk scenario successfully created seven windows (Pomodoro, Tasks, Chat, Clock, participant rail, dock, camera), preserved room ownership/capture counts and the existing camera element, verified tall/wide layouts and compositor containment, sent Chat from its companion, and verified repeated Popout ALL did not create extra windows.

Next investigation should separate capture mechanics from application behavior and ensure recovery assertions run. A bounded CDP capture or another supported screenshot method may help, but this is only an investigation option, not a verified fix. Do not fabricate images, silently ignore functional failures, or claim the whole test passed. If capture has a genuine platform limitation, document it and still validate close-one / Restore all / blocked-popup recovery with reliable assertions.

## Remaining tasks, in order

1. Wait for the explicit continue command. Re-read this note and the latest brief; inspect current Git status and preserve all inherited changes.
2. Preserve the newest trace before rerunning tests. Resolve or honestly isolate the bulk-popup screenshot hang. Complete its close-one, normal-geometry restoration, Restore all, and blocked-window reporting assertions. Rebuild only if source changes require it, and do not alter the app output during an active browser run.
3. Confirm the focused companion selection is stable. Reassess additional contributor/permission checks only if current coverage exposes an actual gap; avoid implementation-mirroring tests.
4. Format this pass's owned files only; refresh lint, typecheck, contracts check, source/secrets checks, and the non-browser unit regression. Run a new build only when necessary after new source edits. No dependency changes were made.
5. Back up other historical reference directories before the full browser run if its tests write screenshots there. Existing MID-04A evidence is already backed up. Then run **one relevant full browser regression once stable**, record its actual count and boundaries, and preserve its results/trace before any subsequent focused run.
6. Refresh the local development API/web/migration images and apply the new rooms archive migration. This has not yet been done. Reuse existing PostgreSQL, Redis, SFU, and proxy services and volumes; do not reset data or restart unrelated services.
7. Verify development data preservation, migration ledger integrity, old invite rows' newly added nullable archive column, service health, and HTTPS smoke checks. If live activity causes digest differences, report the actual result; do not rewrite the baseline to hide differences.
8. After all browser runs, restore historical MID-04A reference files from previous-evidence, retaining companion-review. Restore other backed-up historical reference directories as needed. Check protected documents, configuration, package files, earlier migrations, glass mappings, and unrelated inherited files against the turn-start baseline.
9. Visually inspect the new screenshots with the local image tool, fix any genuine layout defects, and create a new evidence index/validation manifest. Record actual browser/viewports and synthetic-media limitations.
10. Replace the new report section's validation placeholder with final results and evidence links. Retain historical review sections, phase state, and platform limits. Deliver a concise final summary and report/evidence links at **COMPLETE — AWAITING_REVIEW**. Do not start MID-05 or self-accept.

## Resume commands and execution notes

Use direct test CLIs when passing options. npm 11 in PowerShell interpreted some `npm run test -- --flags` options incorrectly.

```powershell
node node_modules/@playwright/test/cli.js test tests/browser/companion-review.spec.ts --grep 'each tool|remote video' *> .local/validation/mid04a-companion-review/focused-popouts-resumed.log
node node_modules/vitest/vitest.mjs run
node node_modules/@playwright/test/cli.js test *> .local/validation/mid04a-companion-review/browser-regression.log
```

These are examples for continuation, not commands already run after this pause. Use the project scripts for required lint/typecheck/security/contract checks and inspect their actual output.

The planned local development refresh sequence is:

```powershell
docker compose --env-file .local/compose.env build api web migrate
docker compose --env-file .local/compose.env run --rm --no-deps migrate
docker compose --env-file .local/compose.env up --detach --no-deps --wait --wait-timeout 120 api web
node .local/validation/mid04a-companion-review/dev-data-check.mjs after
node .local/validation/mid04a-companion-review/dev-smoke.mjs
```

Execute only after confirming the resumed repository/configuration state and the preceding command's success. The existing local Docker stack was healthy before pause and still serves the older development image. No database reset or development migration was performed in this correction pass before pause.

No native computer automation, image generation, new dependency installation, external publishing, commit, or PR is required by the current request. Keep commentary updates concise during sustained work.

## Delivery caveats to retain

Companion behavior depends on browser popup permission; report blocked view names and keep blocked views in the owner. Individual views can use available Document PiP, while bulk requests use separate utility windows. Clipboard, window sizing, and capture have browser/platform constraints. Local Chromium uses synthetic LiveKit media in these checks; it does not establish real hardware, every browser, or every OS picker behavior. The YouTube fixture verifies existing-player ownership, not real provider playback quality.

Unsupported native selection APIs on some numeric/date/email inputs retain their native editing context behavior. Browser/provider background throttling is not bypassed. The owner must remain open for companion lifecycle ownership.

The main report already contains platform limits; update them if the final screenshot investigation establishes an additional limitation.
