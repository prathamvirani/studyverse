# MID-03 — Home, Rooms, Discover & Friends

Status: COMPLETE — AWAITING_REVIEW

Implemented against the accepted working-tree baseline on 2026-09-20. Phase 08 and MID-00–02 remain ACCEPTED. MID-03 is the only authorized implementation phase. Phase 09, MID-04 and later phases have not begun.

## Result and preserved boundaries

Authenticated Home now leads with friends and places to study. My Rooms, Discover and contextual room panes share one directly enterable RoomCard. Friends is a searchable social list with a selected-person pane; presence/privacy configuration lives in Account. Room detail is management, while card entry performs the existing authorized join POST before mounting the existing room composition.

The MID-01 shell, navigation, width modes, fonts, appearance preferences, route veil and footer remain in place. MID-02 authentication, UUID identity, username policy, onboarding, devices and account deletion are preserved. No migration, package dependency, durable table, SFU participant feed, new DM route or room-shell redesign was introduced. Inherited uncommitted MID-01/02 work was preserved using a 448-file start-of-task hash inventory rather than treating Git HEAD as the accepted baseline. All 17 existing SQL migrations, dependency files and historical reports/references remain unchanged.

## Shared RoomCard and room entry

`RoomCard.vue` owns the display and interaction; `RoomCards.vue` supplies the responsive grid. The additive `Room` contract carries the selected curated background ID, optional viewer-authorized online/friend counts and the viewer's actual last-visited timestamp. Older list contracts and UUID cursors remain supported.

- Title-case privacy and membership-role badges, bounded description/tags, correct member pluralization, and separate online counts explicitly labeled “visible to you.” Missing online data is omitted, never substituted with membership count.
- A stretched semantic title link makes the body clickable. Open room uses the same entry URL. Gear is a separately named sibling link with propagation stopped; it opens management without joining. Native Enter and explicit Space handling are supported, with visible keyboard focus.
- Cards only render data and links. On deliberate entry, the route reads authorized detail and calls `/api/v1/rooms/join`; only a successful response mounts the accepted room shell. Revoked/private access is still rejected by the server. Route-disposal guards prevent late async entry after navigation.
- The selected catalog thumbnail is a lazy-loaded, decorative full-card layer at low opacity, with a 280ms one-time reveal after load. Failure/missing data uses the neutral card surface. Reduced motion, reduced transparency and high-contrast fallbacks retain legibility. No full-resolution background preload or uploaded local file URL is exposed.

## Home and My Rooms

Home replaces the authenticated marketing hero with a compact page header, desktop social column, My Rooms and Public Rooms. The personal friend order uses only a visible room matching the viewer's memberships, visible non-offline status, then name. It displays no score or ranking. There is no inferred hidden activity or recommendation model. Mobile places Friends before the room sections.

Home previews at most eight own/joined rooms and eight additional public rooms, with links to the full browsing pages. Friendly empty states provide create/find actions. `/home` and the accepted `/` alias remain compatible.

My Rooms uses the MID-01 wide shell, compact create action, IntegratedSearch and adaptive grid. Auto fills available width; manual choices from one to eight columns are offered only when feasible for approximately 280px cards. A saved larger choice falls back to Auto on a narrower screen. The local, versioned preference uses the existing IndexedDB adapter and validated SSR cookie mirror, follows the accepted first-paint preference policy, and is cleared with account-local data. Storage failures show a nonblocking message.

## Discover filters and data sources

The new authenticated `GET /api/v1/rooms/browse` operation serves My Rooms and Discover (60 requests/minute). Discover candidates are public rooms only; My Rooms requires an actual membership. Search matches existing name, description and tags. SQL applies candidate visibility, search, minimum members, viewer-projected presence filters and ordering before the 50-item offset page. Owner block checks remove forbidden rows before output; this can shorten a page. Responses expose only authorized room records and aggregate counts.

