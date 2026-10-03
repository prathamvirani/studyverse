# MID-04 room evidence

Captured by `tests/browser/room-refresh.spec.ts` against the isolated local application harness. The production application is built before the test. Assets and screenshots from earlier phases are unchanged.

| Files                                                    | Coverage                                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `room-3440x1440.png`, `settings-3440x1440.png`           | Ultrawide room and centered two-pane settings                                           |
| `room-1440x900.png`, `settings-1440x900.png`             | Desktop room and settings                                                               |
| `room-820x1024.png`, `settings-820x1024.png`             | Tablet portrait                                                                         |
| `room-390x844.png`, `settings-390x844.png`               | Narrow room and settings drill-in                                                       |
| `room-320x568.png`, `settings-320x568.png`               | Small mobile                                                                            |
| `room-1024x480.png`, `settings-1024x480.png`             | Short desktop                                                                           |
| `room-640x450.png`, `settings-640x450.png`               | Short narrow / 200% desktop zoom-equivalent reflow                                      |
| `glass-light.png`, `glass-dark.png`, `glass-complex.png` | Controlled PNG fixtures proving Auto's background classification and material response  |
| `room-1440x1000-fresh.png`, `projector.png`              | Four independent cards on fresh desktop entry and the enlarged timer/clock presentation |

The geometry sequence resizes the same entered room. It intentionally retains card visibility/geometry history and exercises recovery; these are not all fresh-entry default layouts. Narrow fresh entry starts cards minimized and allows individual restoration. Content inside cards and media controls retains its accepted feature design pending MID-05/MID-06.

Screenshots are visual evidence, not pixel-diff baselines or evidence of native hardware capture. Browser assertions additionally cover focus, safe geometry, presence reconciliation, persistence, presentation recovery, global appearance, reduced transparency and forced colors/reduced motion. See [the phase report](../../reports/MID_04_ROOM_SHELL_AND_WORKSPACE_REPORT.md) for results and limitations.
