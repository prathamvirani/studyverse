# Phase 06 report

2026-09-11. **Status: AWAITING_REVIEW — implementation complete under the owner's Phase 06 amendment.** Phase 06 remains unaccepted. Phase 05 acceptance is recorded; no Phase 07 work was started.

The real local RTC baseline now works through LiveKit. This completion pass supersedes the earlier incomplete report and implements the owner's explicit amendment: security grants remain server/provider-enforced, while video quality ceilings are trusted-client capture/encoding policy. Stock LiveKit's lack of hard hostile-RTP dimension/FPS/bitrate policing is documented rather than used to disable the feature. Full design and operational details are in [RTC architecture](../architecture/PHASE_06_RTC.md).

## Implemented and integrated

- The independent RTC module, generic `RealtimeMediaProvider`/`MediaAuthority` contracts and separate LiveKit browser/server adapters remain. RoomShell has no LiveKit import; media controls and renderers use existing registries and the generic workspace. Text chat remains on application WebSocket/HTTPS.
- Compose now runs pinned LiveKit **v1.13.6** at digest `sha256:e37d68f172556d02aa77968b9fc55ef481468c0315fa38e4fa6c56ce72e3a815`, with client SDK **2.22.3** and server SDK **2.19.0**. The existing dev command generates protected random local credentials/configuration, starts the SFU and applies Caddy configuration. It also fixes the workstation's existing ACL setup failure by verifying the exact secure ACL before trying to replace it, without weakening access controls.
- Signaling goes through existing HTTPS/Caddy at `wss://localhost:8443/rtc`; browser CSP stays same-origin. Server/admin operations use the private Compose network. Exposed SFU ports 7880, 7881, 7882/UDP and local TURN 3478/UDP bind **127.0.0.1 only**. Container metrics stay internal on 6789. SFU health and application readiness are checked. Authenticated embedded local TURN plus the internal container candidate fixes Docker loopback ICE without browser security flags.
- Microphone supports explicit acquisition/publication, mute/unmute, unpublish, permission errors, input switching, device-ended handling and cleanup. Basic Standard/High Opus-oriented processing is retained; no unsupported fidelity claim or Studio Voice was added.
- Camera supports explicit capture/on/off, switching, ended/failed capture cleanup and SDK reconnect. A map owns one element per logical track: expansion moves the same node from circle to workspace, leaving the avatar; close/minimize returns it. Regression tests verify both one location and node identity.
- Browser screen capture uses native getDisplayMedia in product code. Cancellation never retries automatically. Browser-ended tracks and stop remove their generic tiles; multiple independent screen tiles remain supported. If connection is needed first, the user deliberately clicks Share again to preserve native picker activation. System audio is not requested.
- Room entry remains fast and receive-only, with no permission prompt or preview. Mic/camera/screen start off. Reload/navigation never restore capture or credentials. Async stale/late operations cannot reactivate disposed media. Terminal disconnect clears tracks, stream references, rendering caches and subscriptions.

## Authorization, privacy and revocation

Join accepts only a room UUID. Existing session, CSRF, Origin, strict schema, permission, rate and feature-flag enforcement remains. The backend rechecks current session revocation/expiry, identity, room membership and owner-block/access policy before and after signing. It allocates an opaque per-connection identity and exact provider room; clients cannot supply account identity, roles or source authority.

Initial credentials expire after 60 seconds and grant room join/subscribe plus only microphone, camera and screen_share publication. Data, screen audio, metadata mutation, admin/create/list/record and ingress capabilities are excluded. Browser storage contains no media credentials. All current authorized room-member roles receive basic media capabilities; no durable permission editor or media migration was introduced.

Leases renew every 10 seconds, expire after 30 seconds and are checked server-side every two seconds. Revoked sessions, removed memberships, changed blocks and stale leases trigger provider RemoveParticipant. The LiveKit adapter also reconciles the whole isolated media namespace with the current application lease inventory, removing retired/replayed/orphaned identities independently of browser cooperation. Startup clears the authority's ephemeral SFU rooms; ongoing reconciliation handles copied credentials replayed after restart. Tests and development have distinct namespaces. Disabling RTC admission keeps configured removal/reconciliation active so old credentials cannot bypass cleanup after a flag-off restart.

