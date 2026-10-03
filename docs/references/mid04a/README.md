# MID-04A visual evidence

Generated from isolated browser-test accounts on 2026-10-01. These captures supplement the historical MID-04 baseline. They are implementation review evidence; owner acceptance is pending.

| Surface                                                    | Evidence                                                                                                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account and no-reflow validation                           | [Desktop](account-desktop.png), [narrow](account-narrow.png)                                                                                       |
| Login glow, provider buttons and responsive themes         | [Light](auth-light.png), [dark mobile](auth-dark-mobile.png), [tablet](auth-tablet.png)                                                            |
| Shared branding and Home/My Rooms                          | [Home desktop](desktop-home.png), [Home mobile](mobile-home.png), [My Rooms desktop](desktop-my-rooms.png), [My Rooms mobile](mobile-my-rooms.png) |
| Discover and contextual Friends                            | [Discover desktop](desktop-discover.png), [Friends](desktop-friends.png), [selected friend](desktop-friend-selected.png)                           |
| Discover controls and ambient glow                         | [Narrow](discover-narrow.png)                                                                                                                      |
| Short/vanity configure route and invite tracker            | [Configure](room-configure.png)                                                                                                                    |
| Rearrange/reset, compact productivity and player ownership | [1440×1000](room-1440x1000-fresh.png)                                                                                                              |
| Long-running room, chat draft and media                    | [Runtime](runtime-desktop.png)                                                                                                                     |
| Room responsive matrix                                     | `room-320x568.png`, `room-390x844.png`, `room-640x450.png`, `room-820x1024.png`, `room-1024x480.png`, `room-1440x900.png`, `room-3440x1440.png`    |
| Advanced settings responsive matrix                        | Corresponding `settings-<width>x<height>.png` files                                                                                                |
| Automatic material and presentation recovery               | [Light](glass-light.png), [dark](glass-dark.png), [complex](glass-complex.png), [projector](projector.png)                                         |
| Manual glass fill                                          | `glass-light-<level>-sheet.png` and `glass-dark-<level>-sheet.png` for 0, 25, 50, 75 and 100%                                                      |

Final compact timer and shared productivity captures: [desktop](productivity-desktop.png), [tablet](productivity-tablet.png), [mobile](productivity-mobile.png). The chat test deliberately renders an escaped script string as plain text.

Configure screenshots contain only isolated test-account invite material; the invite was revoked by the same test. No development account records or deployment secrets were exported.
