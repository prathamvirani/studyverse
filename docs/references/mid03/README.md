# MID-03 visual evidence

Captured 2026-09-20 from the production Nuxt build using the isolated HTTPS browser harness and generated test identities. The optional local-stack smoke uses an isolated signed-out browser against the refreshed development stack. No real account was signed in or modified for screenshots.

Reviewed: desktop Home, My Rooms, Discover, Friends list/detail, room management and create preview; dark ultrawide grids; tablet composition; dark mobile Home and light mobile friend detail; 320px room search/grid. Automated checks cover no horizontal overflow across Home, My Rooms, Discover, Friends and create at 1440, 3440, 820, 390 and 320px; Light/Dark/System and reduced motion. The retained visual-foundation suite verifies compressed/full-width, footer, focus, touch, contrast/transparency and accepted route transitions.

Full-page images include fixed navigation at its viewport position. The bar can overlay an intermediate part of a tall screenshot; it stays fixed while the document scrolls, and end padding keeps the last actions reachable. Thumbnail opacity may vary during its one-time 280ms reveal. Screenshots wait for data and the route veil to finish.

| Screenshot                                                 | Full-document pixels |
| ---------------------------------------------------------- | -------------------- |
| [desktop-create-preview.png](desktop-create-preview.png)   | 1280 x 1104          |
| [desktop-discover.png](desktop-discover.png)               | 1440 x 1094          |
| [desktop-friend-selected.png](desktop-friend-selected.png) | 1280 x 1056          |
| [desktop-friends.png](desktop-friends.png)                 | 1440 x 900           |
| [desktop-home.png](desktop-home.png)                       | 1440 x 1246          |
| [desktop-my-rooms.png](desktop-my-rooms.png)               | 1440 x 1073          |
| [desktop-room-management.png](desktop-room-management.png) | 1280 x 934           |
| [local-stack-home.png](local-stack-home.png)               | 1440 x 900           |
| [mobile-friend-selected.png](mobile-friend-selected.png)   | 390 x 1218           |
| [mobile-home.png](mobile-home.png)                         | 390 x 3290           |
| [mobile-my-rooms.png](mobile-my-rooms.png)                 | 390 x 2558           |
| [small-home.png](small-home.png)                           | 320 x 3339           |
| [small-my-rooms.png](small-my-rooms.png)                   | 320 x 2637           |
| [tablet-home.png](tablet-home.png)                         | 820 x 1973           |
| [tablet-my-rooms.png](tablet-my-rooms.png)                 | 820 x 1447           |
| [ultrawide-home.png](ultrawide-home.png)                   | 3440 x 1440          |
| [ultrawide-my-rooms.png](ultrawide-my-rooms.png)           | 3440 x 1440          |

[manifest.json](manifest.json) records dimensions and SHA-256 hashes. Reproduce the MID-03 fixture captures after a production build with `npx playwright test tests/browser/room-browse.spec.ts`; files are written to `.local/validation/mid03/`. Do not rebuild that production output while its browser harness is running.

These are local Chromium viewport checks, not physical-device, screen-reader, Safari/Firefox or external OAuth certification. Historical MID-00/01/02 evidence remains unchanged. See the [implementation report](../../reports/MID_03_HOME_ROOMS_DISCOVER_FRIENDS_REPORT.md) for test results, privacy policy, limitations and deferred scope.
