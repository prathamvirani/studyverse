# MID-04A rail layout and focused entry follow-up evidence

Captured on 2026-10-02 from the production Nuxt build through the isolated local HTTPS Chromium harness. MID-04A remains **COMPLETE — AWAITING_REVIEW**. This directory supplements the preserved initial and first owner-follow-up evidence.

- `descriptor-{left,right,top,bottom}.png`: the same participant rail collapses into a pointer-following horizontal descriptor. Browser assertions check retained rail/participant/room nodes and unchanged websocket count.
- `preview-{left,right,top,bottom}.png`: a single localized target matches the final dropped rail footprint.
- `bottom-narrow.png`: the rail reaches the usable bottom safe edge at 390×844, with the dock displaced above it and controls reachable.
- `header-snaps.png`: the indivisible horizontal header after exercising all four magnetic anchors. Separate assertions verify free x persistence through reload and fixed y placement.
- `entry-confirmation.png` and `entry-leave-confirmation.png`: focused room context, reserved prompt/error geometry and the secondary decision. Admission and rotation are verified by assertions rather than inferred from screenshots.
- `ambient-{home,my-rooms,discover,friends,account,configure}-{light,dark}-{1440,390}.png`: shared blue bloom composition across six pages, two themes and two viewport widths. Browser checks assert the shared ambient system and absence of horizontal overflow.

The directory contains 36 PNGs. The capture matrix uses desktop and narrow widths; it does not establish cross-browser or hardware coverage. Descriptor/geometry checks use reduced motion for stable measurements. The entry rotation test uses normal motion and waits for the opening transition before comparing geometry.

The committed entry test holds the server response and verifies that no navigation or RTC admission occurs while it is pending, then observes exactly one join and one RTC admission. Cancellation and the second decision create no membership. A separate case changes a selected public room to private before commit and verifies authoritative denial on the original page. Explicit management actions retain configuration navigation.

Logs, starting hashes, data-preservation checks and final integrity inventory are in `.local/validation/mid04a-layout-entry/`. Original focused assertion failures and their corrective runs remain recorded. Historical references are restored after browser validation; development data and service volumes are not reset. Invite bearer links are excluded from these captures.
