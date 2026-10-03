# MID-03 — Home, Rooms, Discover & Friends

## Objective

Turn the non-room application into a dense, useful social study product rather than a collection of narrow hero cards.

## Home

Remove or drastically reduce authenticated marketing hero.

Desktop concept:

- left/social column: friends, ordered privately by useful study affinity
- main: Your Rooms
- below: Public Rooms
- useful quick actions/resume behavior

Do not implement full DMs unless separately authorized.

## Shared RoomCard

Use one consistent RoomCard across:

- Home
- My Rooms
- Discover
- contextual panes

Requirements:

- full card click enters room
- `Open room` enters room
- settings/gear opens room detail/settings
- nested actions stop propagation
- keyboard accessible
- title-case role/privacy tags
- membership count separate from online count
- current room background as subtle full-card visual layer
- graceful background reveal
- readable contrast
- neutral fallback

## My Rooms

- adaptive/customizable grid
- live/integrated search
- compact create/filter controls
- Auto/manual feasible column count
- footer behavior fixed

## Room detail/settings page

Treat as management page, not entry intermediate.

- contextual Back to app origin
- direct deep-link fallback
- preserve query/filter/scroll where practical
- wider desktop layout
- privacy + role badges in right-aligned vertical stack
- member vs online counts explicit
- correct grammar
- contextual side pane

## Create/Edit Room

May remain separate pages.

They should:

- share controls/validation/style
- use desktop-appropriate form layout
- use branded selects
- use visual privacy options where appropriate
- optionally show live RoomCard preview
- avoid generic giant hero

## Discover

Build real discovery surface.

Filtering:

- online now
- friends here
- friends studying
- member count
- online count
- recency
- sorting
- tags later if supported

Grid:

- customizable
- responsive
- same RoomCard

## Friends

Replace settings-like page with real social layout.

Desktop:

- friend/search/request list
- selected friend/context pane
- message/invite affordances
- recent shared rooms
- blocked/pending groups

Move privacy/presence configuration to Account/Privacy, keeping only compact contextual controls here.

## Acceptance

- non-room pages no longer look tablet-first on desktop
- shared RoomCard behavior is consistent
- room metadata is unambiguous
- Discover filters/search/grid work
- Friends reads as a social surface
- no future social architecture is accidentally implemented beyond scope
