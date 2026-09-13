# Phase 07 — Advanced RTC & Quality Control

2026-09-13. **Status: AWAITING_REVIEW — implementation and validation complete.** Phase 06 is accepted. Phase 07 is not accepted; Phase 08 has not been started.

## Implemented

The existing RTC feature, generic provider, LiveKit adapters and room extension points now support Basic/Advanced personal media settings. More contains the secondary quality panel; the background, dock, participant rail and productivity hierarchy remain intact. Camera still renders in its circle until expanded and uses a single renderer.

Separate camera send, screen send, camera receive and screen receive preferences include resolution/FPS intent. Send settings add bitrate ceiling, advertised codec preference, content hint, quality/motion priority and automatic/single-layer/simulcast/SVC choices. Receive settings are render-size ceilings, not requests for maximum quality everywhere. Width/height, source capture, effective deployment-limited requests and actual RTP diagnostics are separately labeled. Native/Auto avoids requesting the maximum experimental FPS as an ideal.

Basic defaults remain camera 1280×720 at 30 FPS/2 Mbps, screen 1920×1080 at 30 FPS/4 Mbps, 64 kbit/s Standard Opus and all capture off. Data Saver requests camera 640×360/24 FPS/0.4 Mbps and screen 1280×720/15 FPS/1 Mbps. High explicitly switches to Advanced and requests camera/screen 1080p60 at 5/6 Mbps. Maximum/Custom is exposed through granular fields, not an automatic maximum preset. Estimates are approximate main-layer upload ceilings and GB/hour, with layer/protocol overhead and variable receiving explained.

## Custom ranges and progressive flags

| Setting            | Accepted request range                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Fixed dimensions   | Integer width 160–7680, height 90–4320                                                                          |
| Resolution choices | 360p, 480p, 720p, 1080p, 2560×1080, 1440p, 1600p, 3440×1440, 4K, Native, Custom                                 |
| Frame rate         | 1–250 FPS, including fractional requests; 24/30/50/60/75/90/100/120/144/165/200/240/250 presets and Native/Auto |
| Video bitrate      | 100 kbit/s–50 Mbit/s before deployment reduction                                                                |
| Audio bitrate      | 16–256 kbit/s Opus intent                                                                                       |
| Named profiles     | Up to 12, names 1–40 characters                                                                                 |

`NUXT_PUBLIC_RTC_QUALITY_STAGE` is the only new deployment setting. Normal deployment defaults to `basic`; invalid public configuration falls back to basic. Values `a`, `b`, `c`, `d` select cumulative experimental envelopes:

| Stage | Request envelope                               |
| ----- | ---------------------------------------------- |
| basic | Camera 720p30/2 Mbps; screen 1080p30/4 Mbps    |
| A     | 1080p60, up to 8 Mbps per video source         |
| B     | 1440p60, up to 12 Mbps                         |
| C     | Custom through 7680×4320, up to 60 FPS/30 Mbps |
| D     | Same dimension range, up to 250 FPS/50 Mbps    |

These are ceilings, not achieved profiles or authorization. No higher tier was promoted in normal deployment. The isolated test web deployment enables A for representative measurements. B–D remain rollout-gated pending actual hardware, network, CPU/power/thermal and infrastructure measurements. No broad codec × FPS × resolution matrix was run or claimed.

## Provider/browser behavior and diagnostics

AV1, VP9, H264 and VP8 choices require browser sender capability discovery, with SDK VP9/AV1 checks. Unavailable codecs are disabled/marked unknown; a saved unavailable preference uses Auto with a warning. Browser advertisement is only capability evidence: provider negotiation may still choose another codec. Actual codec comes from RTC stats. The pinned SDK's normal backup-codec behavior remains available for incompatible subscribers; the application does not deliberately enable simultaneous dual-codec publication.

VP8/H264 map to simulcast; VP9/AV1 map to SVC. Single-layer mode disables additional spatial layers. Layer controls follow codec support; they do not manufacture SVC for VP8. Camera Auto retains a useful 640×360 layer; screen Auto stays single-layer. High screen encoding uses the SDK's screen-specific encoding option. Quality favors maintaining resolution; latency/motion favors frame rate. These are congestion degradation preferences, not guaranteed latency or hardware encoder controls.

