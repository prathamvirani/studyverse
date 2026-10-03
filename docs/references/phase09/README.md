# Phase 09 review evidence

See the [report](../../reports/PHASE_09_PERSONAL_STUDY_PLAYER_REPORT.md) for actual validation results and the unresolved audit completion gate. Captures are local Chromium observations, not hardware or cross-browser certification.

- `personal-desktop.png`: 1280×720 Media panel with private resume, shared primitives, speed and the owning tile. The blank provider frame is the deterministic YouTube fixture; this image verifies presentation, not real playback.
- `personal-narrow.png`: 320×900 existing fullscreen tile; provider remains visible and native shared volume/transport controls are reachable. A real slider click is part of the test.
- `personal-listening.png`: 320×900 existing settings sheet with local ducking/history controls and unavailable-voice fallback.
- `personal-companion.png`: 420×520 alternate controls, no provider iframe. Captured from Chromium's actual framebuffer because the existing about:blank document's font-readiness promise did not settle. The controls operate the same main-room player; all ownership/control assertions remain in the test.
- `personal-live-youtube.png`: unsubstituted public YouTube embed on the final application build; one iframe and observed advancing playback (approximately 1.11 seconds), with no application page exception.
- `personal-live-vimeo.png`: unsubstituted public Vimeo SDK/iframe with loaded metadata/duration and the provider's playback error. This is a measured limitation, **not successful advancing playback**.
- `provider-observations.json`: bounded summary of actual provider state and application errors. It excludes transient provider CDN/query/diagnostic URLs. Raw observations and failed/scoped traces remain ignored under `.local/validation/phase09/`.

The final personal browser file passed **5/5**. The single broader relevant browser run was **41 passed / one capture timeout (42 cases)**; its capture repair and final personal file passed separately. It is not relabeled as an uninterrupted green 42/42 run. Actual direct VP8 WebM decoding and authorized RTC voice ducking with unchanged capture count are tested separately from provider fixtures.
