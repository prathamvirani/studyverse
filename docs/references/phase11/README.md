# Phase 11 review evidence

These screenshots use the local isolated Chromium harness, synthetic accounts and deterministic local provider fixtures. They do not represent a production deployment or native device certification. The drawing case also exercises the actual server deadline and a reload preserving the same activity, strokes and deadline.

| Image                                             | What it shows                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [Word keyboard guess](word-keyboard-guess.png)    | Synchronized evaluation and restored input focus, with a spectator present            |
| [Shared stroke](sketch-shared-stroke.png)         | A server-accepted drawer stroke projected to the other participant                    |
| [Mobile](sketch-mobile.png)                       | 360×800 viewport, scrollable card beside the participant rail                         |
| [Tablet](sketch-tablet.png)                       | 768×1024 viewport                                                                     |
| [Desktop](sketch-desktop.png)                     | 1440×1000 viewport                                                                    |
| [Ultrawide](sketch-ultrawide.png)                 | 2560×1080 viewport                                                                    |
| [Popout](sketch-popout.png)                       | Existing card adopted into the workspace popout, captured through its CDP framebuffer |
| [Break suggestion](optional-break-suggestion.png) | Optional notification without automatic activity/card creation                        |
| [Mobile suggestion](optional-break-mobile.png)    | Visible, reachable dismissal and exploration controls at 360×800                      |

The cards retain normal room controls and use their own scroll area. Freehand drawing requires pointer input; surrounding controls and word submission support keyboard input. Real network drawing appears on lift and the existing two-second snapshot cadence.

Exact suite results, failed runs, scoped repairs, security gates and capture boundaries are recorded in the [Phase 11 report](../../reports/PHASE_11_SOCIAL_BONDING_AND_MINI_GAMES_REPORT.md). Raw logs/traces are retained under `.local/validation/phase11/`. Browser suites that overwrite historical reference paths have their new captures saved there before the inherited references are restored byte-for-byte.