Every three seconds the adapter samples available RTP dimensions, FPS, codec, measured byte-delta bitrate, jitter, RTT, lost packets, dropped frames, cumulative encode/decode time and encoder limitation. The first bitrate sample and unavailable/reset stats remain unknown. Byte rates include sampled encoding layers, not all wire overhead. Source capture settings come from `MediaStreamTrack.getSettings`; they are not substituted for actual encoded/received quality. OS native display refresh, pre-capture native dimensions, thermals, GPU and battery data are not fabricated. Native uses available browser/SDK capture followed by a maximum envelope; it cannot force a device's physical native mode.

Unsupported capture constraints retain available source settings with a warning and continue to request bounded encoding. Failed advanced publication tries Balanced; failed reconfiguration tries previous encoding and stops only the affected source if recovery also fails. This is graceful product-client resource policy, not hard SFU policing of hostile RTP.

## Studio Voice, persistence and switching

Normal WebRTC Opus is preserved. Standard requests EC/NS/AGC and 64 kbit/s; High requests 96 kbit/s with echo cancellation retained and other processing reduced. Studio Voice requests 128 kbit/s, 48 kHz capture, EC/NS/AGC/voice isolation off and DTX off. Supported processing can be selectively re-enabled, bitrate adjusted and mono/stereo capture intent selected. The UI recommends headphones for processing-disabled capture and makes no lossless, bit-depth or professional fidelity claim. Actual capture processing/channel/sample-rate values are shown only where supplied by the browser. Synthetic audio tests do not establish physical microphone processing or audible fidelity.

Strict, account/device-scoped preferences use the existing IndexedDB architecture with memory fallback. Current settings and named profiles restore independently of capture. No active capture booleans, tracks, streams, tokens, secrets, credentials or diagnostics persist. Each tab loads independently; another tab's explicit save never activates or retunes its media. Last explicit write wins. Late storage reads and queued writes are fenced on disposal.

Apply operations serialize, coalesce stale queued revisions, wait for pending acquisitions and check connection/track ownership across asynchronous operations. Processing-only changes use in-place constraints. Encoding/dimension changes renegotiate on the same capture track, avoiding a new device acquisition or screen picker. Device switching retains the selected quality profile and necessarily reacquires the selected device. Renegotiation may briefly interrupt delivery and change publication SID; an expanded camera can return to its circle and a screen publication can receive a fresh ephemeral tile. This limitation is explicit. Keyboard focus is restored after Apply so Escape remains usable.

## Adaptive receive and authority

ResizeObserver supplies actual renderer dimensions; IntersectionObserver handles offscreen video and document visibility pauses hidden video while audio continues. Circles request low/360p, workspace/fullscreen requests are capped by the user's separate receive preference, and minimized/hidden video unsubscribes. Provider layer availability can prevent exact dimensions, particularly for single-layer streams. Existing one-renderer movement, secondary-camera, multiple-tab, screen-tile, reconnect and disposal behavior remain covered.

No API action, database migration, permission or source grant was added. Existing strict join/lease schemas still reject extra client identity, role, room, source and quality fields. Authenticated admission, exact room grants, membership/session revalidation, private audience projection, blocks/removal and provider reconciliation are unchanged. Quality preferences never become authority. The accepted self-hosted replay window, outage/removal bounds and single-authority-process limitation remain unchanged.

## Validation and real-SFU evidence

Final `npm run validate:phase07` **passed, exit 0: 263 tests, no skips**, including the complete accepted Phase 00–06 chain. Log: `.local/validation/phase07-full-validation-final.log`.

