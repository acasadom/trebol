<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Draw

The commands of the draw dialect, which a [`canvas`](styles.md) shows: `canvas 120x120 [pen primary circle
60x60 50]`. It is Red's draw dialect, a subset of it, drawn as SVG. Points are pairs in the canvas's own space,
from `0x0` at the top left to its size at the bottom right, and the drawing scales with the canvas. Each
command draws with the pen, fill and font in force: they start as the theme's text color, no fill, a line 1
wide and the size of the page's text. Colors are the theme's, so a drawing looks right in light and dark.
See [drawings and charts](../ui/10-charts.md).

(draw-pen)=
## pen

Written `pen color`. A color is a role of the theme (`primary`, `accent`, `danger`, `success`, `warning`, `muted`, `text`, `border`, `surface`, `bg`), one of Red's color words (`red`, `maroon`, `orange`, `brown`, `gold`, `yellow`, `olive`, `green`, `teal`, `aqua`, `cyan`, `sky`, `blue`, `navy`, `violet`, `purple`, `magenta`, `pink`, `silver`, `gray`, `black`, `white`), or `off`.

The color of lines, outlines and text from here on; `pen off` draws none.

(draw-fill-pen)=
## fill-pen

Written `fill-pen color`. A color is a role of the theme (`primary`, `accent`, `danger`, `success`, `warning`, `muted`, `text`, `border`, `surface`, `bg`), one of Red's color words (`red`, `maroon`, `orange`, `brown`, `gold`, `yellow`, `olive`, `green`, `teal`, `aqua`, `cyan`, `sky`, `blue`, `navy`, `violet`, `purple`, `magenta`, `pink`, `silver`, `gray`, `black`, `white`), or `off`.

The color inside the shapes drawn from here on; `fill-pen off` leaves them empty. A line or a curve is never
filled.

(draw-line-width)=
## line-width

Written `line-width number`.

How wide lines are, in the canvas's units.

(draw-line-cap)=
## line-cap

Written `line-cap flat | square | round`.

How the ends of a line are drawn.

(draw-line-join)=
## line-join

Written `line-join miter | round | bevel`.

How the corners of a line are drawn.

(draw-font)=
## font

Written `font [size: number bold italic]`.

The size of text, and `bold` or `italic`; `plain` takes them away.

(draw-line)=
## line

Written `line point point ...`.

A line through two points or more.

(draw-box)=
## box

Written `box top-left bottom-right [corner-radius]`.

A rectangle from its top-left corner to its bottom-right one, with round corners of the given radius.

(draw-triangle)=
## triangle

Written `triangle point point point`.

A triangle by its three corners.

(draw-polygon)=
## polygon

Written `polygon point point point ...`.

A closed shape by its corners.

(draw-circle)=
## circle

Written `circle center radius [radius-y]`.

A circle by its center and radius; with a second radius, an ellipse.

(draw-ellipse)=
## ellipse

Written `ellipse top-left size`.

An ellipse inside the box of the given top-left corner and size.

(draw-arc)=
## arc

Written `arc center radius begin sweep [closed]`.

Part of an ellipse: its center, its two radii as a pair, the angle it starts at and how far it goes, in
degrees, from three o'clock going clockwise. `closed` draws the slice, from the center.

(draw-curve)=
## curve

Written `curve start control end, or curve start control control end`.

A curve from the first point to the last, pulled toward the ones between: one for a quadratic curve, two
for a cubic one.

(draw-text)=
## text

Written `text top-left string`.

A string, with its top-left corner at the point.

(draw-translate)=
## translate

Written `translate offset`.

Moves the rest of the drawing by the offset.

(draw-rotate)=
## rotate

Written `rotate angle [center]`.

Turns the rest of the drawing by the angle, in degrees, around the point given or `0x0`.

(draw-scale)=
## scale

Written `scale x y`.

Makes the rest of the drawing bigger or smaller, by x and y; with one number, by it in both.

(draw-push)=
## push

Written `push [commands]`.

Draws a block with its own pen, fill, font and transforms, so what it changes ends with it.
