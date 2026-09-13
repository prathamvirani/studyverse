# Advanced RTC quality architecture

Phase 07, 2026-09-13. Extends the accepted RTC implementation; no parallel media path, new server action, migration, permission or grant.

## Ownership

- Contracts own strict local quality/preference schemas, named preset mapping, deployment ceiling mapping and pure render-target calculation.
- The generic `RealtimeMediaProvider.quality` extension exposes capabilities, preferences and asynchronous apply. Media snapshots separate requested, effective request, source capture and actual RTP values.
- The RTC feature owns the account-scoped preference definition. Web RTC composition owns its local model and secondary More-panel component; RoomShell remains provider/feature neutral.
- The LiveKit adapter owns codec discovery, capture constraints, Opus and video publish options, simulcast/SVC negotiation, fallbacks, reconfiguration and stats. SDK-specific types never reach RoomShell.

## Policy and negotiation

`NUXT_PUBLIC_RTC_QUALITY_STAGE` is a public, trusted-product resource policy. It is not source, membership, room or role authority and does not police hostile RTP. Default/invalid configuration uses `basic`. The provider validates explicit stage arguments. Existing admission accepts only room ID; no user quality request reaches credentials.

Basic defaults remain camera 720p30/2 Mbps, screen 1080p30/4 Mbps, ordinary 64 kbit/s Opus and capture off. A selects a 1080p60/8 Mbps envelope; B 1440p60/12 Mbps; C custom dimensions through 7680×4320 at 60 FPS/30 Mbps; D the same dimensional range through 250 FPS/50 Mbps. These are upper request envelopes, not preset defaults. No tier is promoted in the normal deployment by this phase. The isolated browser harness exercises A explicitly. B–D require subsequent operational measurements before rollout.

Codec candidates are intersected with browser sender capabilities and SDK VP9/AV1 support. Unavailable requests use Auto and report a warning. The provider can further negotiate a different codec. VP8/H264 use simulcast when selected; VP9/AV1 use SVC, with one spatial layer when layers are off. Layer choices adapt to the selected codec and screen defaults remain single-layer. The SDK's normal backup-codec regression avoids deliberately encoding two primary codecs indefinitely. Main and screen encoding options are both set explicitly.

Quality/latency choices map to maintain-resolution / maintain-framerate degradation preferences; these tradeoffs do not guarantee latency. Capture aspect ratio remains browser/source dependent. Native means no preferred capture dimensions before applying the deployment envelope; neither OS display refresh nor pre-capture source dimensions are fabricated. Fixed resolution/custom width and height are bounded requests, not promises of exact physical source output. Hardware encoder selection is unavailable.

Audio remains normal WebRTC Opus. Standard retains processing and 64 kbit/s; High retains echo cancellation with reduced other DSP and 96 kbit/s; Studio Voice requests 128 kbit/s, 48 kHz capture, EC/NS/AGC/voice isolation off and DTX off. Supported processing can be selectively enabled, channel intent selected and Opus ceiling adjusted. Unsupported capture values are not asserted as achieved. No lossless, bit-depth or studio-fidelity claim; screen audio and Studio Broadcast remain outside this phase.

## Lifecycle and subscriptions

Apply operations serialize, coalesce pending revisions, wait for pending acquisitions and check connection generation/track ownership around awaits. Processing-only changes use `applyConstraints`. Changes needing new encoding options or dimensions renegotiate publication on the existing capture track. This can briefly interrupt delivery and replace the publication SID; a previously expanded camera may return to its circle. Device switching alone uses SDK restartTrack with the selected profile. A screen profile change never opens another display picker. Failed advanced capture constraints keep available capture with a warning; failed publication tries conservative encoding. A failed reapply attempts prior encoding and stops only the affected source if both attempts fail. Disposal or ended capture cannot revive a retired publication.

Renderers still own one media element per logical track and move it between circle and workspace. ResizeObserver supplies actual CSS render dimensions, IntersectionObserver handles offscreen surfaces and document visibility pauses hidden video; audio continues unless muted. Circles request low/640×360, workspace dimensions are bounded by the independent receive ceiling, and hidden/minimized video unsubscribes. Exact layer availability depends on publisher/provider; a non-layered publication cannot guarantee exact receive dimensions. No max-quality subscription is made merely because a user chose High.

Preferences use the accepted IndexedDB store, scoped to account/device, with memory fallback. Current settings and up to twelve named profiles persist. Reads/writes are validated; no tracks, activation state, grants, tokens, credentials or diagnostics are stored. Tabs load independently; another tab's write does not change active capture. Last explicit write wins. Disposal fences late preference restoration.

## Diagnostics and evidence

Three-second RTC samples derive dimensions/FPS/codec and byte-delta bitrate from RTP reports. Bitrate sums sampled encodings (including layers), not total wire overhead; initial/reset/missing samples remain unknown. Capture settings come from `getSettings`, separately labeled. Jitter, RTT, lost packets, dropped frames, cumulative encode/decode time and encoder limitation are shown when available. Stale unavailable reports clear actual values. CPU, GPU, thermal and battery data are not invented in the UI.

See the [phase report](../reports/PHASE_07_REPORT.md) for representative tests and local SFU measurements. Pinned SDK source and [LiveKit publish options](https://docs.livekit.io/reference/client-sdk-js/interfaces/TrackPublishDefaults.html) establish supported options; [advanced media documentation](https://docs.livekit.io/transport/media/advanced/) describes codec and layer negotiation. Measured results establish what happened in this environment.
