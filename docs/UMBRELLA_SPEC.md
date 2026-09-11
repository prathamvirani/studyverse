# Umbrella Product & Technical Specification
## Studyverse-Inspired Social Study Platform
**Working title:** `[PROJECT NAME TBD]`  
**Document role:** Authoritative umbrella specification  
**Status:** Product direction locked unless explicitly revised by the product owner  
**Primary client:** Web application  
**Planned companion clients:** Browser extension + true native applications  
**Legacy inspiration:** The now-defunct `studyverse.live` room experience, reimagined rather than cloned

---

# 0. How to Use This Document

This document is the top-level product, UX, architecture, realtime, security, and implementation contract for the project.

Implementation agents must treat it as the source of truth.

When a downstream implementation choice conflicts with this document:

1. follow this document;
2. do not silently reinterpret the product;
3. surface the conflict;
4. propose options;
5. preserve backward compatibility with already-accepted behavior where possible.

This is not merely a feature wishlist. It defines interaction rules, persistence rules, security boundaries, ownership semantics, realtime behavior, and future-client constraints that should influence the architecture from the beginning.

---

# 1. Product Vision

Build a persistent, immersive, social study platform where the **room itself is the application**.

A room should feel like entering a shared study environment rather than joining a video meeting or opening a generic productivity dashboard.

The central experience combines:

- a full-screen customizable visual environment;
- lightweight social presence;
- optional microphone, camera, and screen sharing;
- synchronized or personal media;
- shared and personal productivity tools;
- persistent rooms that participants can re-enter even when the owner is away;
- low-friction authentication;
- strong server-side security;
- privacy-first personal media state;
- quality controls suitable for both ordinary users and enthusiasts with high-end hardware.

The product must preserve the emotional appeal of the original Studyverse-style experience while improving media quality, permissions, security, persistence, extensibility, and platform support.

---

# 2. Core Product Principles

## 2.1 The room is the interface

Do not redesign the room into a dashboard with the background as decoration.

The background remains visually dominant.

Controls float over the room and should feel lightweight, translucent, and unobtrusive.

The center of the room remains mostly free unless the user deliberately places expanded cameras, screen shares, personal media, notes, or other workspace tiles there.

## 2.2 Entering a room is not joining a meeting

Default behavior:

- microphone off;
- camera off;
- screen share off;
- no mandatory video preview screen;
- no forced device-check interstitial unless the user requests it;
- enter quickly and start studying.

## 2.3 Personal state is local-first

Where appropriate, personal preferences and private playback state should live in the user's browser/device first.

Examples:

- panel positions;
- floating tile positions and sizes;
- collapsed states;
- preferred media quality profiles;
- preferred microphone processing;
- personal mixer state;
- background favorites;
- lecture playback speed;
- personal media playback progress;
- recently opened personal media;
- device preferences.

Use IndexedDB for structured local state and `localStorage` only for small, non-sensitive preferences.

Never store authentication secrets, session tokens, refresh tokens, university credentials, or equivalent secrets in browser-readable storage.

Optional cross-device synchronization may be added later, but must be opt-in for personal/private state.

## 2.4 Server-authoritative security

The frontend is untrusted.

The API is assumed discoverable.

Users are assumed capable of:

- opening DevTools;
- viewing all requests;
- copying requests as cURL;
- replaying requests;
- editing payloads;
- enumerating IDs;
- crafting WebSocket messages;
- writing their own client.

The system must remain secure anyway.

The UI hiding an action is UX.

The server rejecting unauthorized use of that action is security.

## 2.5 Advanced users should not be artificially limited

Basic users get understandable presets.

Advanced users can access detailed stream controls for resolution, frame rate, bitrate, codec preference, processing, and quality ceilings.

Do not impose arbitrary 60 FPS or conventional-resolution ceilings where the underlying capture/encoder/browser stack can support more.

Requested quality and actual delivered quality must be reported separately.

## 2.6 No Electron desktop application

The future desktop application must use a **true native UI stack**.

Do not ship an Electron wrapper.

Do not treat an embedded website shell as the long-term desktop application.

Cross-platform shared libraries are allowed for protocol, business logic, codec helpers, sync logic, cryptography wrappers, and domain models, but platform UI and operating-system integration must be native.

---

# 3. High-Level Information Architecture

Primary navigation outside a room:

- Home
- Discover
- Friends
- My Rooms
- Notifications
- Profile / Settings

## 3.1 Home

May include:

- active public rooms;
- rooms with the highest current participation;
- friends currently studying;
- recently visited rooms;
- owned rooms;
- favorite rooms;
- suggested rooms;
- scheduled study sessions later.

## 3.2 Discover

Support:

- public rooms;
- categories/tags;
- search;
- active participant counts;
- room topics;
- language;
- study type;
- privacy-aware friend activity.

## 3.3 Friends

Support:

- online/offline status;
- active/focus/break/away states;
- friend requests;
- remove friend;
- block;
- invite to room;
- join friend if room/privacy settings permit;
- direct profile access.

## 3.4 My Rooms

Support:

- owned rooms;
- moderated rooms;
- joined/favorite rooms;
- last visited;
- room activity;
- room privacy state;
- room participant count.

---

# 4. Authentication and Account Model

## 4.1 Supported sign-in methods

Initial target:

- Google
- Microsoft
- Discord

Optional later:

- email/password
- passkeys/WebAuthn
- institution SSO where justified

Use authorization-code flows with PKCE and appropriate state/nonce validation.

## 4.2 Session architecture

Use server-managed sessions or an equivalent backend-for-frontend architecture.

Recommended browser session cookie characteristics:

- `Secure`
- `HttpOnly`
- appropriate `SameSite`
- host-scoped where practical
- opaque, high-entropy session identifier
- revocable
- rotated transparently

Do not expose long-lived authentication credentials to frontend JavaScript.

Users should remain signed in with minimal friction.

## 4.3 Session controls

Provide a sessions/devices view with:

- current device;
- other active devices;
- last active time;
- coarse location if useful;
- sign out one device;
- sign out all other devices;
- revoke all sessions.

Sensitive account operations should support step-up authentication.

---

# 5. Presence Model

Presence is first-class.

Supported states should include:

- Online
- Focusing / Studying
- On Break
- Away
- Do Not Disturb
- Offline

Presence may be reflected in:

- participant circles;
- friend lists;
- home activity;
- room discovery where permitted;
- invitations.

Privacy controls must determine whether others can see:

- online status;
- current room;
- room joinability;
- current activity label.

---

# 6. Canonical Room Layout

The room UI has four main persistent zones plus the central workspace.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ←         [ Room Name / Privacy ]                 [ Invite ]        │
│                                                                     │
│  ○ Participant 1                                  ┌──────────────┐  │
│  ○ Participant 2                                  │ Pomodoro     │  │
│  ○ Participant 3                                  ├──────────────┤  │
│  ○ Participant 4        CENTRAL WORKSPACE         │ Tasks        │  │
│                         / BACKGROUND               ├──────────────┤  │
│                                                   │ Chat         │  │
│                                                   └──────────────┘  │
│                                                                     │
│                 [ Media ][ Background ][ Mic ][ Cam ][ Share ][•••] │
└─────────────────────────────────────────────────────────────────────┘
```

The exact visual design may evolve, but the spatial hierarchy should not be silently replaced with a generic dashboard.

---

# 7. Left Participant Rail

## 7.1 Layout

A tall, narrow floating rail on the left.

Participants are shown vertically as circular avatars.

Participants populate from the top downward.

The rail should be visually compact and should not dominate the room.

## 7.2 Participant interaction

Hovering a participant reveals a compact menu affordance.

Right-click should also open the participant context menu on desktop where appropriate.

Possible actions:

- view profile;
- add/remove friend;
- invite;
- direct interaction later;
- mute locally;
- adjust local participant volume;
- report;
- block;
- moderator actions where authorized;
- expand camera;
- expand screen share where appropriate.

## 7.3 Camera-in-circle rule

When a user turns on their camera:

- the participant's avatar circle becomes the live camera stream;
- no additional video tile is created automatically.

## 7.4 Expanded-camera rule — DO NOT REINTERPRET

When a camera is expanded:

1. the participant circle immediately returns to the participant's profile picture/avatar;
2. the camera stream moves into one draggable/resizable workspace tile;
3. there must not be two independently rendered copies of the same camera stream;
4. closing/minimizing the expanded tile returns the live camera to the participant circle.

Conceptually:

```text
CAMERA OFF
Participant rail:
[ avatar ]

