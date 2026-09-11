# Studyverse Implementation Phases

These specifications may coexist in the repository. Consult [the active phase](../ACTIVE_PHASE.md) for the only specification currently authorized for implementation and [phase history](../PHASE_HISTORY.md) for user-accepted work.

**Always keep `docs/UMBRELLA_SPEC.md` in the repository.** Each phase file tells the implementation agent to read it first and treat it as the authoritative product contract.

The coordination files do not override the umbrella specification and are not a security boundary. The presence of another phase file does not authorize implementation. Do not begin another phase automatically; changing the active phase and accepting completed work require explicit user instructions.

## Phase order

- **Phase 0:** [Foundations](./PHASE_00_FOUNDATIONS.md)
- **Phase 1:** [Identity, Sessions, Home & Rooms](./PHASE_01_IDENTITY_SESSIONS_HOME_AND_ROOMS.md)
- **Phase 2:** [Canonical Room Shell](./PHASE_02_CANONICAL_ROOM_SHELL.md)
- **Phase 3:** [Presence, Friends & Invitations](./PHASE_03_PRESENCE_FRIENDS_AND_INVITATIONS.md)
- **Phase 4:** [Realtime Productivity: Pomodoro, Tasks & Chat](./PHASE_04_REALTIME_PRODUCTIVITY_POMODORO_TASKS_AND_CHAT.md)
- **Phase 5:** [Backgrounds & Environment Assets](./PHASE_05_BACKGROUNDS_AND_ENVIRONMENT_ASSETS.md)
- **Phase 6:** [Basic RTC: Mic, Camera & Screen Share](./PHASE_06_BASIC_RTC_MIC_CAMERA_AND_SCREEN_SHARE.md)
- **Phase 7:** [Advanced RTC & Quality Control](./PHASE_07_ADVANCED_RTC_AND_QUALITY_CONTROL.md)
- **Phase 8:** [Room Media, Ambience & Shared Mix](./PHASE_08_ROOM_MEDIA_AMBIENCE_AND_SHARED_MIX.md)
- **Phase 9:** [Personal Study Player](./PHASE_09_PERSONAL_STUDY_PLAYER.md)
- **Phase 10:** [Spotify & Apple Music Provider Integrations](./PHASE_10_SPOTIFY_AND_APPLE_MUSIC_PROVIDER_INTEGRATIONS.md)
- **Phase 11:** [Social Bonding & Mini-Games](./PHASE_11_SOCIAL_BONDING_AND_MINI_GAMES.md)
- **Phase 12:** [OBS / Studio Ingest](./PHASE_12_OBS__STUDIO_INGEST.md)
- **Phase 13:** [Browser Companion Extension](./PHASE_13_BROWSER_COMPANION_EXTENSION.md)
- **Phase 14:** [Native Applications](./PHASE_14_NATIVE_APPLICATIONS.md)

Social Bonding follows media/music because optional break activities are part of the core social study experience. OBS, extension and native clients follow as power-user/platform expansions. Sequence does not imply a functional dependency; see each specification’s prerequisites. Phase 06 remains the latest accepted baseline, and Phase 07 requires explicit owner authorization.
