# Phase 05 report

2026-09-11. Backgrounds & Environment Assets. Phase 04 was explicitly accepted before work began. Phase 06 and Phase 08 implementation were not started. Existing uncommitted accepted work was retained.

Status: AWAITING_REVIEW. Phase 05 remains unaccepted.

## Implemented

- Independent Backgrounds feature, stable provider/catalog contracts, generic `environment` UI contribution and canonical Background dock action.
- Six original curated environments, categories, separate thumbnail previews, instant device selection, favorites, room-default selection and manual motion pause.
- Authenticated owner-controlled durable room defaults, membership-restricted reads, versioned writes and authorized realtime snapshots. Personal overrides remain independent of the room default.
- Personal device-local PNG/JPEG/GIF import, actual-byte validation, bounded native decoding, WebP re-encoding, thumbnails, deduplication, deletion and atomic local quotas.
- Reload persistence, missing/invalid asset fallback, loading/error states, feature-disable fallback, responsive native dialog, keyboard/Escape dismissal and focus return.
- Reduced-motion, hidden-tab, data-saving and manual-pause behavior. Visual selection never starts audio.

## Included assets and provenance

**Actual included collection: 6 backgrounds — 4 stills and 2 animated visual environments.** The two loops combine original still images with seamless CSS visual effects; they are not bundled GIF/video files. All six have 1920×1080 WebP sources and separate 320×180 WebP thumbnails, plus editable original SVG source. The Phase 02 original is retained as one catalog entry. The other five scenes are new project-created illustrations.

| Background         | Category      | Type                        |
| ------------------ | ------------- | --------------------------- |
| The quiet hours    | Cozy rooms    | Still                       |
| Cedar library      | Libraries     | Still                       |
| Morning studio     | Cozy rooms    | Still                       |
| Alpine stillness   | Nature        | Still                       |
| Rain at the window | Rainy windows | 12-second rain loop         |
| After midnight     | Space         | 64-second light-drift cycle |

All full-size WebPs together total **142,334 bytes**; all six thumbnails total **26,930 bytes**. These are original stylized illustrations, not photographic stock. The collection intentionally does not claim the 60+ production-content target. New assets/providers can be registered without modifying RoomShell; additional production art can expand the collection without filler or uncertain licensing.

Machine-readable provenance: `apps/web/public/backgrounds/provenance.json`, including origin, creator, project-owned original status, attribution requirement, type, dimensions, actual bytes and source files. No third-party wallpaper, scraped GIF, paid stock or external asset URL was used. The deterministic authoring/rasterization script is `scripts/create-background-assets.mjs` and uses the existing Chromium tooling.

## Architecture, persistence and permissions

`packages/features/backgrounds` owns catalog/domain logic, validation, server operations and its migration. SDK `EnvironmentAsset`, `EnvironmentProvider` and `LocalVisualStore` contracts separate catalog, rendering and binary storage. The room composition registers its surface and dock contribution; RoomShell imports no background catalog or concrete background component. The generic environment contribution has the existing renderer failure boundary.

Room defaults are stored in `backgrounds.room_defaults` with room ID, curated asset ID and version. An existing room member may read; only the current owner may change the default. The module consumes Rooms' existing SDK access port, which also checks owner-block restrictions; it never reads Rooms/Friends tables directly. Writes recheck access under transaction locks and reject stale/concurrent versions. Owner absence does not change permissions. Room snapshots reuse the same multiplexed application socket as productivity. No RTC or audio transport is introduced.

Personal selection, favorites and pause preference use the existing IndexedDB preference abstraction, partitioned by account and room on this device. A null selection follows the room default. Custom asset records are partitioned by account on the device and are available across rooms. They are not credentials or an authorization boundary. A person controlling the browser/device can inspect its local data; this is not encrypted account storage. The app never syncs these bytes or references to other room members.

