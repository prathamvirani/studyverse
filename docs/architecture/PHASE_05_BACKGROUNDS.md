# Phase 05 background architecture and decisions

The background feature owns visual catalog, selection policy, import preflight, rendering integration and its durable room defaults. RoomShell consumes the generic `environment` UI extension. Concrete registration occurs in the room route. The canonical dock order and accepted room layout remain intact.

## Scope and ownership

- An authenticated room member reads its curated default; only its owner can change that durable default. Existing Rooms membership and Friends owner-block policies are consulted through the SDK room-access port, including inside the write transaction. Owner absence grants no additional powers.
- Personal overrides, favorites and motion preferences are IndexedDB preferences scoped to account and room on this device. They are preferences, never authorization claims. `null` means follow the current room default. Missing catalog or custom IDs fall back safely.
- Custom assets are local to the device and partitioned by account ID; the device library can be used across rooms. Same-origin browser storage is not a security boundary against someone controlling the browser/device. It is not account-synchronized or exposed to room members.
- **Deferred ownership decision:** neither spec defines a durable private-upload retention policy, a room-upload ownership transfer policy or the production media-domain configuration. This phase therefore permits personal device imports and curated room defaults. Custom room sharing and durable server uploads are explicitly unavailable. If subsequently authorized, use authenticated ownership, storage quotas, expiry/cleanup and an isolated production media origin; do not silently promote local images to shared content.

## Provider and storage contracts

`EnvironmentProvider` supplies `EnvironmentAsset` descriptors through `EnvironmentCatalog`. Provider and asset IDs must be unique. Sources, posters, thumbnails, categories and visual-loop metadata belong to this module. Additional providers/assets require no RoomShell edits. Future scene/audio pairing must retain independent audio controls; nothing in this phase plays audio.

`LocalVisualStore` abstracts binary storage. Its IndexedDB adapter maintains separate metadata/thumbnails and full-frame records. One read/write transaction enforces the count/byte quota across competing tabs and updates both stores. SHA-256 source digests deduplicate repeated imports. Filenames are discarded, never used as keys, paths or HTML. Original uploaded bytes and metadata are discarded after re-encoding. Deletion removes the binary and metadata records, then repairs the local selection and favorites.

`backgrounds.room_defaults` owns a room UUID, curated asset ID and version. HTTP and WebSocket use strict versioned contracts and the existing authentication, CSRF, permission, rate and feature-flag pipeline. Writes serialize per room and compare versions; only one concurrent write with the same version succeeds. The existing authorized snapshot transport synchronizes changes on the shared productivity socket, without adding another connection. Reconnect rechecks membership/session and reloads the snapshot.

## Import budgets and rendering

- Actual-byte PNG/JPEG/GIF recognition and structural scanning before native decode. SVG, HTML, WebP input, APNG and unsupported formats are rejected. No uploaded content is interpreted as HTML.
- At most 5 MiB compressed input, 4096 pixels on either source axis, 12 million source pixels, 60 GIF frames and 40 million total decoded frame pixels.
- Decode must succeed. Canvas re-encodes each accepted frame into metadata-free WebP, bounded to 1920×1080; thumbnails fit 240×135 even for extreme aspect ratios.
- GIF animation requires the browser's ImageDecoder API. Unsupported browsers receive an explicit rejection and can still import static PNG/JPEG. Frames are capped to 10 FPS, and per-frame display delays are bounded to 100–5000 ms.
- Maximum processed asset 12 MiB, maximum device library 8 assets / 32 MiB per account partition. Quotas are local resource controls; there is no remote storage resource for a hostile client to consume.
- Only the selected source is loaded at full resolution. Catalog browsing uses 320×180 WebP thumbnails; custom browsing reads only metadata and thumbnails. Object URLs and timers are released on replacement/unmount. No full-size speculative preloading.
- Curated loops use an original still plus compositor-friendly CSS effects: a 12-second periodic rain texture and a 64-second out-and-back light drift. They are not third-party GIFs or video files. There is no background audio.
- Reduced motion, hidden tabs, Save-Data and manual pause stop visual motion. Custom animation displays its first sanitized frame. There is no standardized OS battery-saver signal used here; users can pause manually. No physical battery-life measurement is claimed.

## Failure and deployment behavior

Failed or disabled background operations leave the default still and the room usable. Image loading errors use the valid default. Missing local assets repair the preference on reload; local storage failure is disclosed rather than represented as durable success. A scoped dock-selector CSS regression prevents the mobile dock's sizing rules from stretching feature-panel controls.

`BACKGROUNDS_ENABLED=false` gates all background server operations. There is no upload HTTP route or user-media server. The app's CSP permits blob images for locally sanitized data; active content/frame policies remain intact. All bundled sources are project-created, with provenance in `apps/web/public/backgrounds/provenance.json`. `scripts/create-background-assets.mjs` regenerates the checked-in original vectors, WebP scenes, thumbnails and provenance without network content.

No Phase 06 RTC or Phase 08 ambience behavior is implemented.