CAMERA ON
Participant rail:
[ live camera ]

CAMERA ON + EXPANDED
Participant rail:        Workspace:
[ avatar ]               [ one live camera tile ]

EXPANDED TILE CLOSED
Participant rail:
[ live camera ]
```

## 7.5 Participant-circle stream quality

Because the circle is small:

- target around 360p for normal circle rendering;
- permit up to 480p as an absolute practical ceiling where useful;
- do not waste bandwidth delivering 1080p to a tiny avatar circle.

When expanded, request an appropriate higher-quality layer.

---

# 8. Central Workspace Layer

The center of the room is a transparent workspace layer over the background.

It manages:

- draggable tiles;
- resizable tiles;
- z-order;
- snapping;
- saved positions;
- fullscreen;
- minimize/restore;
- tile focus;
- tile persistence per device.

Potential tile types:

- expanded camera;
- screen share;
- personal video/lecture player;
- attached browser tab;
- future notes;
- future whiteboard;
- future document viewer.

Tile layout preferences should be device-local by default.

---

# 9. Top Room Bar

Keep intentionally minimal.

Required:

- Back button
- Room name
- Privacy indicator
- Invite friends button

Optional:

- compact participant count;
- compact room status;
- current focus state.

Do not turn this into a dense global navigation bar.

---

# 10. Right Productivity Rail

Order from top to bottom is canonical:

1. Pomodoro timer
2. Tasks
3. Chat

The rail should be collapsible.

---

# 11. Pomodoro Timer

Support:

- room-shared timer;
- focus duration;
- short break;
- long break;
- cycles;
- pause/resume;
- reset;
- skip;
- room permission model;
- optional personal timer detachment later.

Shared timer state should be server-authoritative with server timestamps so late joiners render the same timer position.

---

# 12. Tasks

One task module with two scopes:

- Personal
- Shared

## 12.1 Personal tasks

Personal tasks:

- are owned by one user;
- are private by default;
- may persist across rooms;
- must never be readable/writable by another user without an explicit future sharing feature.

## 12.2 Shared tasks

Shared tasks:

- belong to the room;
- are synchronized in realtime;
- follow room task permissions;
- support creation, completion, editing, and deletion according to role/permission.

Potential later features:

- subtasks;
- due dates;
- priority;
- assignee;
- labels;
- recurring tasks.

---

# 13. Chat

Room chat should support:

- realtime messages;
- timestamps;
- emoji;
- reactions;
- mentions;
- replies later;
- moderation;
- deleted-message handling;
- rate limiting;
- reporting;
- optional persistence policy.

Never render arbitrary user HTML.

If Markdown is supported, sanitize with a strict allowlist.

---

# 14. Bottom Control Dock

Canonical order/contents:

- Media
- Background
- Microphone
- Camera
- Screen Share
- More (`•••`)

Keep compact.

Avoid creating one permanent bottom-bar icon for every provider or subfeature.

---

# 15. Background System

## 15.1 Built-in library

Launch target should include a curated set comparable to or exceeding the original platform's breadth.

Target:

- at least ~60 built-in backgrounds;
- emphasize calm, low-distraction visuals;
- long-loop GIFs/animations should loop seamlessly enough that repetition is not distracting;
- also support static images.

Potential categories:

- cozy rooms;
- libraries;
- rainy windows;
- cafés;
- city nights;
- space;
- nature;
- minimalist;
- anime-inspired original environments where licensing permits;
- seasonal.

## 15.2 User uploads

Allow personal or room background uploads depending on permissions:

- image;
- GIF/animated image;
- future video loop if safe and performant.

Upload security:

- verify actual file type;
- enforce size limits;
- sanitize/re-encode where practical;
- isolate user media from primary app origin;
- do not trust browser-supplied MIME alone;
- protect against malicious polyglot content;
- maintain quotas.

## 15.3 Future scene backgrounds

Later, support scene presets that combine:

- visual layer;
- ambient audio;
- room lighting/tint;
- subtle effects.

---

# 16. Media Architecture Overview

Media has two primary scopes:

## 16.1 Room media

Shared with the room.

Examples:

- synchronized YouTube;
- supported synchronized provider playback;
- shared ambience;
- shared media queue.

## 16.2 Personal media

Private to one user.

Examples:

- personal YouTube lecture;
- university video;
- Vimeo;
- direct media;
- attached browser tab;
- personal Spotify;
- personal ambience;
- private study player.

The UI must clearly indicate scope.

---

# 17. Unified Media Panel

The Media button opens a provider-neutral panel.

Conceptual structure:

```text
MEDIA

Room
- Shared music
- Shared ambience
- Shared queue
- Mix
- Suggestions

Personal
- Study Player
- Personal music
- Personal ambience
- Browser/tab media
- Recent media
```

Providers should be represented through adapters, not hardwired throughout the UI.

---

# 18. Room-Wide YouTube

YouTube is the primary synchronized room-media target.

Synchronization model should use:

- provider/content ID;
- play/pause state;
- playhead;
- playback rate;
- server timestamp;
- queue;
- controller identity;
- periodic drift correction.

Do not relay copyrighted audio/video through project servers where provider-side playback can be used.

Each user streams from the provider independently.

Late joiners calculate current playback position from authoritative room state.

---

# 19. YouTube Music

Support YouTube Music links where they can be resolved to compatible YouTube playback.

Treat this as a provider-adapter problem.

If a YouTube Music URL maps to an embeddable YouTube video ID, use the YouTube synchronization engine.

Do not promise universal YouTube Music compatibility where embedding/provider restrictions prevent it.

---

# 20. Spotify

Spotify should be treated as personal playback unless current platform rules explicitly permit the desired room-wide synchronized behavior.

Personal integration may support, where platform/API access permits:

- browse/search;
- playlists;
- album art;
- play/pause;
- skip;
- seek;
- device selection;
- Spotify Connect style control.

The product must not circumvent provider restrictions.

---

# 21. Apple Music

Investigate Apple Music/MusicKit as:

- a personal music provider;
- potentially a synchronized room provider if technically and contractually permitted.

Do not ship synchronized Apple Music purely because it is technically possible.

Validate current platform terms and account requirements first.

---

# 22. Native Ambience Library

Provide first-party/licensed ambience such as:

- light rain;
- heavy rain;
- fireplace;
- café;
- forest;
- ocean;
- train;
- aircraft cabin;
- keyboard;
- fan;
- night insects;
- quiet library.

Ambience may be:

- room-synchronized;
- personal.

Exact sample alignment is not required for ambience loops.

---

# 23. Audio Mixing

Support independent levels for:

- room music;
- room ambience layers;
- personal media;
- personal ambience;
- voice chat.

Potential user options:

- duck room music when personal lecture plays;
- restore room music when lecture pauses;
- duck personal media when people speak;
- configurable fade timing;
- per-participant voice volume.

Mixer state may be room-shared or personal depending on scope.

---

# 24. Room Media Ownership and Temporary FFA Rules

This behavior is canonical.

## 24.1 Owner baseline

Persist an owner-approved room baseline in durable storage.

Example:

```text
OWNER BASELINE
Music       60%
Rain        25%
Fireplace   10%
Café         0%
```

## 24.2 Owner absent

If configured to allow it, shared session media controls become temporary FFA while the owner is absent.

Temporary changes must **not** overwrite the owner's baseline.

Store them as ephemeral session overrides.

Examples:

- music playback;
- queue;
- ambience selections;
- mix levels;
- other owner-approved temporary controls.

## 24.3 Owner returns

If temporary changes occurred, notify the owner non-intrusively.

Show:

- who changed the mix;
- owner baseline;
- current room state;
- Keep current;
- Restore mine;
- Review changes.

`Keep current` promotes the temporary state to the new owner baseline.

`Restore mine` immediately reapplies the saved owner baseline.

## 24.4 Everyone leaves before owner returns

When active participant count reaches zero:

- discard temporary overrides;
- restore canonical owner baseline;
- clear ephemeral temporary media state.

The next user entering the room should get the last owner-approved state.

## 24.5 Suggestions while owner is present

Members may suggest:

- songs;
- queue changes;
- ambience changes;
- mix levels.

Owner permissions may be configured as:

- Everyone controls
- Suggestions only
- Moderators
- Owner only

Owner-absent behavior may be configured separately:

- Temporary FFA
- Moderators only
- Preserve normal permissions

## 24.6 Never auto-FFA permanent room configuration

Owner absence must not grant random participants authority over permanent settings such as:

- room name;
- room privacy;
- room ownership;
- moderator assignments;
- destructive room actions;
- permanent configuration unless explicitly delegated.

---

# 25. Personal Study Player

Personal media is a first-class bottom-bar feature.

Users can paste supported links and open them in a private draggable/resizable tile.

Examples:

- YouTube lectures;
- YouTube Music-compatible media;
- Vimeo;
- direct MP4/WebM;
- HLS/DASH where safe/compatible;
- supported learning platforms;
- supported public video hosts.

Potential controls:

- play/pause;
- seek;
- playback speed;
- skip ±10 seconds;
- captions;
- volume;
- picture-in-picture where permitted;
- fullscreen;
- remember progress;
- resume;
- minimize to bottom dock.

---

# 26. Personal Playback Persistence

Persist playback progress locally by default.

Recommended state:

```text
PersonalPlaybackState
- provider
- content ID or canonical URL
- title
- lastPositionSeconds
- playbackRate
- volume
- muted
- lastOpenedAt
- tile position/size
```

When returning:

```text
Thermodynamics Lecture 7
Resume from 43:18?

