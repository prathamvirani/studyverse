# MID-04A Owner QA Follow-up evidence

MID-04A remains COMPLETE — AWAITING_REVIEW. These captures supplement the original MID-04A evidence, which is preserved separately.

- `workspace-handles.png`: shared workspace controls and all-eight-direction interaction coverage.
- `rail-free-drag-*.png` / `rail-preview-*.png`: pointer-following rail and one localized preview at each edge; the same participant nodes survive drag/drop.
- `media-collapsed.png`: one existing iframe in the visible collapsed player. This capture uses the deterministic provider fixture, whose iframe surface is blank; playback/synchronization is measured by the browser test.
- `fill-pixels-*.png`: isolated nested fill probes over a constant backdrop at 0/25/50/75/100, Light and Dark. Blur, borders and shadows are disabled on the diagnostic probes to isolate alpha. Pixel/computed-layer evidence lives in `.local/validation/mid04a-owner-qa/`.
- `account-fill-*.png`: actual Account material composition at each level; `room-fill-zero.png` covers room materials.
- Browse alignment captures cover My Rooms/Discover at desktop, tablet and narrow widths.
- `real-youtube.png`: bounded real-provider probe; its outcome and provider/network errors are retained in the follow-up validation directory.

Invite bearer links are verified by assertions rather than included in screenshots or this index. Existing service fixtures and development data are not reset.

## Capture inventory

```text
account-fill-dark-0.png
account-fill-dark-100.png
account-fill-dark-25.png
account-fill-dark-50.png
account-fill-dark-75.png
account-fill-light-0.png
account-fill-light-100.png
account-fill-light-25.png
account-fill-light-50.png
account-fill-light-75.png
discover-1440.png
discover-390.png
discover-820.png
fill-pixels-dark-0.png
fill-pixels-dark-100.png
fill-pixels-dark-25.png
fill-pixels-dark-50.png
fill-pixels-dark-75.png
fill-pixels-light-0.png
fill-pixels-light-100.png
fill-pixels-light-25.png
fill-pixels-light-50.png
fill-pixels-light-75.png
media-collapsed.png
my-rooms-1440.png
my-rooms-390.png
my-rooms-820.png
rail-free-drag-bottom.png
rail-free-drag-left.png
rail-free-drag-right.png
rail-free-drag-top.png
rail-preview-bottom.png
rail-preview-left.png
rail-preview-right.png
rail-preview-top.png
real-youtube.png
room-fill-zero.png
workspace-handles.png
```
