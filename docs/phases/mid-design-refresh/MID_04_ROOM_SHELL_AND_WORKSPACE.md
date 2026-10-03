# MID-04 — Room Shell, Workspace & Presentation Modes

## Objective

Redesign the room shell into the strongest, most native-feeling part of Study Space while preserving accepted realtime/RTC architecture.

## Participant rail

Fix live-presence regression where multiple connected accounts can chat but only one participant appears.

Expected:

- every connected user exactly once
- current user marked `You`
- join/leave/reconnect correct
- membership count remains separate from live presence

Replace verbose `Mic off` text with avatar-overlay status icons.

Mic speaking state can use a subtle live ring.

## Atmosphere text

Keep the room quote/caption.

Make it viewport-safe:

- browser zoom cannot hide it
- responsive typography
- safe-area positioning
- subtle contrast treatment

## Top room identity controls

Separate into compact glass controls:

- Back
- room identity/privacy
- Invite

Avoid one verbose combined chip.

## Productivity layout

Retire fixed combined right pane.

Use four independent draggable floating glass cards:

- Pomodoro
- Tasks
- Chat
- Clock

Cards:

- draggable
- bounded
- persist layout
- individually hide/collapse
- lift/spring while dragging

### Right-third snap

Dragging into right third:

- reveal snap targets
- preview slot
- dock into structured vertical layout
- spring settle

## Ambient / Presentation / Projector Mode

Presets:

- Standard
- Minimal
- Ambient
- Projector
- Custom

Allow selective visibility:

- participants
- room header
- quote
- Clock
- Pomodoro
- Tasks
- Chat
- dock

Reveal behavior:

- keyboard shortcut
- mouse move
- edge hover
- tap/click hotspot

Projector mode:

- larger time/timer
- stronger contrast
- optional cursor auto-hide
- minimal chrome

## Bottom room dock

Use correct coherent native-style icons:

- Media
- Background
- Mic
- Camera
- Screen Share
- More

Mic:

- actual input-level feedback
- muted/on/speaking/clipping/error states

Camera/share:

- clear active/error states

## More → Room Settings

Replace raw scrolling panel with a proper glass settings sheet.

Desktop:

- centered floating settings surface
- category column
- selected settings content

Categories:

- Media & Devices
- Quality
- Audio
- Camera
- Appearance
- Room & Privacy
- Notifications
- Diagnostics

Most settings apply immediately.

Diagnostics owns technical requested-vs-actual details.

## Liquid Glass opacity

Appearance settings:

- Auto
- manual opacity slider

Auto adapts to background/theme/contrast.

Reduced-transparency overrides toward opacity.

## Acceptance

- two-client participant presence works
- room shell remains performant with background + video
- drag/snap persists
- projector mode works without trapping user
- room chrome follows liquid-glass system
- RTC/audio/video behavior remains accepted