| Control                        | Actual source/meaning                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| All rooms                      | Authorized candidates in the selected scope                                                             |
| Online now                     | At least one valid non-offline presence visible to this viewer in that room                             |
| Friends here                   | Accepted friends with visible online and room presence                                                  |
| Friends studying               | The preceding friends whose authorized status is focusing                                               |
| Minimum members                | Durable membership count; Any size, 2+, 5+, 10+                                                         |
| Recommended                    | Viewer last visit descending, visible friend count, visible online count, creation time, stable room ID |
| Most active now / Friends here | The corresponding authorized count, then newest and ID                                                  |
| Newest / Largest / Smallest    | Actual creation time or durable membership count, with stable ties                                      |
| Last visited (My Rooms)        | Existing membership last-visited timestamp                                                              |

No “recently active” metric is invented. Search is debounced; sort/filter/member/density state is bounded and retained in the URL. Generation checks discard outdated search results. Load more deduplicates IDs. Errors have Retry; contextual empty states distinguish matches, visible activity, friends and no rooms. A wide-screen side pane provides two familiar rooms. Block-filtered empty pages with a next cursor retain Load more instead of falsely claiming the listing is exhausted.

## Friends and username discovery

Friends has a desktop list/detail composition and mobile list-to-detail drill-in. The list searches existing friends by display name or username and retains incoming, outgoing, blocked and invitation actions. Selected detail shows only authorized presence, actual shared memberships, an owned-room invitation selector, and existing remove/block controls. The selected username can be restored through the bounded `friend` query parameter. There is no fake Message action or recent-activity feed.

PresenceSettings extracts the existing status and five privacy controls into Account, linked from Friends. Existing social socket snapshots and server-side privacy policy remain authoritative. Home and Friends update from those snapshots; blocks remove the affected friend.

`GET /api/v1/friends/search` is authenticated, exact-handle only, limited to 20 requests/minute and HTTP-only. It returns just canonical username, display name and relationship state. No UUID, provider ID, email, avatar source or private profile fields are returned by this search. Unknown, self, blocked, unrelated and ineligible private targets all return the same empty shape. New discovery requires a shared room authorized for both people and the target's existing invitation preference; existing relationships can be found directly. Prefix/global directory search is deliberately unavailable.

The existing request command additionally accepts a username, resolves it to the permanent UUID inside the feature, and preserves the meet-in-a-room, block, quota and relationship checks. It rechecks the current handle owner under the social transaction and a user-row share lock, so a concurrent username change cannot redirect a request to a stale identity. Existing UUID-based participant actions remain compatible. This is an internal directory port, not a public identity-resolver endpoint.

`GET /api/v1/rooms/shared` requires an accepted friendship, no mutual block and enabled social functionality. It returns at most 50 actual shared memberships ordered by the viewer's last visit; owner blocks for either person exclude the room. It is not a presence or shared-session history endpoint.

## Room management and form

Room management uses a wider layout, subtle selected-background identity, right-aligned vertical role/privacy badges, separate member/visible-online counts and “Available even when the owner is away.” Existing editing and invite-link controls remain authoritative. A contextual pane shows other joined rooms where available. Returning from a direct room session reloads owner invitation links for management.

Back targets are restricted to Home, My Rooms, Discover and Friends (including bounded known query keys). External, protocol-relative, malformed and unsafe targets fall back to `/my-rooms`. Browse pages restore the recorded scroll position where practical; search/filter/density and selected-friend context survive the card/detail round trip. No external return URL can become a navigation target.

Create and edit continue sharing RoomForm and the existing room-field schema. Visible Public/Unlisted/Private radio cards replace the privacy dropdown. Branded controls, section spacing, a responsive form/preview layout and a noninteractive live RoomCard preview improve clarity without replacing optimistic version checks or server validation.

## Backend ownership and privacy