The binary store opens only when needed for custom browsing or restoring a custom selection. Metadata/thumbnails and full frames are separate stores. Original-byte SHA-256 IDs deduplicate imports; quota checks and writes span an atomic transaction, including competing tabs. Failed storage and missing/evicted assets are disclosed, and missing selection falls back to a valid room/default background instead of leaving broken permanent room state. Removing a custom asset also repairs its selection/favorite references.

## Upload boundary and limits

**Custom uploads are personal device imports only. Durable server uploads and custom room sharing are deferred.** Neither specification settles their persistent ownership/retention rules or the production isolated-media-origin configuration. This is the explicit non-obvious assumption requiring product review. The UI makes the scope visible and prevents selecting custom content as a room default; the server independently accepts only known curated IDs. No public sharing, user-media endpoint or object-storage ownership scheme was invented.

- Accepted input: actual PNG, JPEG or bounded GIF. Filename and claimed MIME do not determine acceptance. SVG/script/HTML, APNG, WebP input and other unsupported formats are rejected.
- At most 5 MiB compressed input, 4096 pixels per source axis, 12 million source pixels, 60 animation frames and 40 million total decoded pixels.
- Structural inspection precedes native decoding; decode must succeed. Every retained frame is canvas-re-encoded to WebP, stripping source metadata and any trailing/embedded content. Filenames are discarded and never interpreted as paths/HTML.
- Output fits 1920×1080. Thumbnails fit 240×135 even for extreme aspect ratios. Processed asset limit: 12 MiB. Device library: 8 assets / 32 MiB per account partition.
- Animated GIF requires ImageDecoder support. Unsupported browsers get an explicit message and can still import static images. Animation is capped at 10 FPS; frame delays are bounded to 100–5000 ms. GIF timing may therefore differ from a fast source animation.
- Blob URLs are used only as image sources, never HTML/frame documents, and are revoked on replacement/unmount. CSP adds local blob-image support without relaxing script or frame policy.

There is **no server upload**, so forged upload owners, cross-account remote asset access, revoked-session uploads, remote quota bypass and replayed server-upload requests are not applicable. The nonexistent upload route is explicitly tested as unavailable. Local quota/deduplication controls protect device resources, not a remote authorization boundary. Actual server room-default actions are tested for session, ownership, scope, CSRF, Origin, version and flag bypasses.

If durable uploads are authorized later, they still require an authenticated ownership model, server-side validation/quotas, retention/cleanup and an isolated production media origin. This phase does not claim that deployment feature is implemented.

## Performance, accessibility and visual review

Only the selected full-size source is requested. Browsing uses independent thumbnails; it does not decode unselected scenes or custom frames. Selected custom frames are bounded and scheduled at no more than 10 FPS. Curated animation uses CSS effects rather than full-screen per-frame decoding. Timers/object URLs are released on unmount/replacement, and motion stops for hidden tabs, reduced motion, Save-Data or explicit pause. Custom animation shows its first sanitized frame when frozen. No OS battery-saver API or physical battery-life measurement is claimed.

The native dialog provides keyboard containment, Escape dismissal, a close control and return to the dock. It renders outside the dock DOM so its controls do not alter canonical dock semantics. Existing glass panels and a subtle visual overlay preserve readability on bright, dark and detailed backgrounds. No broad visual redesign was performed.

Real Chromium workflows and screenshots cover 1440×1000 desktop, 768×1024 tablet and 390×844 mobile, with prior 320×568 regressions retained. Saved screenshots under `.local/validation/` include:

- `phase05-selector-desktop.png`, `phase05-selector-tablet.png`, `phase05-selector-mobile.png`;
- `phase05-morning-studio-{desktop,tablet,mobile}.png`, `phase05-cedar-library-{desktop,tablet,mobile}.png`;
- `phase05-night-observatory-{desktop,tablet,mobile}.png`, `phase05-rainy-window-{desktop,tablet,mobile}.png`;
- `phase05-room-tablet.png`, `phase05-room-mobile.png`, `phase05-custom-desktop.png`, `phase05-reduced-motion.png`.

