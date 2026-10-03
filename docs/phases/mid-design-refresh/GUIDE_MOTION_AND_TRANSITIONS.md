# Guide — Motion & Transitions

## Principle

Motion should communicate:

- hierarchy
- direction
- cause/effect
- continuity
- spatial movement

The goal is:

> “I entered another part of the app.”

not:

> “The DOM changed.”

## Motion tokens

Suggested:

- micro: 120–160 ms
- quick: 180–220 ms
- standard: 240–320 ms
- expressive: 350–500 ms

Easing concepts:

- standard
- enter
- exit
- soft spring
- interactive spring

## Route transitions

Standard route:

1. current page softens/dims
2. glass veil appears
3. critical next frame prepares
4. standardized loader shown for short minimum
5. destination reveals
6. glass recedes

Typical minimum visual duration:

- ~350–600 ms

Do not impose fake 0.5–3 second waits after the page is ready.

## Room entry

Use richer context:

- room background begins spreading/revealing
- resolves into immersive room background

## Local UI

Do not use full route transitions for:

- panels
- tabs
- dropdowns
- Pomodoro
- Tasks
- Chat
- media controls

Use local micro-motion.

## Skip animation

Pomodoro Skip:

- arrow traverses left→right
- wraps
- ~2 loops
- settles

## Drag motion

Cards:

- lift slightly
- snap zones appear
- spring into slot

## Reduced motion

Respect `prefers-reduced-motion`.

Replace expressive motion with:

- opacity
- minimal positional movement
- immediate state where needed