| Check                                                              | Result                       |
| ------------------------------------------------------------------ | ---------------------------- |
| Unit, HTTP/integration, provider/security and architecture         | 176 passed                   |
| Real PostgreSQL/Redis service regressions                          | 62 passed                    |
| HTTPS Chromium, including advanced and original real-SFU scenarios | 23 passed                    |
| Docker and actual Caddy/SFU readiness                              | 2 passed                     |
| Formatting, lint/boundaries, package/API and Nuxt types            | Passed                       |
| Generated contracts, source security and Gitleaks                  | Passed                       |
| Dependency audit                                                   | Passed; zero vulnerabilities |
| API and Nuxt production builds                                     | Passed                       |

Focused tests were used during implementation. The first complete chain passed 262 tests; final review then added the Native/Auto FPS regression and extended the advanced SFU test with screen switching and Studio Voice publication. The extension exposed focus loss during disabled Apply, which was corrected and explicitly tested. The complete chain was rerun after those material corrections. No failure was skipped or regression removed. Existing upstream build/deprecation warnings remain nonblocking; hosted CI was not run.

Final `npm run dev` rebuilt/refreshed the configured local stack without resetting volumes; exit 0. Both Docker/readiness checks passed again against that refreshed deployment. Logs: `.local/validation/phase07-compose-final.log` and `.local/validation/phase07-readiness-final.log`. No database migration, dependency version change or credential-policy change was introduced.

The advanced real-SFU scenario uses separate authenticated accounts, real PostgreSQL membership/session checks, the production web UI/provider and actual LiveKit WebRTC forwarding. Synthetic canvas capture requests 1920×1080 at 60 FPS; Web Audio supplies audio; the screen picker result is substituted. Tests distinguish requested and delivered FPS, observe a small circle layer then higher fullscreen decode, switch profiles without camera reacquisition, save/load/reload profiles with capture off, and check the constrained layout. Original hostile-client and multi-tab/reconnect scenarios are preserved.

In the final approximately 3.64-second measurement interval, the publisher reported 1920×1080 at 52 FPS and the receiver reported 1920×1080 at 54 FPS in its separately timed sample, versus 60 FPS requested. The low layer reported 640×360 at 30 FPS. Aggregate sampled video upload was approximately 1.71 Mbps; the receiver reported zero lost packets and zero dropped frames. Publisher-process CPU counters increased by approximately 1.26 CPU seconds per wall-clock second (multiple threads), with 4.7% main-thread task time and a 21.9 MB JavaScript heap snapshot. The SFU snapshot was 4.65% CPU and 103.6 MiB memory. These are short, synthetic, local observations, not total browser memory or sustained capacity guarantees. Advanced screen switching used one picker invocation; received audio RTP bytes established Studio Voice publication/forwarding, not microphone fidelity.

Evidence under `.local/validation/`:

- `phase07-sfu-measurements.json`: RTP before/after samples, browser performance counters and SFU container CPU/memory snapshot.
- `phase07-screen-voice.json`: advanced screen/audio forwarding and picker count.
- `phase07-advanced-desktop.png`, `phase07-advanced-mobile.png`, `phase07-mobile-controls.png`, `phase07-diagnostics.png`: desktop 1440×900 and mobile 390×844 inspection.
- `phase07-advanced-final.log`: focused extended-SFU result.

The local evidence is a short synthetic compatibility/resource sample, not a capacity benchmark. It does not validate internet loss/recovery, sustained load, physical devices, real mobile hardware, Safari/Firefox, power/thermals, public NAT/TURN, hosted CI or public production readiness. No tier is promoted on this evidence alone.

## Deferred and review boundary

Intentionally deferred: measured promotion of B–D (and general A rollout), hardware encoder selection, physical source/native-refresh guarantees, hard hostile-RTP quality policing, public infrastructure qualification, OBS/Studio ingest, Studio Broadcast, screen/system audio and every Phase 08 feature. Full details are in [advanced RTC architecture](../architecture/PHASE_07_RTC.md).

Ready for next phase: **NO**. Owner review/acceptance is required; Phase 07 must not be marked accepted automatically.

Ready for owner review: **YES**. Coordination remains `ACTIVE_PHASE: 07`, `STATUS: AWAITING_REVIEW`. Stop here; do not activate Phase 08.
