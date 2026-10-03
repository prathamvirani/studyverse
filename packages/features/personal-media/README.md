# Personal media

Device-private playback owner and provider registry. See [architecture](../../../docs/architecture/PERSONAL_STUDY_PLAYER.md) and [Phase 09 report](../../../docs/reports/PHASE_09_PERSONAL_STUDY_PLAYER_REPORT.md).

Register a `PersonalMediaAdapter` through `PersonalProviderRegistry`; inject the registry, existing preference-store port and local room-gain sink into `createPersonalPlayer`. The app composes concrete providers and presentation contributions. This package imports only contracts/SDK ports and exposes no server/realtime operations. The test adapter in `tests/unit/personal-media.test.ts` demonstrates extension without changes to player core.