[ Resume ]
[ Start over ]
```

Do not upload private playback history by default.

Do not store temporary auth tokens or sensitive URL query parameters unnecessarily.

Canonicalize URLs and strip transient authentication/signed parameters where possible.

---

# 27. University Portals and Authenticated Media

Do not proxy university logins through the application.

Do not ask users to give the platform their university password.

Use a three-level strategy:

## Level 1 — Provider integration

Use official or supported embed/player APIs when possible.

## Level 2 — Permitted web embed

If the source allows embedding, open it inside a personal web/media tile.

Authentication remains between the user's browser and the provider.

## Level 3 — Browser companion

If the provider disallows embedding, support:

- Open in browser
- Attach browser tab

The source remains in the user's normal browser session.

The study application should receive only the user-authorized capture/integration data required for the feature.

---

# 28. Future Browser Extension

A browser extension is a planned companion product.

It is not required for the first web release, but the architecture should leave room for it.

Potential capabilities:

- Attach current browser tab to Personal Study Player;
- attach authenticated university portals without proxying credentials;
- capture title/media metadata with permission;
- send supported playback state;
- quick-add current page to a study session;
- open current tab as a personal tile;
- future note/highlight capture;
- share a supported public media URL into room media;
- context-menu actions.

Security requirements:

- minimum browser permissions;
- explicit host permissions;
- no broad `*://*/*` access unless truly required and clearly justified;
- granular opt-in;
- do not read password fields;
- do not exfiltrate cookies;
- do not collect browsing history beyond user-directed features;
- isolate extension credentials;
- signed update channel;
- clear permission explanations.

---

# 29. Future Native Applications

The project is expected to gain native applications after the web product is mature.

## 29.1 Non-negotiable native-client rule

Do not build the production desktop app as:

- Electron;
- a Chromium wrapper;
- a thin embedded website shell presented as a native app.

A future desktop client should use native platform UI and integrations.

## 29.2 Permitted shared architecture

The following may be shared across clients:

- protocol definitions;
- API schemas;
- auth abstractions;
- media/session state models;
- synchronization logic;
- encryption helpers;
- native codec bindings;
- domain logic;
- test fixtures.

UI should remain native.

## 29.3 Potential platform direction

Possible future targets:

- Windows: native Windows UI stack;
- macOS: Swift / SwiftUI/AppKit as appropriate;
- iOS/iPadOS: Swift / SwiftUI/UIKit as appropriate;
- Android: Kotlin / Jetpack Compose;
- Linux: native GTK/Qt-style client if demand justifies it.

The exact stack can be decided when the native-client phase begins.

## 29.4 Native-app opportunities

A real native client may eventually provide:

- lower-level capture APIs;
- higher refresh-rate screen capture;
- better hardware encoder access;
- richer audio device configuration;
- global media hotkeys;
- native notifications;
- system tray/menu bar controls;
- better multi-monitor handling;
- virtual camera/audio integrations;
- deeper OBS integration;
- offline personal study state;
- improved accessibility;
- native file/document integration.

---

# 30. Camera, Microphone, and Screen Sharing

Use WebRTC or an equivalent low-latency RTC stack.

The architecture should support an SFU rather than relying on pure peer-to-peer mesh for meaningful room sizes.

Reasons include:

- scaling;
- selective forwarding;
- simulcast/SVC;
- per-receiver quality adaptation;
- efficient participant-circle streams;
- screen-share quality control;
- future recording/moderation options if ever explicitly added.

---

# 31. Basic Media Quality Mode

Default mode should be simple.

## 31.1 Camera presets

Example:

- Auto / Best
- 360p
- 480p
- 720p
- 1080p
- Native

## 31.2 Screen-share presets

Example:

- Auto / Best
- 720p
- 1080p
- 1440p
- Native

Basic FPS options may include:

- Auto
- 30
- 60

But Basic mode must not define the underlying system's maximum capabilities.

## 31.3 Estimated usage

Show rough estimates such as:

- estimated upload Mbps;
- estimated download Mbps;
- estimated GB/hour.

Clearly label estimates as approximate.

---


# 31A. Early Development Media Caps

The long-term product supports advanced, high-resolution, high-refresh-rate media profiles, but the first working RTC implementation should deliberately launch with conservative server-side and client-side caps.

These caps are temporary development constraints intended to:

- reduce cloud bandwidth cost;
- simplify RTC debugging;
- reduce encoder/decoder variability;
- make SFU sizing predictable;
- stabilize camera/screen-share behavior before advanced profiles are introduced;
- allow realistic friend-group testing on inexpensive infrastructure;
- reduce the chance that early bugs accidentally create extremely high bitrate streams.

## 31A.1 Initial camera cap

For the first RTC implementation:

```text
Maximum camera send:
1280×720
30 FPS

Maximum expanded camera receive:
1280×720
30 FPS

Participant-circle receive:
target 360p
maximum 480p where justified
```

The UI may already be structured around Basic/Advanced profiles, but unsupported higher settings must not appear to work before the backend/media stack is ready.

## 31A.2 Initial screen-share cap

For the first RTC implementation:

```text
Maximum browser screen-share send:
1920×1080
30 FPS

Maximum browser screen-share receive:
1920×1080
30 FPS
```

Native source resolution may still be detected and displayed to the user.

Example:

```text
Source:
2560×1600 @ 165 Hz

Current development stream cap:
1920×1080 @ 30 FPS
```

This makes the limitation explicit rather than pretending the source itself is only 1080p30.

## 31A.3 Initial bitrate ceilings

Use conservative configurable bitrate ceilings appropriate to the selected codec and observed quality.

Do not hard-code a single bitrate forever.

Suggested starting ranges for testing:

```text
720p30 camera:
~1.0–2.5 Mbps target range

1080p30 screen share:
~2.5–6 Mbps target range
```

Actual encoder behavior should be measured.

The server must enforce maximum accepted profiles so a modified client cannot bypass development caps and accidentally send an extreme stream.

## 31A.4 Development-stage quality UI

During the capped phase, Basic mode may expose only supported settings.

Advanced mode may either:

- remain hidden behind a development feature flag; or
- show future options as unavailable with a clear explanatory label.

Do not provide controls that imply unsupported high-refresh/high-resolution modes are currently active.

## 31A.5 Progressive unlock plan

After baseline RTC is stable, expand deliberately:

```text
Stage 1
Camera:      up to 720p30
Screen share: up to 1080p30

Stage 2
Camera:      1080p30 / 1080p60 testing
Screen share: 1440p60 testing

Stage 3
Advanced custom resolution/FPS
Higher refresh rates
Codec preferences
Manual bitrate ceilings
Saved profiles

Stage 4
High-refresh experimental profiles
Native-client enhanced capture
Advanced OBS/Studio ingest
```

