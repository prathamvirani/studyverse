# MID-07 — Accessibility, Platform Capability Layer & Final QA

## Objective

Finish the refresh with accessibility, cross-platform consistency, progressive native integration hooks, performance validation and comprehensive regression testing.

## Accessibility

Validate:

- keyboard navigation
- visible focus
- screen-reader labels
- contrast in Light/Dark
- reduced motion
- reduced transparency
- high-contrast preference where available
- non-color-only status cues
- touch target sizes on touch layouts
- zoom/reflow
- no hidden essential controls on hover only

## Cross-platform visual consistency

Test at minimum:

- Windows Chromium
- Linux Chromium
- Linux Firefox where practical
- mobile-width responsive simulation
- actual supported mobile browsers where available

Apple-inspired design must remain coherent on Windows/Linux.

Do not depend on SF/New York files.

## Platform capability abstraction

Architect, but do not over-implement, capability discovery for:

- passkeys
- native sharing
- push/badges
- media session controls
- wake lock
- PiP
- OS-managed camera/audio effects
- future native features

Conceptual interface:

```text
PlatformCapabilities
auth.passkeys
share.nativeShare
notifications.push
notifications.badge
media.osControls
display.wakeLock
video.pictureInPicture
video.systemEffects
audio.systemEffects
system.liveActivities
system.widgets
system.shortcuts
system.conversations
```

Web app should expose only genuinely supported capabilities.

Never fake OS controls.

## Phase-09 relevant hook

Personal Study Player may later use Media Session API, but MID-07 must not implement Phase 09 itself.

## Native future guidance

Document progressive enhancement for:

- macOS camera effects / Continuity Camera
- Windows Studio Effects
- Android credential/media/conversation integrations
- Apple Live Activities/Shortcuts
- Linux MPRIS/XDG portals

These are future native-app capabilities, not refresh deliverables unless already available safely through web APIs.

## Final QA matrix

Verify:

### Auth/account
- stale cookie recovery
- provider login
- onboarding
- username
- account delete

### Non-room
- Home
- My Rooms
- Discover
- Friends
- Account
- create/edit room
- room settings

### Room
- two-client presence
- chat
- tasks
- Pomodoro personal/shared
- Clock
- drag/snap
- ambient/projector
- dock
- settings
- background
- RTC

### Media
- YouTube
- queue
- metadata
- shared playback
- local mix
- owner/mod permissions
- late join
- hide/show video tile

### Responsive
- normal desktop
- ultrawide compressed
- ultrawide full-width
- tablet width
- mobile width
- browser zoom

### Themes/accessibility
- Light
- Dark
- System
- reduced motion
- reduced transparency

## Final report

Create a final Mid-Design Refresh report describing:

- completed changes
- test counts
- fixed regressions
- screenshots
- known limitations
- deferred future features
- readiness recommendation for Phase 09

Do not mark Phase 09 active without explicit user approval.
