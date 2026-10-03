# MID-06 — Media, Ambience and YouTube

Status: COMPLETE — AWAITING_REVIEW. Owner acceptance has not been claimed. MID-05 is complete awaiting review; the owner authorizes automatic continuation through MID-08.

## Delivered experience

The existing compact Media entry now opens a bounded listening surface with Now Playing, public title/thumbnail/uploader, readable elapsed/duration, labeled seek and speed, previous/play/pause/next, Show video, Up Next and Add media. Queue controls reorder, play or remove through the existing server authority, with suggestions for non-controllers. Raw provider IDs are request values, not normal labels. Unknown, unavailable and failed metadata have human-readable fallbacks; playback remains usable when metadata fails.

Room/Personal segments retain distinct shared and device-local models. The ambience mixer shows active channels and a visual Add ambience picker, with labeled volume, mute and remove. Shared fields preview immediately, merge/coalesce for 350ms, serialize with the existing version and retry conflicts at most twice. Local volume/mute/ambience preferences never mutate room authority. Pending work cancels when its model disposes. Owner baseline review, suggestions, permanent permission controls and provider diagnostics are secondary in the shared SettingsSheet.

The inherited MID-04A atomic URL/play intent, corrected short-loop reconciliation, single provider, visible collapsed renderer and companion architecture are extended rather than rebuilt. Reorder preserves the current occurrence and playback even with duplicate IDs. The same iframe remains visible and playing in its accepted collapsed tile; reopening restores it. A blocked browser exposes one local Play gesture. Companions show friendly titles and progress controls while their renderer stays in the room.

## Provider, security and architecture

The feature calls a new SDK metadata port composed with the fixed YouTube public oEmbed adapter. It omits credentials, rejects redirects, bounds responses to 32KB and 2.5 seconds, caps in-flight requests at four and caches at most 500 entries. Ready entries expire after 15 minutes; errors after one minute. Bounded title/uploader text is escaped by Vue; provider HTML and arbitrary returned URLs are discarded. Thumbnails use the fixed `https://i.ytimg.com/vi/<validated-id>/hqdefault.jpg` path. Duration is descriptive/provider-observed, never playback authority. No provider key or migration is required.

The member query retains session, room membership, owner-block, strict identifier and rate enforcement. Queue `move` is additive within the existing v1 union and retains role/version/epoch checks. Existing owner baseline, FFA, owner return, privacy-filtered social visibility, capture/RTC and room lifecycle remain owned by their accepted paths. The only extra CSP image origin is public `https://i.ytimg.com`; private images and credentials never reach it.

Each client streams directly from YouTube; no extraction, hidden audio iframe, download, rebroadcast or transcoding is introduced. The visible player remains at least 200×200px with provider controls. References checked: [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference), [developer policies](https://developers.google.com/youtube/terms/developer-policies), [oEmbed specification](https://oembed.com/).

## Files changed

- Presentation/model: `apps/web/app/components/media/{MediaListening,RoomMediaPanel,RoomMediaController,RoomVideo}.vue`, `apps/web/app/room/room-media-model.ts`, `apps/web/nuxt.config.ts`.
- Metadata composition/adapter: `apps/api/src/room-media.ts`, `packages/adapters/src/youtube/{server,browser}.ts`, adapter export map.
- Feature/contracts/SDK: `packages/features/room-media/src/{browser,server}.ts`, `packages/contracts/src/room-media.ts`, regenerated OpenAPI/protocol artifacts, `packages/feature-sdk/src/room-media.ts`.
- Tests: metadata/mixer units, room-media services, browser media-refresh/room-media/provider fixture and isolated server metadata fixture.
- Architecture, coordination, this report and separate MID-06 screenshots. Inherited history/references are preserved.

## Validation

- Focused metadata, playback, mixer and queue units: 13/13. Unit regression: 236/236 across 39 files.
- Real PostgreSQL/Redis media services: 6/6, including membership, strict URLs and reorder authority; existing owner baseline/FFA/restart/security cases retain coverage.
- Three focused browser cases passed across initial and scoped repair. One new selector incorrectly assumed provider tiles carried productivity-card attributes; the corrected semantic article selector passed. This was a fixture error, not a provider lifecycle defect.
- API/Nuxt production build, package/Nuxt typechecks, lint/feature boundaries and versioned contract consistency passed. Final build size: 6.74MB / 1.57MB gzip (whole output, not initial client bytes).
- The single broader relevant browser run passed 24/24. It includes the real two-client provider probe alongside deterministic synchronization, companions, productivity, backgrounds, presence and reconnect/ownership checks.
- Real-provider observation: both clients were Playing at about 13 seconds (owner 13.60s, late joiner 12.95s; separately sampled difference about 0.65s). Collapsed playback advanced and retained the original iframe. Provider console/request warnings were recorded; this does not certify arbitrary content or networks. Evidence: `.local/validation/mid05-08/mid06-real-youtube.json`.
- All 22 development tables and the migration ledger retain their original counts, column projections and row digests. No development migration/reset or container replacement occurred.

Logs: `.local/validation/mid05-08/mid06-*.log`. [Desktop](../references/mid06/media-desktop.png), [mixer](../references/mid06/media-mixer.png), [narrow](../references/mid06/media-narrow.png). Captures wait for fonts and finite transitions.

## Limitations and deferred polish

oEmbed has no duration field; queued duration is shown when known, and current duration can come from the existing player. Metadata does not certify embedding/region availability. Failed descriptions may remain cached briefly. Shared muted channels use the accepted level model; a listener joining while a channel is zero sees it as inactive. Additional source art and minor queue spacing are deferred non-blocking polish.

Provider autoplay, ads, geography, live seeking, publisher restrictions, credentialless browser support and hidden-tab rules remain real limits. Deterministic fixtures prove application control and ownership, not universal YouTube playback. No automatic queue consensus, personal player/history, provider expansion, new native app, Phase 09 or Docker → Podman is introduced. Development API/web images will be refreshed after the final MID-08 build; MID-06 browser evidence uses its current production output through the isolated guarded test harness.

Functional blocker classification: NONE. Minor visual refinements are deferred non-blocking polish. Checkpoint: `.local/validation/mid05-08/mid06-complete.json`. Continue automatically to MID-07 under the owner instruction, without claiming acceptance.