Each stage should be enabled through configuration/feature flags so infrastructure can be upgraded without rewriting media logic.

## 31A.6 Cost-awareness

The development caps are part of the project's cost-control strategy.

Do not spend money supporting theoretical 1440p165/1080p250/4K/high-bitrate use before:

- real users need it;
- measured bandwidth justifies it;
- the selected SFU/server can handle it;
- receiving clients can decode it reliably;
- appropriate hosting capacity has been provisioned.

The architecture must support these future profiles, but the initial deployment should not pay for them.


# 32. Advanced Media Quality Mode

Advanced mode is intended for users with high-end displays, GPUs, cameras, microphones, and networks.

## 32.1 Screen-share controls

Allow:

- source display selection;
- source native resolution;
- requested output width;
- requested output height;
- preserve aspect ratio;
- requested FPS;
- custom FPS;
- requested bitrate;
- bitrate ceiling;
- codec preference;
- quality/latency priority;
- content type;
- encoder mode where available.

Example frame-rate choices:

- 24
- 30
- 50
- 60
- 75
- 90
- 100
- 120
- 144
- 165
- 200
- 240
- 250
- Native
- Custom

Do not hard-code 60 FPS as the maximum.

Example resolutions:

- 854×480
- 1280×720
- 1920×1080
- 2560×1080
- 2560×1440
- 2560×1600
- 3440×1440
- 3840×2160
- Native
- Custom

## 32.2 Requested vs actual

Always distinguish:

```text
Requested
2560×1600 @ 165 FPS
30 Mbps
AV1

Actual
2560×1600 @ 120 FPS
24.7 Mbps
AV1
```

Never imply the browser/OS/encoder achieved the requested profile if it did not.

## 32.3 Codec preferences

Potential ordering:

- AV1
- VP9
- H.264
- VP8

Actual availability depends on browser, device, hardware, and RTC stack.

---

# 33. Adaptive Receive Quality

A user's receive setting defines a **maximum**, not a demand to download every stream at maximum quality.

Use tile-aware receive quality.

Example:

```text
Participant circle
→ ~360p

Small expanded tile
→ 360p / 480p

Medium tile
→ 720p

Large tile
→ 1080p / 1440p

Fullscreen
→ highest useful layer under user's receive cap
```

Use simulcast and/or scalable video coding where appropriate.

The user's setting means:

> Give me the maximum useful quality for what I am actually viewing, up to my configured ceiling.

---

# 34. Sending and Receiving Profiles

User-specific settings should include separate limits for:

- camera send;
- camera receive;
- screen-share send;
- screen-share receive;
- microphone send;
- remote audio/data-saving behavior where technically meaningful.

Default should be maximum-quality/adaptive behavior.

Users may save profiles such as:

- Campus Wi-Fi
- Home Fibre
- Mobile Hotspot
- High Quality
- Studio
- Presentation
- Gaming / Motion

---

# 35. Live Connection Statistics

Expose an optional diagnostics panel.

Examples:

```text
Connection
↓ 6.8 Mbps
↑ 2.9 Mbps
RTT 31 ms
Packet loss 0.2%

Camera
Sending 1920×1080 @ 30
Actual bitrate 2.73 Mbps

Receiving
3 video streams
1 expanded at 1080p
2 participant bubbles at 360p
```

Advanced users should be able to inspect:

- requested resolution;
- actual resolution;
- requested FPS;
- actual FPS;
- codec;
- bitrate;
- jitter;
- RTT;
- packet loss;
- frame drops;
- encoder stats where available.

---

# 36. Audio Quality

Use Opus as the default realtime voice/audio codec unless future platform constraints justify another option.

## 36.1 Basic microphone modes

Suggested:

- Standard
- High
- Studio

Potential later:

- Music / Instrument

## 36.2 Standard

Optimize for ordinary laptop/headset speech.

May enable:

- echo cancellation;
- noise suppression;
- automatic gain;
- appropriate bitrate.

## 36.3 High

Use less aggressive processing and higher bitrate.

## 36.4 Studio Voice

Designed for quality microphones.

Default behavior:

- high-quality Opus;
- 48 kHz audio pipeline where supported;
- minimal processing;
- echo cancellation off unless user enables;
- noise suppression off unless user enables;
- automatic gain off unless user enables;
- voice isolation off;
- DTX off where appropriate;
- source channel configuration where practical.

Goal:

> Preserve a good microphone rather than over-process it.

## 36.5 Studio Broadcast

Designed for OBS/native ingest or a polished mixed program source.

May support:

- stereo program audio;
- higher bitrate;
- user-side EQ/compression/gate preserved;
- minimal additional voice processing.

Do not market inflated sample-rate/bit-depth numbers that the realtime codec path does not actually preserve.

---

# 37. Browser Screen Share

Provide a quick Browser Share flow.

Example:

```text
SHARE SCREEN

Browser Share
Fastest setup

Studio / OBS
Advanced encoding and scene control
```

Browser Share should support:

- display/window/tab selection as permitted by browser;
- native or custom requested profile;
- advanced controls;
- system audio where browser/OS supports it;
- dynamic quality adaptation.

---

# 38. OBS / Studio Ingest

OBS support is a planned advanced feature and should influence media architecture early.

Provide a familiar stream-key-like workflow.

Example:

```text
STUDIO SHARE

Server
https://ingest.example/...

Stream key
••••••••••••••••

[ Copy ]
[ Regenerate ]

Waiting for stream...
```

Prefer a low-latency ingest protocol suitable for RTC/SFU integration, such as WHIP/WebRTC, when ecosystem support is sufficient.

RTMP/SRT-style compatibility may be considered as alternate ingest paths.

## 38.1 OBS benefits

- hardware AV1;
- NVENC;
- Quick Sync;
- AMD hardware encoders;
- custom canvas;
- arbitrary resolution;
- arbitrary requested frame rate;
- scenes;
- overlays;
- capture cards;
- audio mixer;
- better game capture;
- encoder presets;
- filters.

## 38.2 Stream-key security

OBS ingest credentials are secrets.

Requirements:

- cryptographically random;
- scoped to user/room/session;
- revocable;
- regenerable;
- never predictable from user/room IDs;
- never included in analytics logs;
- short-lived session credentials preferred where practical.

---

# 39. Personal Media Privacy

Personal media is private by default.

Other participants should not receive:

- private URL;
- university portal URL;
- playback history;
- exact lecture title unless user opts in;
- personal queue;
- personal listening history.

Visibility options may include:

- Completely private
- Show generic activity
- Show media title

Default: Completely private.

For supported public media, offer:

- Keep personal
- Suggest to room
- Play for room

---

# 40. Local Data Settings

Provide user controls such as:

```text
Store preferences on this device        ON
Remember personal playback progress     ON
Remember recently opened media          ON

Sync preferences across devices         OFF
Sync playback progress across devices   OFF

[ Clear local personal data ]
```

Guest users should still be able to retain local preferences.

If a guest later creates an account, offer:

- Keep local only
- Import into account

Do not silently upload all local history.

---

# 41. Friends and Participant Social Controls

Support:

- friend requests;
- accept/decline;
- remove friend;
- block;
- invite to room;
- online status;
- privacy-aware room visibility;
- participant context menu.

Later:

- direct messages if desired;
- study streak/social statistics only if they do not become coercive;
- shared schedules.

---

# 42. Room Model

A room should support:

- name;
- owner;
- moderators;
- members;
- public/private/unlisted;
- invite links;
- optional password or invite-only logic;
- description;
- tags;
- room background;
- canonical owner media mix;
- media permissions;
- task permissions;
- chat settings;
- participant capacity;
- persistent existence independently of owner presence.

Participants may join whenever room policy permits, even if the owner is offline.

---

# 43. Permission Model

Use explicit server-side authorization.

Potential roles:

- Owner
- Moderator
- Member
- Guest

Potential permission dimensions:

- invite members;
- moderate chat;
- kick;
- ban;
- edit shared tasks;
- control timer;
- control room media;
- suggest media;
- change temporary ambience;
- change background;
- modify room settings;
- manage moderators;
- delete room.

Do not encode authorization purely through frontend state.

---

# 44. API Security Model

Assume every endpoint will be inspected and replayed manually.

Every mutating request must independently validate:

