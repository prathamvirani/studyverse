# Application and Media Transport Decision

Status: Owner-approved architectural direction, 2026-09-11. This amends interpretation of the umbrella and Phase 04; originally recorded during Phase 04. Basic RTC is now accepted under the owner’s Phase 06 amendment; see [RTC architecture](PHASE_06_RTC.md). This decision record does not authorize Phase 07.

## Canonical transport split

| Plane               | Transport                                  | Responsibilities                                                                                                                 |
| ------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Application/control | HTTPS                                      | CRUD, durable APIs, initial state                                                                                                |
| Application/control | Existing authenticated WebSocket transport | Text chat, presence, friends, invitations, Personal/Shared Pomodoro, Personal/Shared tasks, room/application events              |
| Media               | Browser WebRTC through an SFU              | Microphone, camera, screen share, OBS/Studio ingest where applicable                                                             |
| Optional/future     | WebTransport                               | Only uses with a concrete QUIC stream/datagram advantage, such as high-frequency mini-game state or specialized binary transfers |

Text chat never uses RTCDataChannel. Its persistence, history, moderation, ordering, server authorization, limits and reconnect/resync belong to the application plane. Reconnecting clients fetch authoritative history/snapshots; the UI must not claim delivery while disconnected. Voice/video/screens are a separate media plane.

## SFU and provider boundary

Use WebRTC via an SFU rather than naive full-mesh peer-to-peer multi-user rooms. A publisher sends media to the SFU rather than a separate upload per participant. Prefer forwarding encoded media, not server decoding/re-encoding/compositing, to control upload, CPU, latency and quality costs.

LiveKit is the owner's preferred initial SFU direction behind a generic media-provider adapter. Reasons for this preference are its established browser/SFU ecosystem, simulcast/SVC and adaptive-subscription direction, and managed/self-hosted deployment options. Validate actual selected SDK/provider capabilities during the authorized RTC phase.

Future modules consume a stable provider port following repository SDK conventions. Its conceptual operations are connect/disconnect, publishMicrophone/publishCamera/publishScreen, unpublish, subscribe/unsubscribe, setReceiveQuality/setPublishQuality, and getActualMediaStats. Provider-neutral models and errors belong in public contracts; concrete SDK imports belong only in adapters/composition. RoomShell and unrelated features must not depend on LiveKit internals. Preserve a future MediasoupAdapter or another provider without rewriting them. No speculative runtime media API or SDK is added in Phase 04.

## Adaptive subscriptions

| Rendered surface   | Intended subscription                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| Participant circle | Lowest useful layer, roughly 360p target; accepted practical 480p ceiling |
| Small tile         | Progressively higher useful layer                                         |
| Large tile         | 720p/1080p where useful and permitted                                     |
| Fullscreen         | Highest useful permitted layer                                            |
| Hidden/minimized   | Stop receiving video where practical                                      |

Use simulcast/SVC/dynamic subscriptions where supported. “Max” means highest useful quality for actual rendered size within user-selected ceilings and phase development caps, not maximum resolution for every stream. Expose Requested quality separately from Actual negotiated/delivered quality because browser, OS, hardware, network and server constraints apply. Preserve initial RTC caps (720p30 camera, 1080p30 screen share) until explicitly unlocked.

## WebTransport boundary

WebTransport is optional future tooling, not the planned replacement for WebRTC media. Do not build custom camera/microphone/screen-share transport over WebTransport/WebCodecs without a future explicit decision. Do not rebuild congestion control, jitter buffering, loss recovery, A/V synchronization, adaptive bitrate, codec negotiation, media interoperability, NAT traversal or echo/device integration without a compelling later requirement.

## Historical Phase 04 implementation boundary

Implement only Personal/Shared Pomodoro, separately stored Personal/Shared tasks and shared room text chat over the existing application transport. Do not implement voice, camera, screen sharing, SFU integration, LiveKit, WebTransport media or any Phase 05+ feature. Personal timer state remains private account data and cannot be projected through room subscriptions. Shared timer state remains room data. Scope switching preserves inactive state.
