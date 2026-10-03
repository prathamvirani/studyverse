# MID-01 — Visual Foundation, Global Shell & Motion

## Objective

Replace the current flat cream/yellow-green and narrow tablet-like presentation with a coherent cross-platform Apple-inspired liquid-glass design system.

## Scope

### Visual system

Implement:

- neutral light/dark foundations
- liquid-glass surface tokens
- semantic color tokens
- typography tokens
- spacing/radius/shadow tokens
- motion tokens
- reduced-transparency fallback
- dark/light/system appearance

### Typography

Primary UI family:

- **Inter**

Display/atmosphere serif:

- **Instrument Serif** preferred starting point
- another properly licensed serif may be used if technically superior

Use tabular numerals for timers/clocks where appropriate.

Do not ship Apple SF or New York webfonts unless licensing explicitly allows redistribution.

The application must still look intentionally Apple-inspired on Windows/Linux.

### Global navigation

Desktop/laptop:

- floating left icon-first glass rail
- Home
- Rooms
- Friends
- Discover
- Chat only when/if implemented
- profile/avatar at bottom
- global utility actions separated appropriately

Mobile:

- floating bottom glass tab bar

Tablet:

- adapt by available width, not device-name heuristics

Room pages:

- hide global nav
- use room-specific chrome

### Page shell

Eliminate narrow “iPad on desktop” layout.

Support:

- Auto
- Compressed
- Full-width

Respect stored user preference.

### Global search

Create integrated search control:

- search icon inside
- clear action
- submit/enter behavior
- inline loading state
- no separate giant Search button underneath

### Route transitions

Use a short glass transition:

- prepare critical first frame
- glass veil
- standardized loader
- reveal complete destination
- typical minimum visual duration ~350–600 ms
- do not add multi-second fake delay
- actual loading can extend naturally
- reduced-motion fallback

Room entry may use room-background spread/reveal.

### Global dropdown/select

Replace visibly raw Windows/browser-style dropdown presentation where custom treatment improves UX.

Use branded accessible select/combobox/listbox patterns.

Do not replace appropriate native controls blindly.

## Out of scope

- room productivity redesign
- media redesign
- future DMs/calendar
- Phase 09

## Acceptance

- theme works in System/Light/Dark
- no flash-of-wrong-theme
- reduced transparency/motion handled
- desktop shell uses width properly
- global navigation works at keyboard/touch widths
- integrated search component works
- route transitions do not add artificial long waits
- no accepted behavior regression