1. authenticated session;
2. CSRF protections where cookie authentication is used;
3. allowed origin/host checks as defense-in-depth;
4. request schema;
5. object existence;
6. authenticated user's relationship to object;
7. permission for requested action;
8. field-level authorization where necessary;
9. rate limits;
10. business invariants.

Do not trust:

- `userId` from request body;
- `role` from request body;
- `owner=true`;
- client-side permission state;
- hidden buttons;
- route secrecy;
- CORS as an authorization mechanism.

Identity comes from the authenticated session.

---

# 45. Object-Level Authorization / IDOR Protection

Every object access must be scoped to the authenticated user and resource relationship.

This applies to:

- rooms;
- tasks;
- messages;
- invites;
- media state;
- personal playback;
- friend data;
- uploads;
- settings;
- OBS credentials;
- moderation actions.

A valid session does **not** imply access to arbitrary object IDs.

Test explicitly for ID enumeration and cross-user access.

---

# 46. HTTP Semantics

GET/HEAD must never mutate application state.

Use mutating methods for mutations:

- POST
- PUT
- PATCH
- DELETE

Do not create destructive or state-changing GET endpoints.

---

# 47. CSRF and Browser Security

For cookie-authenticated mutations:

- use robust CSRF protection;
- validate origin where appropriate;
- use SameSite cookies as defense-in-depth, not sole defense;
- protect sensitive endpoints with stronger confirmation where justified.

CORS is not authentication.

CORS is not authorization.

A cURL client will not obey browser CORS policy.

---

# 48. WebSocket Security

Realtime connections must be authenticated and authorized.

At connection:

- validate session;
- validate Origin;
- validate room join;
- establish scoped identity.

For every meaningful message:

- validate schema;
- validate current membership;
- validate current permission;
- validate object;
- validate rate limit;
- validate semantic bounds.

Examples:

- room media seek;
- mix update;
- timer control;
- task update;
- chat send;
- moderator action.

If a user's permission changes, the server must enforce it immediately.

Do not trust a socket merely because it successfully connected earlier.

---

# 49. XSS and Content Security

Requirements:

- strict escaping;
- strict CSP;
- no arbitrary user HTML;
- avoid `eval`;
- sanitize Markdown;
- validate URLs;
- isolate uploaded content;
- prefer safe framework rendering;
- use Trusted Types where practical;
- audit third-party scripts.

Chat payloads containing HTML/JavaScript must render harmlessly.

---

# 50. SQL / Data-Layer Security

Use:

- parameterized queries;
- safe ORM/query builders;
- least-privilege DB credentials;
- migrations;
- constraints;
- transactions;
- field validation.

Never construct SQL by concatenating untrusted strings.

Passwords, if supported, should use a modern password hash such as Argon2id with appropriate parameters.

---

# 51. Rate Limiting and Abuse Protection

Apply rate limiting by appropriate dimensions:

- session/user;
- IP;
- room;
- endpoint;
- WebSocket action.

Examples:

- login attempts;
- friend requests;
- chat spam;
- task creation;
- room creation;
- invite generation;
- media-seek spam;
- mix spam;
- OBS credential regeneration.

Use progressive controls where abuse risk warrants it.

Do not degrade normal study usage with overly aggressive limits.

---

# 52. Audit and Security Events

Log important security events:

- login;
- logout;
- session revoke;
- suspicious auth failure;
- room ownership change;
- moderator change;
- ban/kick;
- OBS key regeneration;
- destructive settings change.

Do not log secrets.

Do not log full private personal-media URLs unnecessarily.

---

# 53. Hostile Client Testing

This is mandatory.

The project's security testing philosophy is:

> Any authenticated user may build their own client. They still must only be able to perform authorized actions.

For each feature:

1. perform action through the UI;
2. capture the network request;
3. replay it with cURL/Postman/custom client;
4. modify identifiers;
5. modify roles;
6. modify ownership fields;
7. add unexpected fields;
8. replay expired/revoked credentials;
9. attempt cross-user resource access;
10. attempt cross-room access.

Required expected behavior examples:

- own personal task -> allowed;
- own permitted shared-room task -> allowed;
- another user's personal task -> denied;
- private room not joined -> denied;
- forged `role=owner` -> ignored/denied;
- forged `ownerId` -> ignored/denied;
- unauthorized delete -> denied;
- revoked session -> denied;
- revoked OBS key -> denied;
- unauthorized WebSocket command -> denied.

The implementation is not secure merely because a button is hidden.

---

# 54. External Pentesting and Review

The product owner intends to run the application past technically capable friends and external testers repeatedly.

Design for this.

Do not rely on security through obscurity.

Encourage authorized testing in controlled environments.

Before broader public exposure, consider:

- formal threat modeling;
- dependency scanning;
- secret scanning;
- SAST;
- DAST;
- fuzzing;
- manual API testing;
- WebSocket abuse testing;
- IDOR/BOLA review;
- upload review;
- OAuth review;
- professional penetration testing where justified.

A future responsible-disclosure / vulnerability-reporting policy should be added before public scale.

---

# 55. Privacy Model

Privacy must be understandable.

Separate:

## Device-local private state
- layouts;
- preferences;
- media progress;
- personal history.

## Account state
- profile;
- friends;
- owned rooms;
- optional synced preferences.

## Room state
- shared timer;
- shared tasks;
- room chat;
- room media;
- permissions;
- owner baseline.

Avoid collecting data simply because it is technically available.

---

# 56. Recommended Web Architecture

This section is directional, not immutable.

Potential stack:

## Frontend
- Nuxt
- TypeScript
- Tailwind CSS
- strongly typed API client
- WebRTC client
- IndexedDB/local persistence layer

## Backend
- typed server framework compatible with the Nuxt ecosystem or a separate service layer
- PostgreSQL
- Redis for ephemeral room state/presence
- WebSocket/realtime gateway
- SFU/media service
- object storage
- background workers
- media ingest service for OBS

## Deployment
- HTTPS only
- reverse proxy/CDN
- object media domain
- secret manager
- environment separation
- production-safe observability

Exact implementation choices may change after architecture validation.

---

# 57. Data Model — Conceptual

Potential entities:

```text
User
UserProfile
AuthIdentity
Session
Friendship
Block
Room
RoomMembership
RoomRole
RoomPermission
RoomInvite
RoomBackground
RoomOwnerBaseline
RoomEphemeralState
RoomMediaState
RoomMediaQueue
RoomMixState
RoomTimerState
Task
TaskList
ChatMessage
ChatReaction
Upload
PersonalPreferenceSync
SecurityEvent
OBSIngestCredential
```

Personal local playback state does not need a server entity unless account sync is explicitly enabled.

---


# 57A. Global Modular Architecture

Modularity is a project-wide architectural requirement, not a mini-game-specific concern.

The system should be designed so that new features can be added, removed, disabled, replaced, or experimentally deployed without invasive modification of unrelated core logic.

The main room shell, authentication system, realtime transport, persistence layer, media subsystem, and security model should expose stable contracts that feature modules consume.

The goal is:

```text
Add feature
    ↓
Register module
    ↓
Declare capabilities / routes / events / UI surfaces
    ↓
Feature works

NOT

Add feature
    ↓
Edit RoomShell
    ↓
Edit websocket switch statement
    ↓
Edit permissions
    ↓
Edit database core
    ↓
Edit media logic
    ↓
Break six unrelated things
```

## 57A.1 Core vs feature modules

Keep the core intentionally small.

### Core responsibilities

Core should own only foundational concerns such as:

- authentication/session identity;
- authorization framework;
- room membership;
- feature/module registry;
- event bus;
- realtime transport;
- database access abstractions;
- persistent and ephemeral state infrastructure;
- module lifecycle;
- logging/observability;
- configuration;
- security middleware;
- API versioning;
- capability negotiation;
- client/server protocol contracts;
- workspace/tile host;
- dock/panel extension points.

Core should not contain detailed implementation logic for every product feature.

### Feature modules

Examples of independently scoped modules:

```text
features/
├── presence/
├── friends/
├── pomodoro/
├── tasks/
├── chat/
├── backgrounds/
├── ambience/
├── room-media/
├── personal-media/
├── camera/
├── microphone/
├── screen-share/
├── obs-ingest/
├── mini-games/
├── notifications/
└── future-features/
```

