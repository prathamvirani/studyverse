# MID-00 visual baseline

Captured on 2026-09-13 from unchanged accepted product source, using the repository's isolated HTTPS Chromium harness and fake OAuth accounts in `study_test`. These are comparison references, not redesigned screens. No production account, invite secret, device capture or external YouTube playback was used in this capture run.

The [manifest](manifest.json) records viewport, route, document dimensions, CSS font stack, theme and DOM counts. Select counts include controls in closed dialogs/details; the font stack is not proof of which font supplied the glyphs. The room has one fixture user and empty productivity lists. Friends shows an empty relationship list. Discover can include other isolated test records. Mobile room images follow desktop resizing with the productivity rail left open; they are not fresh mobile-entry defaults. Full-page captures of scrollable pages can be taller than the viewport. Dialog captures show their initial internal scroll position.

| Surface                                | Baseline                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Signed-out auth                        | [Desktop](auth-desktop.png)                                                                                |
| Home (`/`, currently no `/home` route) | [Desktop](home-desktop.png)                                                                                |
| My Rooms                               | [Desktop](my-rooms-desktop.png), [mobile](my-rooms-mobile.png), [3440px ultrawide](my-rooms-ultrawide.png) |
| Discover                               | [Desktop](discover-desktop.png)                                                                            |
| Friends                                | [Desktop](friends-desktop.png)                                                                             |
| Account/devices                        | [Desktop](account-desktop.png)                                                                             |
| Create room                            | [Desktop](create-room-desktop.png)                                                                         |
| Room details/settings                  | [Desktop](room-details-desktop.png)                                                                        |
| Edit room (inline in details)          | [Desktop](edit-room-desktop.png)                                                                           |
| Immersive room                         | [Desktop](room-desktop.png), [mobile](room-mobile.png)                                                     |
| Media with one queued video ID, paused | [Desktop](media-desktop.png), [tablet](media-tablet.png), [mobile](media-mobile.png)                       |
| More/settings                          | [Basic](more-settings-desktop.png), [advanced draft](more-advanced-desktop.png)                            |

The harness deliberately uses RTC stage A; ordinary deployment remains basic. Selecting Advanced in this capture changes only the form draft; no profile is applied and no microphone/camera/share is activated. Current media metadata is an ID because metadata resolution is deferred to MID-06.

Reproduce from the repository root, with the existing local PostgreSQL/Redis/LiveKit services available:

```sh
npm run build --workspace @study/web
npx playwright test --config tests/visual/playwright.config.ts
```

This opt-in capture workflow reuses `tests/browser/server.ts`; it does not run as part of the default browser regression suite. It creates fresh test-only records through ordinary authenticated UI flows. Do not run it concurrently with service tests that reset the shared test database. Rerunning overwrites these references: preserve the MID-00 originals in version control before recording a later design. Existing earlier-phase captures remain in ignored `.local/validation/` and the original room reference remains at `docs/references/original-studyverse-room.jpg`.