**Limits:** self-hosted removal does not cryptographically invalidate a copied JWT, and LiveKit may issue refreshed reconnect tokens. A replay can briefly reconnect before the next successful removal. API/SFU/admin-network outages delay enforcement; normal two-second polling is not an outage-proof or zero-frame guarantee. The expired-token test uses expiry beyond normal clock tolerance, not an exact millisecond cutoff. LiveKit Cloud has supported token revocation behavior that this self-hosted deployment does not claim. One authority/API process owns each namespace; multi-instance authority and stronger admission fencing are future infrastructure work.

SFU roster identities are opaque, with no application user/name/role attributes. The product resolves only valid active publishers through its authenticated application media directory, and all remote audio, cameras and screen tiles use that projection. Unknown or stale media is hidden/unsubscribed. It does not turn a raw provider roster into social presence.

The owner-authorized room-local interpretation is explicit: activating media identifies the publisher inside that authorized room, with `Media active` status where needed, even when global presence is hidden. Friends/global presence privacy stays unchanged. No private profile/email/OAuth metadata is added.

For a safe Basic RTC block boundary, blocked accounts cannot hold concurrent media leases in a room. Conflicting admission is denied; new blocks invalidate affected media leases and can stop both accounts' media. Unrelated media and durable memberships remain intact. Between ordinary blocked members, an existing media lease prevents conflicting admission until it leaves; owner blocks additionally enforce accepted room access denial. Finer-grained subscription isolation is deferred. The polling/removal transient window still applies.

## Devices, reconnect, profiles and efficiency

Each tab/device owns a distinct connection and its own local tracks, with four allocated connections per logical session. The rail presents one primary camera per account and provides separate device-camera expansion controls. Secondary cameras stay unsubscribed until used; screen tracks are independently tiled. The real same-account two-tab test verifies distinct publications and that closing one tab leaves the other publishing. No physical two-device test is claimed.

Temporary media and signaling reconnect show reconnecting state; successful SDK resume keeps media working. The real signaling interruption test found and fixed the missing `SignalReconnecting` handler, verifies the displayed transition and subsequent received frames. Full reload requires deliberate room entry/capture again. Terminal removal releases local capture. Native device removal, permission failure and late capture races also have deterministic adapter/controller tests; physical unplug/Bluetooth/sleep-wake remain untested.

| Trusted product request         | Ceiling                              |
| ------------------------------- | ------------------------------------ |
| Camera capture/main encoding    | 1280×720 @ 30 FPS, 2 Mbit/s          |
| Camera low simulcast layer      | 640×360, 400 kbit/s                  |
| Browser screen capture/encoding | 1920×1080 @ 30 FPS, 4 Mbit/s         |
| Standard / High microphone      | 64 / 96 kbit/s Opus-oriented presets |

Circle subscriptions request low/360p; expanded camera/screen requests stay within their respective ceilings. Hidden/minimized video unsubscribes. Requested and measured actual profiles remain separate: RTC stats collect available dimensions, FPS, codec and byte-delta bitrate; unavailable values stay unknown. Actual delivery can be below requests. Internal SFU metrics expose aggregate resource counters without media contents. No hard hostile-publisher RTP quality enforcement, comprehensive bandwidth benchmark or automatic abuse-removal policy is claimed; those are documented resource/infrastructure concerns under the amendment.

## Validation

`npm run validate:phase06` **passed, exit 0: 232 tests, no skips**, including the complete Phase 05 → 04 → 03 → 02 → 01 → 00 regression chain. Final log: `.local/validation/phase06-completion-final.log`. The final configured Compose rebuild/startup passed: `.local/validation/phase06-compose-final.log`. The run includes the actual disabled-backend browser regression and enabled/disabled SFU inventory cleanup. Local validation was performed; hosted CI was not run. Existing upstream build warnings remain nonblocking.

