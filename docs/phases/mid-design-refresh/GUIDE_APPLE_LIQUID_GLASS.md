# Guide — Apple-Inspired Liquid Glass

## Design intent

Study Space should feel like a native Apple-designed application expressed through the web, while remaining its own product and rendering consistently on Windows/Linux.

This means following Apple-like principles, not cloning a specific Apple app.

## Approved inspiration sources

- Apple Human Interface Guidelines / current Apple UI patterns
- `liquidglassdesign.com`
- `reactbits.dev` for visual/motion ideas only
- `animejs.com` for advanced motion implementation
- `uiball.com` / LDRS for loader inspiration

## Material principles

Use glass selectively:

- navigation
- dock
- settings sheets
- floating productivity cards
- popovers
- media sheet
- room controls

Avoid covering everything in blur.

Glass should have:

- adaptive translucency
- subtle border/highlight
- restrained shadow
- background tint response
- clear foreground contrast
- dark/light variants
- reduced-transparency fallback

## Auto opacity

Default room glass mode should be Auto.

Auto considers:

- theme
- room background luminance/contrast
- content beneath
- text readability

Manual slider remains available.

## Shape language

Prefer:

- soft continuous-feeling corners
- circles for single icon controls
- capsules/ovals for grouped compact controls
- segmented controls for mutually exclusive small option sets
- sheets/popovers for secondary complexity

Avoid:

- every section being a giant rounded rectangle
- equally weighted pill buttons everywhere
- default browser/Windows selects

## Hierarchy

Use:

- spacing
- typography
- material
- subtle tint
- depth

before adding borders.

## Native-feeling behaviors

- contextual popovers
- sheets
- icon-first controls
- hover/focus tooltips
- springy short motion
- immediate-save preferences
- progressive disclosure
- minimal persistent chrome

## Performance

Be conservative with:

- `backdrop-filter`
- animated blur
- multiple overlapping translucent layers

Room may already contain:

- video
- animated background
- screen share
- floating tiles

Use composited effects deliberately.
