# MID-01 correction evidence — September 20

Captured from the final production Nuxt build through the isolated HTTPS Chromium harness, with synthetic accounts and rooms. Original September 13 captures remain in the parent folder. No room redesign or MID-02 work is represented.

| Evidence                                                | Capture                                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Fully opaque cover while a first-frame image is pending | [Loading surface](opaque-image-loading.png)                                                          |
| Manual glass maximum, Light                             | [Light settings](glass-manual-light.png)                                                             |
| Manual glass maximum, Dark                              | [Dark settings](glass-manual-dark.png)                                                               |
| Auto glass and touch controls at 390px                  | [Touch settings](settings-touch.png)                                                                 |
| Appearance and compressed width                         | [Dark settings](settings-dark.png)                                                                   |
| Desktop                                                 | [1440px Light](desktop-light.png)                                                                    |
| Ultrawide modes                                         | [Auto](ultrawide-auto.png), [Compressed](ultrawide-compressed.png), [Full-width](ultrawide-full.png) |
| Tablet navigation boundary                              | [820px rail](tablet-dark.png), [700px bottom bar](tablet-bottom.png)                                 |
| Mobile footer and navigation                            | [390px Light](mobile-light.png), [320px Dark](mobile-dark.png)                                       |
| Immersive global-navigation exclusion                   | [Room](immersive-room.png)                                                                           |

[Layout measurements](layout-matrix.json). [Image-ready to reveal observation](ready-reveal.json): 832ms including image delivery/decoding, the reveal and test polling; not a performance SLA. Finite screenshot animations are settled for readable evidence; the loading capture deliberately keeps the image request pending.

Source: `tests/browser/visual-foundation.spec.ts`. Final acceptance run: `.local/mid01-corrections-acceptance-final.log` (seven passed). Complete regression run: `.local/mid01-corrections-browser-regression.log` (32 passed), followed by the final targeted pass. [MID-01 report](../../../reports/MID_01_VISUAL_FOUNDATION_AND_SHELL_REPORT.md). Status: **AWAITING_REVIEW**.
