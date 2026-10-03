# MID-04A third owner follow-up — visual evidence

Captured on 2026-10-02 with Playwright Chromium against the isolated HTTPS browser harness. This directory contains the new follow-up evidence; historical MID-04A reference captures are retained separately. Phase status remains **COMPLETE — AWAITING_REVIEW**.

| Capture                                                            | Image dimensions | Review purpose                                                                                 |
| ------------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------- |
| [Inline rearrange](inline-rearrange.png)                           | 1440 × 1000      | Workspace grip shares its pill row; editing outlines and controls retain their footprints.     |
| [Chat minimum and touch](chat-minimum-touch.png)                   | 1440 × 1000      | Chat at its 200px minimum keeps the integrated composer visible; history uses remaining space. |
| [Address and invites, desktop](address-invites-desktop.png)        | 1440 × 1039      | Right-edge address validation, balanced invite fields, shared action alignment and spacing.    |
| [Address and invites, narrow](address-invites-narrow.png)          | 390 × 1370       | Fields stack with compact actions; full-document capture at a narrow viewport.                 |
| [Direct entry without Back](shell-direct-no-back.png)              | 1440 × 700       | Direct configuration entry has no fabricated prior navigation.                                 |
| [Room-first doorway](room-first-doorway.png)                       | 1280 × 720       | Fixed linked decision copy and glass scrim over the resolved room preview.                     |
| [Same shell after admission](same-shell-admitted.png)              | 1280 × 720       | Admission activates the already-rendered shell, with the entry sheet dismissed.                |
| [Shared context menu](global-context-menu.png)                     | 1280 × 720       | Root page actions, keyboard focus, glass menu and native-menu escape hint.                     |
| [Chat companion, wide](chat-companion-wide.png)                    | 720 × 300        | Tool fills the companion viewport and sends through the existing room state.                   |
| [Participant companion, wide](participants-companion-wide.png)     | 720 × 300        | Wide rail uses horizontal presentation of the existing authorized participant.                 |
| [Dock companion, wide](dock-companion-wide.png)                    | 720 × 300        | All six controls operate the owner room from a horizontal utility controller.                  |
| [Existing local camera companion](same-track-camera-companion.png) | 420 × 520        | Adopted local renderer and stream, with self/microphone caption.                               |
| [Existing remote subscription](same-subscription-remote-video.png) | 420 × 520        | The subscribed remote video element and stream continue advancing in the companion.            |

The browser assertions also exercise 300 × 620 tall companions, horizontal/vertical rail and dock changes, element identity, normal geometry restoration, single-window close, Restore all, popup blocking, native second right click, text editing, IME handling, unauthorized deletion, authoritative entry denial, and absence of pre-entry room/RTC/capture ownership. Screenshots supplement those assertions; they do not establish subscription or authorization behavior on their own.

Bulk companion images use bounded direct Chromium surface capture because Playwright's normal page screenshot preparation stalled in a multi-window capture. These are actual browser-rendered surfaces. Native individual Document PiP is covered separately. Synthetic local/remote capture and the local LiveKit SFU establish the tested browser ownership behavior, not physical camera hardware, every browser, OS screen pickers, or real YouTube playback. The YouTube fixture verifies preservation of the existing iframe/provider and alternate-controller behavior.

Validation details and scope are recorded in [the owner-review report](../../../reports/MID_04A_OWNER_REVIEW_CORRECTIONS_AND_ROOM_STABILITY_REPORT.md). The final machine-readable evidence manifest is `validation.json` in this directory.
