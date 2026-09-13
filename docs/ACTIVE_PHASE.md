# Active Development Phase

ACTIVE_PHASE: 08

ACTIVE_SPEC:
docs/phases/PHASE_08_ROOM_MEDIA_AMBIENCE_AND_SHARED_MIX.md

STATUS:
AWAITING_REVIEW

Phase 07 is accepted by the owner. Phase 08 implementation and validation are complete and await owner review. Phase 08 is not accepted. Phase 09 is not authorized. See [the Phase 08 report](reports/PHASE_08_REPORT.md).

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
