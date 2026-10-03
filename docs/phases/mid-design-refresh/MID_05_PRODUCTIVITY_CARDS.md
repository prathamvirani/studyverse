# MID-05 — Pomodoro, Tasks, Chat & Clock Cards

## Objective

Turn the four productivity cards into compact, elegant, desktop-first tools.

# Pomodoro

## Main card

Use:

- Personal/Shared animated segmented control
- prominent current phase/cycle
- timer
- stop/reset icon left
- play/pause icon right
- animated Skip control between
- completed focus-session tally
- compact settings access

De-emphasize verbose scope copy.

## Skip animation

On Skip:

- arrow travels left→right
- wraps back to left
- loops roughly twice
- returns to rest
- reduced-motion fallback

## Settings

Use glass popover/sheet.

Tabs/segments:

- Focus
- Short Break
- Long Break

Duration edited with up/down arrows around the current value.

Apply immediately; no Save button.

## Timer styles

Visual selectors:

- digital
- flip clock
- progress bar
- gauge
- dot matrix
- pie

## Alerts

User-selectable:

- sound
- preview
- volume
- No Alert

Sound choice is user preference and remains regardless of Personal/Shared timer.

Personal alert runtime:

- fixed duration
- until dismissed

Shared alert runtime:

- owner-authoritative

Add subtle bright vignette/bloom on timer completion.

Respect accessibility.

## Focus tally

Count completed focus blocks.

# Tasks

No separate Add Task flow.

Use inline row:

```text
☐ Add new task…
```

Enter/tick confirms.

Show completed/total count.

Task rows:

- checkbox
- text
- contextual edit/delete/reorder

# Chat

Room Chat:

- Enter sends
- Shift+Enter newline
- integrated composer + send icon
- quieter timestamps
- contextual delete `×` on own hovered/selected message row
- subtle deleted tombstone

Preserve server-authoritative chat behavior.

# Clock

Separate ambient Clock card.

Settings:

- 12h / 24h
- show seconds
- flip
- greeting on/off
- dynamic greeting
- visual clock styles

Use rolling microcopy for dynamic greetings.

## Acceptance

- Personal/Shared state remains correct
- Pomodoro shared authority remains correct
- alerts behave correctly for personal/shared ownership rules
- task/chat behavior remains realtime and persistent as accepted
- clock is local ambient UI unless explicitly specified otherwise
- all cards remain usable at desktop and touch widths