Each module should own its own domain logic as far as practical.

## 57A.2 Module contract

Every module should declare a clear contract.

Conceptually:

```text
FeatureModule
- id
- version
- dependencies
- capabilities
- permissions
- API routes
- realtime events
- persistence requirements
- UI surfaces
- background jobs
- settings schema
- feature flags
- migrations
- lifecycle hooks
```

Not every module needs every field, but the architecture should provide these extension points.

## 57A.3 UI extension points

The room UI should expose named slots rather than require feature code to directly edit the room shell.

Examples:

```text
Room UI extension points
- topBar
- participantContextMenu
- participantBadge
- rightRail
- bottomDock
- mediaPanel
- workspaceTile
- roomMoreMenu
- roomSettings
- profileSettings
- notifications
```

A module registers content into the appropriate surface.

Example:

```text
Pomodoro module
→ registers rightRail panel

Background module
→ registers bottomDock action
→ registers roomSettings page

Personal Media module
→ registers mediaPanel section
→ registers workspaceTile type
```

The core RoomShell should not import dozens of feature-specific components directly.

## 57A.4 Workspace tile registry

All floating workspace objects should use a common tile contract.

Examples:

- camera;
- screen share;
- lecture player;
- browser companion;
- whiteboard;
- notes;
- mini-game;
- future document viewer.

Conceptually:

```text
WorkspaceTileType
- type
- renderer
- minimumSize
- defaultSize
- resizable
- fullscreenable
- serializableLayoutState
- permission requirements
- lifecycle callbacks
```

Adding a future whiteboard should therefore register a new tile type rather than require rewriting drag/resize/z-order code.

## 57A.5 Event-driven integration

Modules should communicate through typed domain events rather than arbitrary cross-imports.

Examples:

```text
room.member.joined
room.member.left
room.owner.present
room.owner.absent
room.empty

timer.focus.started
timer.break.started

media.room.started
media.personal.started

rtc.camera.started
rtc.camera.stopped

game.started
game.ended
```

A feature may subscribe to relevant events without the source feature knowing about every consumer.

Example:

```text
Pomodoro emits:
timer.break.started

Mini-game module listens:
→ optionally surface "Start a quick game"

Pomodoro does NOT import MiniGameService.
```

This separation is strongly preferred.

## 57A.6 Command/event separation

Use clear distinction between:

- commands: requests to perform an action;
- events: facts that already occurred.

Example:

```text
Command:
room.media.setMix

Authorization + validation
        ↓
State change
        ↓
Event:
room.media.mixChanged
```

Do not allow modules to mutate other modules' internal state directly.

## 57A.7 Realtime event registry

Avoid one enormous WebSocket handler such as:

```text
switch(message.type) {
  case "chat":
  case "task":
  case "timer":
  case "game":
  case "media":
  ...
}
```

Instead, use a typed realtime command/event registry.

Conceptually:

```text
realtime.register(
    "tasks.create",
    taskModule.createTaskHandler
)

realtime.register(
    "media.seek",
    roomMediaModule.seekHandler
)
```

Every handler still passes through shared:

- authentication;
- schema validation;
- authorization;
- rate limiting;
- audit hooks.

## 57A.8 API route modularity

Feature routes should be registered by module rather than all living in one central router.

Example:

```text
/tasks/*
/chat/*
/rooms/:roomId/media/*
/rooms/:roomId/games/*
```

Shared middleware is composed around them.

Adding a provider or feature should not require modifying unrelated endpoint handlers.

## 57A.9 Permission registry

Permissions should be capability-based and extensible.

Example:

```text
room.chat.send
room.tasks.create
room.tasks.update
room.timer.control
room.media.control
room.media.suggest
room.game.start
room.background.change
room.member.kick
```

Modules register their permission definitions.

The authorization system evaluates them consistently.

Do not scatter literal role checks throughout the codebase such as:

```text
if (user.role === "owner")
```

unless a fundamental ownership rule genuinely requires it.

Prefer:

```text
authorize(user, room, "room.media.control")
```

This allows future modules to add permissions without rewriting the role system.

## 57A.10 Data ownership

Each module should clearly own its durable and ephemeral data.

Example:

```text
Tasks module
- task tables
- task realtime cache
- task migrations

Chat module
- message tables
- reaction tables

Room Media module
- durable owner baseline
- ephemeral active playback state

Mini-game module
- game definitions
- ephemeral round state
```

Modules should not casually reach into each other's database tables.

Where cross-feature data is necessary, use service contracts or domain events.

## 57A.11 Database migrations

Feature-specific schema changes should ship as isolated migrations.

A module should be removable or disableable without requiring manual surgery to unrelated database structures.

Core tables should remain minimal.

## 57A.12 Provider adapter architecture

External providers must use adapters.

Examples:

```text
MediaProvider
├── YouTubeProvider
├── YouTubeMusicAdapter
├── SpotifyProvider
├── AppleMusicProvider
├── VimeoProvider
└── FutureProvider
```

Common provider contract may expose:

- URL matching;
- metadata resolution;
- capability discovery;
- embed support;
- room-sync support;
- personal playback support;
- seek;
- play/pause;
- current position;
- account requirements.

Adding another media provider should not require changing the general media player logic.

## 57A.13 RTC/media adapters

Where practical, hide SFU/RTC implementation behind interfaces so the product is not permanently welded to one vendor/library.

Potential abstractions:

```text
RtcSession
VideoPublisher
AudioPublisher
ScreenSharePublisher
RemoteTrack
QualityController
StatsProvider
StudioIngest
```

This makes it possible to replace the SFU or add native-client media paths later.

## 57A.14 Storage adapters

Use storage abstractions for:

- object uploads;
- background assets;
- local preferences;
- account sync;
- ephemeral state;
- persistent state.

Avoid business logic depending directly on one storage vendor.

## 57A.15 Feature flags

Every substantial new feature should be feature-flag compatible.

Support:

- disabled;
- development only;
- beta cohort;
- per-room enablement where useful;
- global rollout.

A half-finished feature should not require branching core code all over the project.

## 57A.16 Dependency direction

Prefer:

```text
Feature
    ↓
Core interfaces
```

Avoid:

```text
Core
    ↓
Feature implementation
```

Core may know a generic `FeatureModule` interface.

Core should not know what "Skribbl", "Spotify", "Pomodoro", or "Whiteboard" specifically means.

## 57A.17 Module failure isolation

One optional module failing should not crash the entire room.

Where practical:

- isolate background jobs;
- use timeouts;
- catch provider failures;
- degrade individual panels gracefully;
- surface module-specific errors;
- keep chat/tasks/RTC operational when an unrelated provider fails.

Example:

```text
Spotify API unavailable

→ Spotify panel shows provider error
→ Room remains usable
→ YouTube remains usable
→ Tasks remain usable
→ Chat remains usable
```

## 57A.18 Versioned contracts

Internal client/server contracts should be versioned where future native apps/extensions may depend on them.

Avoid breaking protocol changes merely because the web client can be deployed simultaneously.

The browser extension and future native apps make stable APIs especially important.

## 57A.19 Shared protocol definitions

Generate or share typed contracts across:

- web client;
- server;
- browser extension;
- future native applications where tooling permits.

Examples:

- OpenAPI;
- JSON Schema;
- protobuf;
- typed event schemas.

Do not duplicate protocol definitions manually across clients.

## 57A.20 Extension/native client capability negotiation

Future clients may support different capabilities.

Example:

```text
Web client
- browser screen capture
- WebRTC camera

Native Windows client
- native high-refresh capture
- deeper audio routing
- hardware encoder integration

Browser extension
- attach authenticated browser tab
```

Use capability negotiation rather than branching the entire backend by client type.

## 57A.21 Testing modular boundaries

Tests should verify that:

- modules can initialize independently;
- disabled modules do not break the room;
- missing optional providers fail gracefully;
- module events remain schema-valid;
- one module cannot bypass another's authorization;
- feature flags work;
- migrations remain isolated;
- registry conflicts are detected;
- circular dependencies are rejected where possible.

## 57A.22 Architectural enforcement

Use linting/static architecture tests where practical to prevent dependency erosion.

Examples:

- core cannot import feature modules;
- features cannot import another feature's internal files;
- cross-module access must use public contracts;
- UI modules register through defined extension points;
- server modules register routes/events through defined registries.

