# MID-04A — Fourth owner visual QA pass

Status: COMPLETE — AWAITING_REVIEW. These are implementation review captures, not owner acceptance.

The six scenarios in `tests/browser/visual-qa.spec.ts` generate these captures with direct Chromium surface capture. Tests separately assert DOM identity, request counts, accessible controls, geometry and unchanged numeric ranges; screenshots are presentation evidence.

| Capture                                                          | Review purpose                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [address-invite-desktop.png](address-invite-desktop.png)         | Unified address prefix, separate availability and Save, read-only generated invite and history spacing |
| [address-invite-narrow.png](address-invite-narrow.png)           | Address and invite-control reflow at 390px                                                             |
| [actual-selected-preentry.png](actual-selected-preentry.png)     | Actual Cedar Library environment decoded and mounted beneath the inert entry decision                  |
| [same-selected-admitted.png](same-selected-admitted.png)         | Same shell/environment after admission                                                                 |
| [timer-settings-desktop.png](timer-settings-desktop.png)         | Four aligned duration fields, compact Auto-start and Saved, header scopes and grouped timer controls   |
| [timer-settings-narrow.png](timer-settings-narrow.png)           | Two-column duration fields, shared spacing and slider at 390px                                         |
| [compact-controls-companion.png](compact-controls-companion.png) | Horizontal companion controller with compact dock padding                                              |
| [participant-grid-720.png](participant-grid-720.png)             | Three authorized participants adopted into a three-column grid                                         |
| [participant-grid-220.png](participant-grid-220.png)             | Same participant nodes reflow to one column in a tall narrow window                                    |
| [participant-popover.png](participant-popover.png)               | Shared overlay-select, compact close icon and camera-off copy                                          |
| [identity-morning-studio.png](identity-morning-studio.png)       | Primary room name and secondary privacy on a bright background at minimum manual glass                 |
| [identity-night-observatory.png](identity-night-observatory.png) | Identity hierarchy on a dark background                                                                |
| [identity-cedar-library.png](identity-cedar-library.png)         | Identity hierarchy and localized haze on a complex background                                          |
| [usable-lower-workspace.png](usable-lower-workspace.png)         | Chat dragged and resized below the previous floor into the area freed by the dock companion            |

All fourteen captures were visually inspected. Long readonly inputs retain their full values; native clipboard/share calls are replaced with deterministic test implementations. Preview coverage holds the selected image response and verifies the opaque loading veil remains until decode/mount, zero pre-entry join/media requests, and one admission with retained shell/image nodes. Slider checks cover exact visible track endpoints and midpoint/fill alignment without changing ranges.

Companion dimensions are content viewports, not a guarantee about OS window chrome or minimum outer sizes. Native Document PiP, popup policy, clipboard permissions and physical capture hardware remain platform-controlled. YouTube tests use the deterministic provider fixture; synthetic RTC tests validate existing ownership and rendering, not physical devices or provider playback. Unrelated heavy service and standalone live/SFU suites were not repeated in this pass.

Execution logs and preservation proofs are retained under `.local/validation/mid04a-visual-qa/`. The current [review report](../../../reports/MID_04A_OWNER_REVIEW_CORRECTIONS_AND_ROOM_STABILITY_REPORT.md) records final regression counts and boundaries. `validation.json` records capture hashes, current checks and baseline preservation.
