# Personal Study Player architecture

Phase 09 adds device-private study media beside the accepted room media system. The [phase report](../reports/PHASE_09_PERSONAL_STUDY_PLAYER_REPORT.md) records validation and the unresolved repository dependency-audit gate. Phase 09 has not been accepted; later provider work remains unauthorized.

## Ownership and registration

`@study/personal-media` contains the local provider registry, validated history/preferences, resume rules, playback owner and effective gain calculation. It depends on contracts and SDK ports, with no API, realtime, RTC SDK or concrete provider imports. `PersonalMediaAdapter` registers matching, metadata, playback capabilities, a mount factory and optional public room identity. An independently registered test adapter exercises the complete owner without modifying its implementation.

`apps/web/app/room/personal-media.ts` composes the existing IndexedDB adapter and YouTube/Vimeo/direct adapters. It registers `personal-media.panel` at the generic `mediaPanel` extension point and `personal-media.player` in the existing workspace tile registry. `RoomMediaPanel` hosts that extension generically. RoomShell and WorkspaceHost retain their existing renderer/layout/popout ownership.

One controller owns one personal provider instance. Panel, tile and companion controls reference that controller. The owning tile mounts the renderer; companions install controls only. Minimize retains a visible provider frame at least 200×200px. Closing the personal tile pauses, saves and destroys it. Reopening restores from local history. A room exit/disposal aborts pending mounts, destroys the instance, removes listeners, clears the 200ms sampling timer, releases MediaSession handlers and closes the preference handle. Generation fences destroy late mount results. A cancelled play intent cannot autoplay a replacement source.

Normal tile geometry uses the generic host's drag/resize/reflow behavior. It is persisted in the private preference record, not a generic workspace record containing media identity. Explicit open on phones up to 360px uses the existing fullscreen presentation. Fullscreen and minimized flags are not restored as saved geometry.

## Provider boundary

| Adapter | Supported input                                                                                         | Playback                                                                           | Rate                                                                       | Room promotion       |
| ------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------- |
| YouTube | Public HTTPS watch/embed/shorts/youtu.be and compatible Music watch links, or an 11-character public ID | Existing visible YouTube IFrame API adapter; play/pause/seek and provider duration | Actual provider-advertised rates                                           | Public video ID only |
| Vimeo   | Public numeric Vimeo or player.vimeo.com/video links                                                    | Visible Vimeo Player SDK embed; play/pause/seek/duration/title                     | Conservatively 1×; publisher-dependent speed is not advertised universally | None                 |
| Direct  | Public same-origin HTTPS MP4/WebM paths                                                                 | Native visible HTMLVideoElement; browser-supported formats                         | 0.5–2×                                                                     | None                 |

All adapters canonicalize before persistence. YouTube retains only its public content ID and canonical watch URL. Vimeo rejects unlisted/private hash links. Direct media rejects signed/unknown query keys, foreign origins and arbitrary pages; tracking/time parameters are discarded. URLs with embedded credentials and insecure protocols fail. Unsupported input preserves the previous selection. No arbitrary URL proxy, credential forwarding, backend metadata request or streaming/transcoding dependency is introduced.

YouTube reuses the accepted `youtubeProvider` and script loader. Optional abort/title/rate/duration ports serve personal playback without changing shared authority. Its personal metadata resolver fetches only the fixed public YouTube oEmbed endpoint, directly from the browser with omitted credentials, rejected redirects, a 2.5-second timeout and a 32KB response bound. Only bounded plain title text is retained; provider HTML is ignored and errors use a friendly fallback. Vimeo loads its SDK on first use with anonymous CORS, a nonce and bounded readiness; optional title/duration updates do not block readiness. Direct playback obeys the same-origin media CSP, including redirects, and exposes native format/load failures.

Provider scripts/frames are scoped to YouTube and Vimeo. Permissions-Policy serializes quoted origins and delegates provider playback/fullscreen/PiP/encrypted media only to those origins; camera, microphone and display capture remain self-only. Credentialless embeds retain strict COEP isolation and fail closed when the browser lacks support. Native provider controls remain visible. There is no provider audio extraction, rebroadcast, extra AudioContext or invisible media renderer.

## Device-local data

