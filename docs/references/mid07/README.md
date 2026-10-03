# MID-07 evidence

`accessibility-platform.spec.ts` writes one diagnostic record and three settled captures per browser/platform: Diagnostics, forced colors and 320px reflow. Captures wait for font readiness and finite transitions. Windows Chromium and Linux Chromium cover touch targets; Linux Firefox covers the remaining matrix because Playwright cannot emulate touch there.

- `windows-chromium-*`: Windows Chromium, local isolated HTTPS fixture.
- `linux-chromium-*`: Linux Chromium through the loopback Playwright server.
- `linux-firefox-*`: Linux Firefox through the same server/fixture.

JSON files record runtime API availability, browser identity, loaded-font checks, widths and observed page errors. They are bounded evidence, not certification of actual mobile hardware, OS effects, credentials, notification permission or assistive technology.

The phase report and raw validation logs describe the broader regression and its limitations. Historical MID-00–04A screenshots are restored from their preserved baseline after rerunning browser tests.
