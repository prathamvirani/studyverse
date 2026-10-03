# MID-02 — Authentication, Onboarding, Account & Device UX

## Objective

Make identity/account flows feel complete, intentional and socially ready.

## Signed-out/auth page

Replace unfinished homepage-like auth page with:

- focused sign-in experience
- minimal signed-out chrome
- Google and Discord provider branding
- `Continue with Google`
- `Continue with Discord`
- polished error/loading states
- full landing page remains deferred

### Google One Tap/FedCM

Where eligible:

- check current server session first
- valid authenticated session → no One Tap
- invalid/stale session → signed-out and eligible
- preserve regular provider buttons
- respect dismissal/cooldown
- never expose HttpOnly cookie to frontend code

Preserve stale-cookie regression fix.

## Post-auth routing

Normal sign-in:

- `/home`

Exceptions:

- validated deep-link/invite returns
- reauth returns to originating security/account flow

No open redirects.

## Username identity model

Separate:

- permanent internal opaque ID
- unique public username
- non-unique display name

Account settings should support username changes under explicit normalization/reserved/rate-limit rules.

Human-facing profile/chat URLs should use username where practical.

## Onboarding coordinator

New signup should trigger a cohesive flow, not a barrage of unrelated modals.

Required:

1. identity / username
2. appearance choice
3. layout choice

Conditional ultrawide prompt should be integrated into onboarding when relevant.

Contextual permissions such as mic/camera/notifications/calendar/passkeys should wait until context exists.

Onboarding must be:

- resumable
- versioned
- safe for existing users

Existing users should be prompted to choose a username rather than receiving a silent public handle.

## Account page

Redesign desktop layout.

Include polished provider rows:

- Google
- Discord
- connected state
- link/reauth actions

### Devices

Show readable summaries:

- OS + version
- browser
- reliable device class only

Allow cosmetic device rename.

Raw user-agent available through expandable detail.

## Account deletion

Add Danger Zone.

Current deletion flow:

- consequences
- step-up provider reauth
- type `DELETE`
- explicit final destructive action
- revoke all sessions/media grants
- clear local state
- defined room/shared-content deletion/anonymization policy

Do not fake 2FA.

## Acceptance

- new user can complete onboarding cleanly
- existing users can migrate to username flow safely
- normal login lands on Home
- provider buttons are branded
- account/device layout is desktop-appropriate
- delete-account flow is explicit/server-authoritative