The existing `study-preferences-v1` database remains version **1**, with the unchanged `preferences` object store. The new account/device namespace is `personal-media.player.<user UUID>` with preference record version **1**. No IndexedDB upgrade is required; a test seeds the previous v1 store and verifies the unrelated preference survives. Malformed stored records fall back safely and restored source identity is revalidated against registered adapters.

The strict record stores up to 30 recent entries, deduplicated by provider/content ID. Each entry has safe canonical source, bounded title, position, playback rate and last-opened timestamp. The record also stores selected identity, independent volume/mute, ducking/remember preferences and tile geometry. Position is finite and bounded to seven days; known near-end completion resumes from zero. Unknown duration does not discard valid progress. A provider that cannot seek does not claim resume support. Cued providers temporarily reporting zero cannot erase a saved resume before play.

Writes are serialized and debounced for 400ms; advancing playback saves at most once per five seconds. Pause/seek/close/visibility/pagehide/disposal request final progress where browser lifecycle permits. IndexedDB failure uses the existing memory fallback and an explicit restoration warning. Clearing waits for queued writes, deletes only this namespace, and fences tile-unmount/disposal writes from recreating it. Remember-history/progress controls bound what is retained. Abrupt process/device termination can lose the latest unsaved seconds; there is no server or cross-device fallback.

## Mixing and authorized voice activity

Effective room music is `shared music × configured local music × personal duck gain`; ambience retains its independent accepted engine and gains. Personal playback never mutates shared mix or the configured local room volume. The duck target defaults to 20% only while personal media is playing, audible and enabled. Pause, mute, zero volume, end, close and disposal restore output. Repeated transitions converge to target gains instead of multiplying prior attenuation. The existing room provider applies the effective music gain; no new mixer or audio graph is created.

Optional voice ducking defaults off. The app injects activity from its existing authorized RTC snapshot: connected, unmuted microphone tracks with available audio levels. Speaking above the existing 0.02 threshold lowers only personal media to 25% of its configured volume with a 600ms hold and short gain smoothing. Missing/disconnected activity restores the personal gain. This reads existing published/subscribed media activity; it requests no microphone permission, captures no track and subscribes to no new RTC roster. No server/provider privacy or publication authority is changed.

## Privacy and explicit promotion

The personal module has no server module, migration, operation, subscription, presence contribution or personal-media debug payload. Personal URL/title/history/progress/rate/volume/mute/geometry stay in the owner's device state. Another room account receives only existing authorized application/room/RTC projections. Separate-context browser tests inspect REST/WebSocket outbound traffic and the second user's state; service tests reject unknown personal-history operations.

Promotion is one explicit user action. Only adapters that return a supported public room item expose it. YouTube sends `{ type: 'enqueue-play', videoId }` through the existing room `control` or `suggest` command using its room ID, epoch and version. It sends no personal title, URL, progress, rate, mix or geometry. Existing server session, CSRF/Origin, membership, owner-block, server-derived role, revision, strict schema and suggestion-review rules remain authoritative. Permission changes/revoked membership can reject promotion even after the button was enabled.

Private is a boundary against application disclosure to other clients, not anonymity from the explicitly selected streaming provider or protection against someone with access to this browser/device. MediaSession title/control state stays on the local platform. No analytics or cross-device playback synchronization is added.

## Configuration and verification

`NUXT_PUBLIC_PERSONAL_MEDIA_ENABLED=true` enables the app-composed contribution; false registers no personal panel, owner, timer or renderer. No secret/provider-account configuration is required. The Compose web service forwards the switch. `validate:phase09` follows the repository's existing complete validation chain and retains the real audit/format gates.

Unit/architecture tests cover provider extension and failure isolation, canonicalization, previous-store preservation, local persistence, capabilities, gains, cancellation and resource release. Service tests cover existing promotion authority and hostile payloads. Browser tests cover two-account privacy, close/reload resume, one iframe across controls/minimize, companion controls, local deletion, responsive recovery, Vimeo capabilities and actual decoded direct WebM. Live provider observations are separately recorded; deterministic fixtures do not certify arbitrary public videos, regional access, DRM, network availability or hardware browser support.

Primary references: [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference), [YouTube required functionality](https://developers.google.com/youtube/terms/required-minimum-functionality), [Vimeo Player SDK](https://github.com/vimeo/player.js), [native media API](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement), and [Permissions-Policy syntax](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy).