The goal is to stop convenient shortcuts from slowly turning the codebase into a tightly coupled monolith.

## 57A.23 Practical rule for every new feature

Before adding a new feature, implementation should answer:

```text
1. Which module owns it?
2. Which existing contracts does it consume?
3. Does it require a new generic extension point?
4. Which permissions does it introduce?
5. Which events does it emit/listen to?
6. Which durable data does it own?
7. Which ephemeral data does it own?
8. How can it be disabled?
9. What happens if it fails?
10. Can it be added without modifying unrelated feature internals?
```

If the answer to #10 is no, reconsider the architecture before implementing.


# 58. Realtime State Strategy

Durable state belongs in persistent storage.

Ephemeral state belongs in a fast realtime store.

Example:

## Durable
- room name;
- room privacy;
- owner baseline;
- membership;
- moderator roles;
- shared task records;
- persistent chat if enabled.

## Ephemeral
- current participant presence;
- typing indicators;
- temporary owner-absent media mix;
- current RTC session state;
- transient playback synchronization data;
- short-lived locks;
- transient connection metrics.

If ephemeral state disappears, the system should recover safely from durable state.

---

# 59. Accessibility

Plan for:

- keyboard navigation;
- visible focus states;
- screen-reader labels;
- reduced motion;
- contrast-safe UI;
- captions where provider/RTC supports them;
- scalable UI;
- color-independent status indicators;
- accessible drag/resize alternatives.

Animated backgrounds should respect reduced-motion preferences.

---

# 60. Performance

Targets should include:

- fast room entry;
- lazy-loaded panels;
- deferred heavy media;
- virtualized large member lists if necessary;
- efficient animated backgrounds;
- adaptive media;
- selective forwarding;
- minimal duplicate streams;
- no unnecessary 1080p participant-circle feeds;
- network-aware behavior without overriding user-defined ceilings.

---

# 61. Reliability

The app should gracefully handle:

- WebSocket reconnect;
- SFU reconnect;
- temporary network loss;
- laptop sleep/wake;
- tab suspension;
- owner disconnect;
- device change;
- Bluetooth switching;
- media-provider errors;
- background upload failure;
- revoked OAuth provider access.

Shared timers/media should re-synchronize after reconnect.

---

# 62. Observability

Production should support:

- structured logs;
- metrics;
- error tracking;
- realtime-service health;
- media quality telemetry;
- aggregate SFU load;
- API latency;
- auth failure rate;
- rate-limit events;
- background upload failures.

Do not collect private media contents.

Do not log secrets.

---

# 63. Development Strategy

Build in phases, but do not let the early implementation destroy the intended experience.

## Phase 0 — Foundations

- monorepo/repo structure;
- environments;
- CI;
- linting;
- testing;
- secrets management;
- auth skeleton;
- security baseline;
- typed contracts;
- DB migrations;
- local persistence abstraction.

## Phase 1 — Identity + Home

- OAuth;
- profile;
- sessions;
- home;
- room discovery;
- rooms list;
- create/join room.

## Phase 2 — Room Shell

- canonical background-first room;
- top bar;
- participant rail;
- right productivity rail;
- bottom dock;
- persistence of local layout/preferences.

## Phase 3 — Presence + Friends

- realtime presence;
- friend requests;
- online states;
- invitations;
- context menus.

## Phase 4 — Productivity Realtime

- shared timer;
- personal/shared tasks;
- room chat;
- authorization tests.

## Phase 5 — Backgrounds

- curated library;
- user uploads;
- security pipeline;
- local favorites.

## Phase 6 — Basic RTC

- microphone;
- camera;
- participant-circle video;
- single-instance expanded video;
- screen share;
- SFU;
- enforce initial camera cap of 720p30;
- enforce initial browser screen-share cap of 1080p30;
- enforce reasonable development bitrate ceilings;
- keep advanced/high-refresh profiles disabled behind feature flags.

## Phase 7 — Advanced RTC

- Basic/Advanced quality UI;
- requested vs actual;
- adaptive receive;
- simulcast/SVC;
- diagnostics;
- saved profiles;
- progressively unlock 1080p60, 1440p60, custom resolutions, custom frame rates, and higher-refresh-rate screen-share requests only after measured RTC stability and infrastructure validation.

## Phase 8 — Room Media

- YouTube room sync;
- queue;
- room permissions;
- owner-absent temporary FFA;
- owner-return reconciliation;
- automatic empty-room reset;
- native ambience.

## Phase 9 — Personal Study Player

- YouTube personal;
- supported provider adapters;
- progress persistence;
- local history;
- audio ducking;
- personal mixer.

## Phase 10 — Spotify / Apple Music

- platform-compliant personal provider support;
- Apple Music room-sync feasibility review;
- provider permission/legal validation.

## Phase 11 — OBS / Studio Ingest

OBS/Studio ingest is intentionally deferred until normal browser RTC is stable and cost/quality measurements exist.

- ingest architecture;
- temporary stream-key-style credentials;
- OBS setup UI;
- WHIP/WebRTC ingest where practical;
- low-latency forwarding;
- Studio Broadcast audio;
- advanced diagnostics;
- hardware-encoded high-quality profiles;
- no requirement to ship OBS integration in the initial friend-group deployment.

## Phase 12 — Browser Extension

- attach tab;
- personal media companion;
- secure permissions;
- current-page integration.

## Phase 13 — Native Applications

- platform-native clients;
- shared protocol/domain libraries;
- native media/device integration;
- no Electron.

---

# 64. Definition of Done for Any Feature

A feature is not complete until it satisfies all applicable categories:

- UX implemented;
- server authorization implemented;
- input validation implemented;
- realtime authorization implemented;
- hostile-client tests added;
- accessibility considered;
- error states handled;
- loading states handled;
- persistence behavior correct;
- privacy behavior correct;
- analytics do not leak sensitive data;
- responsive behavior tested;
- automated tests passing;
- no known high-severity dependency issues;
- feature does not violate canonical room UX.

---

# 65. Security Definition of Done

At minimum:

- unauthenticated mutation rejected;
- forged session rejected;
- expired session rejected;
- revoked session rejected;
- cross-user object access rejected;
- cross-room object access rejected;
- CSRF-less mutation rejected where applicable;
- invalid Origin rejected where applicable;
- GET cannot mutate;
- SQL injection payload treated as data;
- XSS payload rendered harmlessly;
- oversized WebSocket message rejected;
- spam rate-limited;
- socket action permission checked;
- role escalation denied;
- removed member loses realtime permissions;
- logout/revoke invalidates relevant realtime access;
- OBS key revocation works;
- uploaded-content validation works.

---

# 66. Do Not Reinterpret These UX Decisions

Implementation agents must not silently replace the following:

1. **Room-first immersive layout** with a generic productivity dashboard.
2. **Left vertical participant circles** with a conventional large video grid.
3. **Camera occupies the participant circle** until explicitly expanded.
4. **Expanded camera uses one stream renderer, not duplicate camera instances.**
5. **Right rail order:** Pomodoro -> Tasks -> Chat.
6. **Bottom dock purpose:** Media -> Background -> Mic -> Camera -> Share -> More.
7. **Background remains the dominant visual surface.**
8. **Camera/mic default off when entering.**
9. **Personal and shared tasks remain distinct scopes.**
10. **Personal media remains private by default.**
11. **Owner baseline vs temporary owner-absent media overrides remain separate.**
12. **Empty room resets temporary overrides to the owner's last approved baseline.**
13. **Basic quality mode remains simple; Advanced mode remains genuinely granular.**
14. **Advanced screen-share FPS is not arbitrarily capped at 60.**
15. **Requested and actual media quality are shown separately.**
16. **Participant-circle receive quality is capped to a sensible small-stream profile.**
17. **OBS/Studio ingest is an intended advanced path, not a hack.**
18. **Authentication secrets do not live in browser-readable storage.**
19. **Frontend permissions are never the security boundary.**
20. **Future desktop app must be native, not Electron.**
21. **All substantial features must integrate through stable module contracts/registries; do not solve new features by directly modifying unrelated core or feature internals.**
22. **Initial RTC deployment must enforce conservative development caps (720p30 camera, 1080p30 browser screen share); higher profiles and OBS ingest are progressive later-stage unlocks, not launch requirements.**