The background feature provides only an allowlisted selected curated asset ID (including its actual default); the rooms feature asks for it only after room authorization. The presence feature owns the new aggregate projection. It validates leases, session expiry/revocation and current membership, calls the existing viewer-specific presence view for each distinct participant, and counts only visible room/non-offline status. Hidden online, hidden room and hidden study settings cannot be inferred through the new filters. Friends studying requires the projected focusing state, not private raw status. Disabled presence supplies no private occupancy.

Room/background/presence/social composition uses feature SDK ports; no feature reads another feature's tables for these projections. Private occupancy and SFU rosters remain separate. All mutations still use the accepted session, CSRF, permission and rate-limit pipeline. No database data was reset for implementation.

## Changed files

This inventory is relative to the inherited working-tree baseline, not all files currently shown by Git status.

| Area                       | Files                                                                                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared web surfaces        | `apps/web/app/components/RoomCard.vue`, `RoomCards.vue`, `RoomListing.vue`, `RoomForm.vue`, `PresenceSettings.vue`                                                                                                                                          |
| Pages                      | `apps/web/app/pages/index.vue`, `friends.vue`, `account.vue`, `rooms/[id].vue`, `rooms/new.vue`                                                                                                                                                             |
| Local presentation/routing | `apps/web/app/composables/useRoomGrid.ts`, `apps/web/app/lib/room-navigation.ts`, `clear-account-local.ts`                                                                                                                                                  |
| Contracts and ports        | `packages/contracts/src/identity.ts`, `social.ts`, generated `openapi-v1.json` / `protocol-v1.schema.json`, `packages/feature-sdk/src/social.ts`                                                                                                            |
| Feature-owned server code  | `packages/features/{rooms,friends,presence,identity,backgrounds,room-media}/src/server.ts`                                                                                                                                                                  |
| API composition            | `apps/api/src/identity.ts`, `main.ts`, `social.ts`                                                                                                                                                                                                          |
| Tests                      | `tests/unit/room-browse.test.ts`, `tests/services/social.test.ts`, `tests/services/room-media.test.ts`, `tests/browser/room-browse.spec.ts`, `identity-rooms.spec.ts`, `room-workspace.spec.ts`, `social.spec.ts`, `visual-foundation.spec.ts`, `server.ts` |
| Coordination/evidence      | `docs/ACTIVE_PHASE.md`, `docs/PHASE_HISTORY.md`, this report, `docs/references/mid03/`                                                                                                                                                                      |

## Validation

Focused development checks covered schema/return-path validation, exact username privacy and rate limits, real two-user presence filters, deterministic paging, direct card entry, settings isolation, browser history/query state, themes, responsive grids, requests, shared rooms and invitations. Initial failures found and corrected an extra argument turning detail GET into POST, obsolete privacy-dropdown/auto-selected-friend locators, asynchronous screenshot readiness and existing snapshot compatibility for accounts without usernames.

All **321 distinct regression cases** are covered across the full groups and focused corrections: 199 unit/integration/security/architecture, 78 services, 42 browser and two Docker checks. This is not a claim that the first aggregate command passed uninterrupted. Local logs below are under `.local/validation/mid03/`.

