# Active Development Phase

ACTIVE_PHASE: 06

ACTIVE_SPEC:
docs/phases/PHASE_06_BASIC_RTC_MIC_CAMERA_AND_SCREEN_SHARE.md

STATUS:
ACCEPTED

Phase 06 is accepted. Maintenance does not activate another phase; wait for explicit owner authorization before beginning Phase 07.

## Rules

- `docs/UMBRELLA_SPEC.md` is always authoritative.
- Only the file referenced by `ACTIVE_SPEC` is authorized for implementation.
- Other phase specifications may exist in `docs/phases/`.
- Their presence does not authorize implementation.
- Do not begin another phase automatically.
- The active phase may only be changed following an explicit user instruction.
- At the end of the active phase, set `STATUS` to `AWAITING_REVIEW` and stop.
- Do not mark a phase `ACCEPTED` unless the user explicitly says it is accepted.
- Do not change `ACTIVE_PHASE` or `ACTIVE_SPEC` merely because implementation is complete.
- These coordination files are for development coordination only and are not a security boundary.