---

# 67. Product Tone

The application should feel:

- calm;
- cozy;
- modern;
- technically capable;
- private;
- social without being noisy;
- customizable;
- polished;
- not corporate;
- not like Zoom;
- not like Jira;
- not like Discord with a Pomodoro bot;
- not like a generic dashboard template.

Advanced controls should exist without making the default interface intimidating.

---

# 68. Future Possibilities

Not initial commitments, but architecture should not unnecessarily block:

- shared notes;
- collaborative whiteboard;
- assignment/calendar integration;
- room templates;
- study analytics;
- optional streaks;
- scheduled sessions;
- native notifications;
- document/PDF tiles;
- LMS integrations;
- calendar integration;
- focus automation;
- moderation tooling;
- mobile companion mode;
- spatial audio experiments;
- recording only with explicit consent and strong privacy design;
- institution/team rooms later;
- native local media integration;
- study-presence APIs for extension/native clients.

---


# 69. Social Bonding & Mini-Games

The platform should include lightweight optional mini-games and shared activities designed to help room participants bond during breaks without turning the product into a gaming platform.

These experiences should feel like a natural extension of a study room: quick to start, easy to understand, social, and easy to dismiss when users want to return to studying.

## 69.1 Design goals

Mini-games should:

- work well in short study breaks;
- require little or no setup;
- use the existing room participant list and identity system;
- be optional and non-intrusive;
- never auto-start for everyone;
- never block access to the normal room controls;
- be easy to close or minimize;
- support spectators where practical;
- avoid excessive notifications;
- preserve the calm study-room atmosphere.

The feature should encourage bonding, not compete with the primary study purpose.

## 69.2 Initial mini-game concepts

Potential first-party mini-games include:

### Daily Word Puzzle

A Wordle-like shared daily word challenge.

Possible modes:

- Personal attempt;
- Room cooperative;
- Room versus;
- custom word packs later.

Room cooperative mode may let everyone discuss and submit guesses together.

Room-versus mode may show progress without revealing another player's exact guesses until completion.

Do not copy another game's protected visual assets, branding, word lists, or proprietary implementation. Build an original word-puzzle experience using the general game mechanic.

### Drawing & Guessing

A Skribbl-like drawing-and-guessing game.

Core loop:

1. one participant receives a prompt;
2. they draw on a shared canvas;
3. others submit guesses;
4. correct guesses earn points;
5. the drawer rotates.

Support:

- custom round count;
- configurable drawing time;
- room-created word packs;
- safe default word packs;
- spectators;
- moderation/reporting;
- optional private-friends-only mode.

### Quick Trivia

Short trivia rounds for study breaks.

Potential categories:

- general knowledge;
- science;
- engineering;
- movies;
- music;
- geography;
- custom room quizzes.

Later, users could create private quiz packs for their room.

### Word Association

Fast collaborative or competitive word association.

Useful for:

- very short breaks;
- low-bandwidth rooms;
- mobile users;
- large rooms.

### Two Truths and a Lie / Icebreakers

Optional social prompts intended for friends or newly formed study groups.

These should be entirely opt-in and should never request or encourage sensitive personal information.

### Simple Board/Card Games

Possible later additions:

- tic-tac-toe;
- connect-four-style game;
- checkers;
- chess;
- simple card/party games where licensing and complexity permit.

These should remain lightweight and should not require a separate gaming account.

## 69.3 Room integration

Mini-games should open in the central workspace layer as a dedicated draggable/resizable activity tile or an expanded room overlay.

Example:

```text
┌───────────────────────────────────────────┐
│ Break Game: Drawing & Guessing        ×   │
│                                           │
│              shared canvas                │
│                                           │
│ Participants      Guesses                 │
│ ○ Alex            ...                     │
│ ○ Sarah           ...                     │
│ ○ Pratham         ...                     │
└───────────────────────────────────────────┘
```

The participant rail, chat, media controls, and room background should remain available unless the user intentionally enters fullscreen.

## 69.4 Break-time integration

Mini-games may optionally integrate with the Pomodoro timer.

Example:

```text
Focus session complete.

5-minute break

[ Start a quick room game ]
[ Keep relaxing ]
```

This prompt must be optional and user-configurable.

Never automatically launch a game when a timer ends.

Potential preference:

```text
Suggest mini-games during breaks     ON
Auto-open mini-game panel            OFF
```

## 69.5 Game launch permissions

Room owners should be able to choose who may start a room game:

- Everyone;
- Moderators;
- Owner only;
- Suggestions only.

If the room owner is absent, the existing temporary-control philosophy may be reused where appropriate.

Example:

```text
When owner is absent:
● Anyone may start a temporary break game
○ Moderators only
○ Preserve normal permissions
```

Starting a mini-game must not alter permanent room configuration.

## 69.6 Joining and spectating

Participants should be able to:

- Join;
- Decline;
- Spectate;
- Leave game without leaving room.

A user who does not join should continue studying normally.

The mini-game must not hijack their screen, audio, or notifications.

## 69.7 Game audio

Mini-game sound effects should be:

- locally adjustable;
- muted by default or kept subtle;
- independent of room music/ambience;
- automatically duckable if desired.

Example mixer entry:

```text
Room music       40%
Ambience         20%
Voices           70%
Mini-game SFX    15%
```

## 69.8 Persistence

Most mini-game state should be ephemeral.

Persist only what is genuinely useful.

Potential persistent data:

- optional personal game preferences;
- optional room leaderboards;
- custom word/trivia packs;
- achievements later if intentionally added.

Do not make persistent scoring mandatory.

Temporary round state belongs in the realtime/ephemeral store and should disappear when the game ends or the room becomes empty.

## 69.9 Privacy

Mini-games must respect normal room privacy and blocking rules.

A blocked user should not gain additional access through a game session.

Do not expose personal media, private tasks, or unrelated user data to game participants.

Custom prompts and user-generated game content require moderation/reporting controls.

## 69.10 Realtime architecture

Mini-games should reuse the existing realtime infrastructure where practical.

Server-authoritative game state should cover:

- current round;
- turn ownership;
- timer;
- accepted guesses;
- scores;
- drawing ownership;
- game membership;
- game permissions.

Clients may render animations optimistically, but authoritative game results come from the server.

## 69.11 Hostile-client handling

Mini-games are subject to the same security model as the rest of the platform.

Assume users can craft their own WebSocket/game messages.

The server must reject:

- guesses submitted for another user;
- illegal turn actions;
- forged scores;
- unauthorized game starts;
- drawing events from non-drawers;
- impossible state transitions;
- oversized/flooded drawing payloads;
- malformed trivia answers;
- attempts to access private room game sessions.

Perfect anti-cheat is not a launch requirement for casual games, but clients must not be trusted to award themselves authoritative scores.

## 69.12 Future social activities

Potential later additions:

- collaborative puzzles;
- room bingo;
- study-themed quiz packs;
- shared crossword-style puzzles;
- party games;
- room challenges;
- collaborative pixel canvas;
- music guessing using legally permitted previews;
- asynchronous daily room challenges;
- friend-group streak challenges;
- user-created mini-game packs;
- extension/native-app game integrations.

The mini-game system should use the project's global module/extension architecture, with a modular activity API so new games can be added without modifying the core room shell or unrelated feature internals.

---

# 70. Explicit Non-Goals for Early Versions

Do not spend early implementation time on:

- building a full Chromium-like browser inside the website;
- proxying university credentials;
- server-side rebroadcast of copyrighted music where provider playback is available;
- complex enterprise administration;
- arbitrary user scripting;
- crypto/token economy;
- aggressive gamification;
- AI features simply for novelty;
- native apps before core web architecture is stable;
- visual redesigns that erase the legacy-inspired room feel.

---

# 71. Final Product Contract

The platform should make this true:

```text
For the normal user:
"I can open the site, join my room, study with friends, customize it,
play what I need, and barely notice the technical complexity."

For the advanced user:
"I can tune my media path, use high-refresh screen sharing,
inspect actual quality, and use OBS when I want serious control."

For the security tester:
"I can inspect every request and write my own client,
but I still cannot do anything my account is not authorized to do."

For the product:
"The room still feels like Studyverse did emotionally,
but the architecture is modern, secure, extensible, and built to last."
```