The automation also verifies changing CSS transforms and changing sanitized GIF frames, rather than relying only on a still screenshot. Visual review caught and fixed inherited dock sizing on mobile selector buttons and inherited footer styling. A browser regression now checks filter/favorite dimensions. Device database creation is lazy. The older layout-persistence test now reads the exact `room-layout.<roomId>` record instead of assuming every preference is a tile record; its geometry and persistence assertions remain.

## Migrations and configuration

- New isolated migration: `backgrounds/0001_backgrounds`, with a room foreign key and least-privilege runtime grants. Prior migration files/checksums remain unchanged. Development data is upgraded, not reset.
- `BACKGROUNDS_ENABLED` defaults to true; false gates every background server operation. Disabled/unavailable visuals leave the room usable with a valid still.
- The composition, contract generator, migration manifest, readiness check, Docker image and CI validation command include Phase 05. No new third-party runtime dependency, external service or credential is required.
- `npm run validate:phase05` chains every preceding phase suite.

## Validation

`npm run validate:phase05` **passed, exit 0: 200 tests, no skips**, including the complete Phase 04 → 03 → 02 → 01 → 00 regression chain. Evidence: `.local/validation/phase05-complete.log`.

| Check                                                        | Result                                |
| ------------------------------------------------------------ | ------------------------------------- |
| Unit, integration, HTTP/security and architecture            | 125 passed                            |
| Real PostgreSQL/Redis service tests                          | 62 passed                             |
| HTTPS/WSS Chromium browser tests                             | 12 passed                             |
| Actual Docker readiness regression                           | 1 passed                              |
| Formatting, lint, architecture boundaries and API/Nuxt types | Passed                                |
| Generated OpenAPI/JSON Schema drift                          | Passed                                |
| Source security, Gitleaks and dependency audit               | Passed; zero reported vulnerabilities |
| API and Nuxt production builds                               | Passed                                |
| Local Compose rebuild, upgrade migration and health          | Passed                                |

Docker evidence: `.local/validation/phase05-compose.log`. The rebuilt web container also served the six-entry provenance manifest with the expected 142,334 full-size asset bytes. All 19 Phase 05 screenshots are saved and representative desktop/tablet/mobile views were visually inspected. The final bright-scene review led to a scoped glass-button contrast fix, followed by another complete passing validation and deployment. Existing upstream build warnings remain nonblocking; hosted CI was not run.

New checks include actual media detection despite misleading MIME/path-traversal filenames, script/SVG rejection, oversized files, malformed PNG/GIF, predecode dimension bombs, native decode failure, GIF frame changes, custom deduplication/quota/account partitioning, removed local data fallback, curated request loading, reduced motion, pause/resume, favorites, reload, room defaults, owner/role forgery, private-room access, concurrent/stale versions, revoked sessions, CSRF/Origin, removed membership, socket synchronization and disabled operations. Previous Friends/presence, timers/tasks/chat, workspace, single-renderer camera demo, mobile and authentication checks all pass.

## Assumptions and known limitations

- Review the device-local-only custom upload decision above. Shared custom uploads, isolated remote media serving and cross-device sync are intentionally unavailable.
- Six original scenes establish the system; 60+ production assets remain content population work. No browser video provider, remote URL imports, APNG or WebP uploads are offered.
- Favorites and override preferences are per account/room/device; custom library contents are per account/device. There is no automatic cross-tab preference notification; a reload re-reads local preferences. Room defaults synchronize in realtime.
- Browser testing targets Chromium. ImageDecoder support varies; other browser engines, physical tab suspension/battery behavior and live external OAuth were not newly verified. Existing authentication regressions remain in the suite.
- The accepted single-API-process deployment and process-local snapshot architecture remain. Hosted CI is not claimed as run.
- Phase 06 RTC, Phase 08 ambience/media, optional scene/audio associations and broad visual-fidelity work remain deferred.

## Ready for next phase

**NO.** Only the owner can accept Phase 05 and authorize Phase 06. Phase 05 must remain active and unaccepted pending review.
