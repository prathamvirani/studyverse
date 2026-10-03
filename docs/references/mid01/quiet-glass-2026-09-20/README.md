# MID-01 fade and glass visual review

Captured from the production Nuxt build through the isolated HTTPS Chromium harness on September 20, 2026. These supersede the earlier correction images for route loading and glass opacity. MID-01 remains AWAITING_REVIEW.

Paired images use the actual AppRail, profile popover and Appearance sheet. A test-only striped page backdrop makes transmitted background comparable; surface colors, blur, borders and text use production styles. Screenshots settle finite animations. The midpoint demonstrates Balanced, with endpoints demonstrating More Solid and More Transparent. No diagnostic backdrop ships with the application.

| Theme / surface        | More Solid (0)                     | Balanced (50)                          | More Transparent (100)                     |
| ---------------------- | ---------------------------------- | -------------------------------------- | ------------------------------------------ |
| Light rail and profile | [Solid](glass-light-0-profile.png) | [Balanced](glass-light-50-profile.png) | [Transparent](glass-light-100-profile.png) |
| Dark rail and profile  | [Solid](glass-dark-0-profile.png)  | [Balanced](glass-dark-50-profile.png)  | [Transparent](glass-dark-100-profile.png)  |
| Light Appearance sheet | [Solid](glass-light-0-sheet.png)   | [Balanced](glass-light-50-sheet.png)   | [Transparent](glass-light-100-sheet.png)   |
| Dark Appearance sheet  | [Solid](glass-dark-0-sheet.png)    | [Balanced](glass-dark-50-sheet.png)    | [Transparent](glass-dark-100-sheet.png)    |

[Opaque spinner-only loading](opaque-image-loading.png) was captured while a first-viewport image request was held pending at the maximum manual transparency setting. It contains only the centered spinner on the opaque canvas surface.

[Measured surface alpha](glass-alpha.json), [per-frame route motion samples](route-fade-frames.json), and [image release-to-reveal observation](ready-reveal.json) accompany the images. Per-frame checks cover Light/Dark and ordinary/reduced motion: no page or cover transform, no clip path, cover opacity 1 while preparing, and opacity-only 200ms reveal when ready. Image timing includes response delivery, decoding, animation and test polling; it is local evidence rather than a timing SLA.

Text and controls remain visually readable in these tested backdrops. Physical devices, screen-reader operation and other browser engines were not certified by these local Chromium checks.
