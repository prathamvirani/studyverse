# Guide — QA & Regression

## Preserve accepted behavior

Every refresh phase must keep:

- authentication/session security
- IDOR/BOLA protections
- server-authoritative permissions
- room privacy
- friend/block semantics
- Pomodoro shared authority
- task/chat realtime behavior
- RTC grants and revocation
- media authority
- owner baseline/FFA behavior
- migrations/data

## Test strategy

During implementation:

- focused tests first
- visual checks
- targeted multi-client checks

Before accepting a mid-refresh phase:

- relevant feature tests
- architecture tests
- regression suite

At final MID-07:

- full accepted suite

## Mandatory manual scenarios

### Presence
Two separate authenticated users in same room.

Both must see both participants.

### Chat
Second user messages appear even after presence fixes.

### Room cards
Card click enters room; settings action does not.

### Theme
Light/Dark/System all render correctly.

### Ultrawide
Compressed and Full-width both remain proper desktop layouts.

### YouTube
Two clients:
- add URL
- metadata
- one Play
- no loop
- pause
- seek
- late join
- hide/show renderer

### Zoom
Atmosphere quote and controls remain reachable.

### Projector
Hide-all and manual reveal work.

### Accessibility
Keyboard-only navigation must reach all essential actions.

## Reporting

Every phase report should include:

- tests executed
- failures fixed
- remaining known issues
- screenshots where helpful
- explicit deferred scope
