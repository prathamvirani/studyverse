# Room media architecture

Phase 08 only. Phase 07 is accepted; later personal players and provider integrations remain outside this implementation.

## Ownership and registration

`@study/room-media` owns durable baselines, transient playback/queues/suggestions and server control rules. `apps/api/src/room-media.ts` supplies room-role, identity, blocking and occupancy ports. The module declares its presence lifecycle dependency. The browser registers Media at dock order 0 and a `room-media.youtube` tile in the generic workspace registry; the room shell and RTC are unchanged. The transport uses registered query/command handlers, never a feature switch or RTCDataChannel.

Presence owns validated room leases and a server-only `RoomOccupancy` port plus `presence.room-occupancy` events. These include people with private/offline public presence; public privacy projection cannot manufacture owner absence. Membership, owner-block policy, session expiry/revocation and multiple connections still come from the existing presence validator. Departure events carry a complete occupancy snapshot, so zero occupancy resets media before a quick re-entry. Unexpected network loss uses the existing 65-second lease bound; a two-second sweep catches expiry and is also a media fallback. Only internal subscribers see occupancy identities; the event has no client subscription binding.

## Durable and transient state

Migration `room-media/0001_room_media` creates only `room_media.baselines`: room foreign key, approved playback/queue/mix JSON and permanent permission JSON. Existing migrations remain unchanged. Only the owner's accepted control with no outstanding temporary changes, explicit Keep current, or permission configuration writes this row. Permission configuration does not promote a pending mix. Restore mine reanchors the baseline immediately. Keep current anchors the actual current playhead as the new baseline.

Transient state uses an in-process room map and per-room serialized commands, consistent with the application's single-process authority limit. This includes queue changes, timestamp anchors, last controller, capped suggestions and capped changer identities. A fresh process restores the durable baseline and issues a fresh random epoch; it never accepts commands from a previous epoch or extrapolates playback across downtime. No transient player objects, user URLs, credentials or tokens persist. Redis continues to back the authoritative presence leases. Multiple active API authorities for the same rooms are unsupported; distributed room ownership/storage is required before scaling beyond the existing single API process.

## Authority and reconciliation

All operations require authenticated current room membership with owner-block checks. Commands serialize and recheck roles under the existing room transaction locks. Requests carry room ID, server epoch and expected version; commands with stale revision fail with CONFLICT. Client role/owner/controller fields are rejected by strict schemas. The controller is the server-derived last successful controlling actor, not a delegated role or an extra privilege.

Normal settings: everyone, suggestions, moderators, or owner. Owner-absent settings: temporary FFA, moderators only, or preserve normal permissions. Non-owner control and all suggestions require a nonempty active room. The owner always controls; moderator/member rules come from these settings. FFA changes only session media. Permanent settings and keep/restore are owner-only. Every non-owner control remains temporary even under Everyone controls while the owner is present: only owner approval changes the baseline. Owner edits during a pending change keep the entire mix pending until explicit reconciliation. Empty occupancy discards all session changes/suggestions and restores the last approved queue, position and levels.

Suggestions support every media action, including queue selection/removal, playback, rate, seek and mix. They are limited to 30 per room/5 per author and rate limited. Controllers accept or dismiss them; accepting applies the action to current state and rejects removed/blocked authors. Changer/controller/suggestion identities are projected through viewer block checks. Shared provider state remains room-wide; blocks do not create conflicting room mixes.

## Synchronization and provider boundary

Wire protocol v1 includes provider, queue of strict 11-character YouTube IDs, current index, playing flag, position seconds, rate, updatedAt, room mix, epoch and version. No arbitrary embed URL is accepted. The browser canonicalizer recognizes public HTTPS YouTube, youtu.be, shorts/embed and compatible YouTube Music watch URLs; playlist-only and unsupported links fail. Only video IDs reach the API.

Current position is `position + max(0, serverNow - updatedAt) * rate / 1000` while playing. Pause, seek, rate and queue changes reanchor server state. A separate authenticated clock query estimates clock offset using the request midpoint on initial connection/reconnect and once a minute. Playback drifts are checked locally every three seconds; differences over 1.5 seconds seek to the authoritative target. State revisions force re-alignment. Snapshot payloads remain constant between real state/authority changes; the existing two-second snapshot comparison does not broadcast playhead ticks.

The YouTube IFrame API is behind `SharedVideoProvider`/`SharedVideoPlayer`. The SDK loads only after Enable YouTube, inside one user-opened tile. Each browser streams directly from YouTube. A visible minimum 200px player retains normal provider controls; video is never extracted into audio-only playback. Hidden pages pause; minimizing/closing unmounts and destroys the player. Reopening catches up from current authoritative state. Provider-control buttons affect that local embed until drift correction; shared controls are explicitly in Room media. Native embed gestures never bypass server permissions.

Provider API/script load failures, embed restrictions, removed/private videos, unsupported speeds, autoplay blocking and ended videos have local error/status text. An unavailable item does not poison every client's state; a controller removes it or selects another queued item. Queue selection/removal pauses replacements. Advancement is explicit, avoiding multiple clients racing on untrusted ended events. Ads, live content without seek/DVR, regional restrictions, buffering, account restrictions and autoplay can prevent exact synchronization. There is no real-playback guarantee for arbitrary URLs.

Provider references checked during implementation: [IFrame API](https://developers.google.com/youtube/iframe_api_reference) and [required functionality](https://developers.google.com/youtube/terms/required-minimum-functionality). The implementation preserves direct embeds and provider UI, without backend media proxying or credential exchange.

## Ambience and local mixing

Rain, white, pink and brown noise use the original deterministic procedural generator in `src/ambience.ts`; [provenance](../../packages/features/room-media/provenance.json) records every shipped source. No third-party audio samples are shipped. Each Web Audio layer has an independent gain with a short smoothing ramp. Exact sample alignment is unnecessary. Audio starts on an explicit user gesture and all sources/context close on room disposal.

Shared music and four ambience levels are room state. Local music, ambience master, per-layer gains, local mute, room/personal ambience scope and personal layer levels use the existing account/device IndexedDB preference adapter with memory fallback. Local controls never send room commands. Effective music is shared music × local music; room ambience multiplies the shared layer, local layer and local ambience master. Personal ambience substitutes only local layer selections. Local mute zeros both music and ambience; voice stays under the existing independent RTC controls. No Phase 09 personal player/history/ducking is added.

## Security and operational boundaries

All mutations retain authenticated sessions, CSRF/Origin, strict schema bounds, current room-role/block checks, serialized versions, rate limits and escaped Vue text. Query operations do not mutate durable/domain state. Snapshot initialization only recovers a cached session. The process clock/version is authoritative. YouTube script/iframe origins are explicitly scoped by CSP, nonce/strict-dynamic script policy and iframe sandbox. A credentialless iframe preserves the application's strict COEP isolation; browsers without credentialless iframe support cannot load this embed and show an explicit limitation. Provider sign-in cookies are not available in that isolated embed, so account-restricted content is unsupported. The iframe sends only an origin-level referrer for provider identification despite the application's default no-referrer policy. No user cookies/credentials are proxied. No new external npm dependency or provider credential is required.

`ROOM_MEDIA_ENABLED` defaults true, requires `SOCIAL_ENABLED`, and is enforced by the operation registry. Other room features continue when it is disabled or YouTube fails. Migrations are collected independent of enablement; readiness checks the baseline table. Existing local deployment uses one API process.
