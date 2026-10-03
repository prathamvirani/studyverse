# MID-01 visual evidence

Captured from the production Nuxt build in the isolated HTTPS Chromium harness, using synthetic test accounts/rooms. No real-account profile, OAuth credential or provider content is included. These images show MID-01 only; cards, auth and room composition retain the later-phase scope boundaries.

| View                                       | Screenshot                             |
| ------------------------------------------ | -------------------------------------- |
| Desktop Light, 1440 × 900                  | [Desktop](desktop-light.png)           |
| Ultrawide Auto, 3440 × 1440                | [Auto](ultrawide-auto.png)             |
| Ultrawide Compressed, 3440 × 1440          | [Compressed](ultrawide-compressed.png) |
| Ultrawide Full-width Dark, 3440 × 1440     | [Full-width](ultrawide-full.png)       |
| Tablet rail Dark, 820 × 1180               | [Rail](tablet-dark.png)                |
| Tablet bottom bar, 700 × 1024              | [Bottom bar](tablet-bottom.png)        |
| Mobile Light, 390 × 844                    | [Mobile Light](mobile-light.png)       |
| Mobile Dark, 320 × 780                     | [Mobile Dark](mobile-dark.png)         |
| Dark settings, keyboard selection          | [Settings](settings-dark.png)          |
| Touch settings, 390 × 844                  | [Touch settings](settings-touch.png)   |
| Immersive room, global navigation excluded | [Room](immersive-room.png)             |

[Machine-readable dimensions and grid counts](layout-matrix.json). Source: `tests/browser/visual-foundation.spec.ts`. Final focused run: `.local/mid01-visual-final.log` (five passed). [Report](../../reports/MID_01_VISUAL_FOUNDATION_AND_SHELL_REPORT.md).

## September 20 corrections

[Refreshed acceptance evidence](corrections-2026-09-20/README.md) covers the opaque loading surface, Glass Transparency, motion and remaining shell checks. The original captures above are retained as history. MID-01 remains AWAITING_REVIEW.
