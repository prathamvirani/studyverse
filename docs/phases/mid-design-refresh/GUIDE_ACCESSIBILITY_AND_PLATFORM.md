# Guide — Accessibility & Platform Integration

## Accessibility first

Support:

- keyboard
- visible focus
- screen readers
- zoom/reflow
- dark/light contrast
- non-color status
- reduced motion
- reduced transparency
- high contrast where available

Do not make hover the only way to access essential actions.

## Appearance

Modes:

- System
- Light
- Dark

Default:

- System

## Reduced transparency

Glass becomes more opaque while preserving hierarchy.

## Platform progressive enhancement

Core workflow must work everywhere.

Then detect and enhance with:

- passkeys
- Web Share
- Push/Badging
- Media Session
- Wake Lock
- Picture-in-Picture
- OS-managed camera/audio effects

Do not expose fake toggles for capabilities the browser cannot control.

## Future native integrations

Architect/document for:

- macOS camera effects / Continuity Camera
- Windows Studio Effects / Voice Focus
- Android Credential Manager / conversations / PiP
- Apple Live Activities / Dynamic Island / App Intents
- Linux MPRIS / XDG portals

These are future native enhancements, not current web requirements unless a safe browser API already exists.

## Cross-platform design

Study Space should look Apple-inspired on:

- Windows
- Linux
- Android
- Apple platforms

Do not rely on Apple-only font rendering.