| Suite                                                               | Result                                  |
| ------------------------------------------------------------------- | --------------------------------------- |
| Unit, provider contract, HTTP/integration and architecture          | 147 passed                              |
| Real PostgreSQL/Redis and accepted service regressions              | 62 passed                               |
| HTTPS Chromium, including five real SFU scenarios                   | 21 passed                               |
| Docker readiness and actual Caddy/SFU signaling                     | 2 passed                                |
| Format, lint, dependency boundaries, API/Nuxt types, contract drift | Passed                                  |
| Source security, Gitleaks and dependency audit                      | Passed; zero dependency vulnerabilities |
| API/Nuxt builds and configured Compose startup                      | Passed                                  |

The mandatory real-SFU scenarios cover:

- two different authenticated application users with simultaneous cameras; received video frames in circles and the same node moved to/from an expanded tile;
- received microphone RTP bytes, mute/unmute and unpublish; a synthetic screen-source track forwarded into the real workspace tile;
- interrupted WSS signaling and successful reconnect/frame delivery; reload privacy; actual removed membership and session logout; cached-token replay subsequently removed by the backend;
- same-account independent tabs and distinct camera publications; server-enforced blocks and denied readmission;
- modified SFU room/identity parameters remaining scoped to signed claims; camera-only source grants denying mic/screen; subscribe-only grants denying publication **after deliberately bypassing SDK preflight**; tampered and expired token rejection; orphan inventory removal by both enabled and disabled authorities without a cooperating product client.

Existing HTTP tests additionally cover forged account/owner/role/source/quality fields, missing CSRF, wrong rooms, revoked/removed access, feature-flag bypass, stale/duplicate/cross-session operations, capacity, races during signing and private media projection. Existing application WebSocket authorization, chat, productivity, presence/privacy, backgrounds and Phase 00–05 regressions remain. No test/security assertion was weakened to enable RTC. The Caddy probe caught an old mounted configuration still loaded in its process; dev startup now recreates the proxy with its admin API still disabled.

## Evidence and limits

Real SFU screenshots in `.local/validation/`:

- `phase06-live-off.png`, `phase06-live-mic.png`;
- `phase06-live-circle.png`, `phase06-live-expanded.png`;
- `phase06-live-screen-desktop.png`, `phase06-live-screen-tablet.png`, `phase06-live-screen-mobile.png`.

Desktop 1440×900, tablet 768×1024 and mobile 390×844 were visually inspected; the accepted 320px regressions remain. The background-first hierarchy, narrow circular rail, dock and ordered panels remain. Screen content is letterboxed instead of cropped. The earlier `phase06-permission-error.png` and lifecycle/screenshare evidence use the explicitly isolated mock-provider fixture and are not described as SFU forwarding evidence.

**Synthetic capture, real transport:** the new real-SFU scenarios use canvas/Web Audio MediaStreams because this workstation's native fake-capture path was unavailable. Screen-picker results are mocked, but the production adapter's source publication, provider signaling, encrypted WebRTC forwarding and remote rendering are real. Authentication uses the existing isolated fake OAuth provider with actual application sessions/membership in `study_test`; it is not a production authentication bypass. Separate mock-provider/SDK tests exercise deterministic device/permission/failure races.

No manual hardware, audible fidelity, physical multi-device, native OS picker, Safari/Firefox, real mobile browser, public NAT, external TURN/TLS, or hosted CI testing is claimed. This is an operational **same-machine development baseline**, not public production deployment approval. Provider outage and polling limits above remain explicit.

## Deferred and coordination

No Phase 07 advanced quality panels, custom dimensions/FPS, 4K/high-refresh, codec preference UI, manual bitrate controls, quality-vs-latency, advanced simulcast controls, Studio Voice or OBS ingest were implemented. Broad fidelity cleanup and public infrastructure deployment remain deferred.

Phase 06 remains the active phase with `STATUS: AWAITING_REVIEW`. Implementation is ready for owner review and remains unaccepted. **Ready for next phase: NO — only the owner may accept Phase 06 and authorize advancement.**
