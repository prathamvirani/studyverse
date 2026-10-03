# MID-06 — Media, Ambience & YouTube Reliability

## Objective

Preserve the accepted Phase-08 media architecture while replacing implementation-heavy UI with a seamless consumer-facing experience and fixing current YouTube regressions.

## Media sheet

Clicking Media opens a polished glass sheet.

Primary structure:

- Now Playing
- Up Next
- Add media
- playback controls
- Room / Personal segmented scope
- ambience mixer

Do not show synchronization internals in normal UI.

## Metadata

When YouTube URL is added:

- parse ID internally
- resolve title
- thumbnail
- duration when possible
- optional channel/uploader

Never use raw provider ID as the normal queue label.

## Up Next

Show next queue item(s) with:

- thumbnail
- title
- duration

## Room vs Personal

Room:

- authoritative shared controls the user may access

Personal:

- local mute
- local room-media volume
- local ambience volume
- future local-only listening

## Ambience

Show active channels rather than a permanent wall of zero sliders.

`+ Add ambience` opens visual source selector.

Changes apply live with debounce/throttle.

## Permissions

Keep existing Phase-08 authority system:

- owner baseline
- everyone/suggestions/moderators/owner
- temporary FFA/override
- owner return behavior

Move this complexity into secondary settings.

## Playback state vs renderer state

Logical shared playback must be separate from the visible YouTube tile.

`Show video` opens optional renderer.

Closing/minimizing visual tile should not pause room playback where technically possible.

Reopening should join current shared position.

## Remove repeated Enable YouTube workflow

Current observed flow is unacceptable:

```text
Media
→ Open YouTube tile
→ Enable YouTube
→ click Play in iframe
→ click Resume YouTube
```

Target:

```text
Media
→ paste URL
→ metadata resolves
→ queue / Now Playing
→ one Play action if browser gesture is required
→ shared playback
```

Provider initialization should be hidden implementation detail.

## Audio-first YouTube

Default experience:

- shared audio
- metadata
- queue
- controls

Video is optional through `Show video`.

## Current loop/resume bug

Observed:

1. enable YouTube
2. click Play in iframe
3. plays ~2 seconds
4. snaps/loops back repeatedly
5. separate Resume action finally lets it continue

Likely stale authoritative paused state fighting local iframe playback.

Fix so one authorized Play action:

1. updates authoritative room state
2. starts local provider
3. broadcasts
4. remote clients reconcile

No second Resume action.

## Regression tests

Two-client tests must cover:

- metadata resolution
- title/thumbnail instead of ID
- one-click authoritative Play
- no 0–2s loop
- pause sync
- seek sync
- hide/reopen renderer
- late join
- autoplay-block fallback with one clear Play/Join Playback affordance

## Acceptance

- current Phase-08 permission semantics preserved
- no copyrighted rebroadcast/transcode introduced
- YouTube streams remain direct to clients
- shared state remains control-plane only
- player behaves seamlessly in real two-client browser test