| Check                                       | Result / local evidence                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused services/unit                       | 19 passed; `focused-services-second.log`                                                                                                                                                                                                                                                                                       |
| Focused browser                             | Five passed; `browser-focused-final.log`                                                                                                                                                                                                                                                                                       |
| Full unit/integration/security/architecture | 199 passed in 32 files; `regression-final.log`                                                                                                                                                                                                                                                                                 |
| Full PostgreSQL/Redis services              | 78 passed in six files; `services-final.log`                                                                                                                                                                                                                                                                                   |
| Media compatibility guard                   | Five passed after adding a username to the controlling user's service fixture; `media-compatibility.log`                                                                                                                                                                                                                       |
| Browser/SFU run                             | First full run passed 30 cases, including all RTC/SFU cases, before correction/recovery; `browser-full.log`. The targeted 19-case run passed 17, and its two remaining legacy visual assertions then passed; `browser-corrections.log`, `browser-foundation-final.log`. All 42 distinct cases covered, no intentional skips.   |
| Lint / typecheck / contracts / security     | Passed in `regression-final.log` and again after compatibility edits in `checks-corrections.log`; dependency audit: zero vulnerabilities                                                                                                                                                                                       |
| Production builds                           | API and Nuxt passed; `regression-final.log`, final `build-compatibility.log`; final Docker API/web images passed in `compose-build-final.log`                                                                                                                                                                                  |
| Local refresh / Docker                      | API/web containers healthy after scoped recreation; two Docker checks passed (`compose-refresh.log`, `docker-final.log`). PostgreSQL/Redis/SFU volumes were not reset or replaced.                                                                                                                                             |
| Data preservation                           | All 19 development tables retain identical row counts and full-row content digests, including migration ledger; `data-preservation.log`, `development-data-before.json`, `development-data-after.json`                                                                                                                         |
| Local HTTPS smoke                           | Refreshed `/home`, decoded provider marks, protected stale-session 401/public providers 200, no page/CSP errors; `local-smoke.log`, `local-smoke.json`                                                                                                                                                                         |
| Formatting / integrity                      | Scoped Prettier and `git diff --check` passed. Whole-repository format check reports only two unchanged historical MID-01 reference JSON files: `layout-matrix.json`, `ready-reveal.json` under `docs/references/mid01/corrections-2026-09-20/`. `validate-final.log` records this exception; remaining checks ran separately. |

The full browser run exposed an additive-directory compatibility issue: media's existing strict person schema rejected the new optional username. Its feature-owned projection now explicitly selects only ID/name; media contracts, controls and state semantics are unchanged. The media service fixture now includes a username and asserts the legacy output shape. An old room-workspace locator was updated from “My Rooms” to contextual “Back.”

A frontend rebuild was mistakenly started while the final visual-foundation group still used the preceding output, causing missing hashed assets. The affected run was stopped, the build stabilized and that entire group rerun. The subsequent two visual failures were stale assertions: a mobile browse page now legitimately scrolls, so footer clearance is checked at the end of the document; and the image-readiness test now selects its injected critical image rather than counting the new card thumbnails. Opaque cover, cancellation, focus, reduced motion and image readiness assertions remain intact. Passing expensive RTC/SFU cases were not rerun unnecessarily.

[Seventeen screenshots and their manifest](../references/mid03/README.md) preserve the reviewed compositions. The matrix covers 1440px desktop, 3440px ultrawide, 820px tablet, 390px mobile and 320px small mobile, Light/Dark/System, reduced motion, feasible columns and horizontal overflow. Existing foundation checks also pass for Compressed/Full-width, all transparency levels, focus, touch, footer clearance and the quiet route veil. The one-client real YouTube probe observed Playing at approximately seven seconds with external provider/policy warnings; it is supplementary evidence, not a certification of deferred two-client looping behavior.

## Limitations and deferred work

Browse counts are authorized request-time snapshots, refreshed by browsing actions, not a new real-time occupancy subscription. Projections currently iterate local valid presence leases and are appropriate to the existing single-process presence architecture; no distributed presence/scalability certification is claimed. Offset pagination can shift under concurrent room changes; the UI removes repeated IDs. Post-query owner-block filtering can produce short pages. Shared-room and owned-invite context is bounded to 50 candidates; Home is a bounded preview and can omit further public candidates after excluding joined rooms. Browse scroll restoration is in-memory and does not survive a full browser restart.

There is no global username directory, new avatar authority, inferred recent shared activity, recommendation ML, public ranking, DM system, scheduling/calendar, alias infrastructure or new social-privacy policy. Validation uses local Chromium, deterministic OAuth fixtures and emulated viewports; it does not certify physical devices, other browsers, screen readers or external provider sign-in. Existing external YouTube/two-client looping limitations remain deferred; this phase does not claim to fix provider playback behavior.

MID-04 room-shell/presence redesign and all later refresh work remain deferred. **Phase 09 was not started. Stop after MID-03 for owner review.**
