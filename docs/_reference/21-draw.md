# Draw

The commands of the draw dialect, which a [`canvas`](styles.md) shows: `canvas 120x120 [pen primary circle
60x60 50]`. It is Red's draw dialect, a subset of it, drawn as SVG. Points are pairs in the canvas's own space,
from `0x0` at the top left to its size at the bottom right, and the drawing scales with the canvas. Each
command draws with the pen, fill and font in force: they start as the theme's text color, no fill, a line 1
wide and the size of the page's text. Colors are the theme's, so a drawing looks right in light and dark: its
roles `primary`, `accent`, `danger`, `success`, `warning`, `muted`, `text`, `border`, `border-strong` (a line
that must be seen), `surface`, `raised` (the color of a card) and `bg`, or Red's color words. A canvas with `stretch` spreads its points across its width,
and only its points: radii, sizes of ellipses and arcs, widths of lines and text stay what they say.
See [drawings and charts](../ui/10-charts.md).

## pen

The color of lines, outlines and text from here on; `pen off` draws none. A percent after the color draws that
much of it, with what is under it showing through: `pen primary 40%`.

## fill-pen

The color inside the shapes drawn from here on; `fill-pen off` leaves them empty. A line or a curve is never
filled. As with `pen`, `fill-pen primary 14%` lets what is under the shape show through.

## line-width

How wide lines are, in the canvas's units.

## line-cap

How the ends of a line are drawn.

## line-join

How the corners of a line are drawn.

## font

The size of text, and `bold` or `italic`; `plain` takes them away.

## line

A line through two points or more.

## box

A rectangle from its top-left corner to its bottom-right one, with round corners of the given radius.

## triangle

A triangle by its three corners.

## polygon

A closed shape by its corners.

## circle

A circle by its center and radius; with a second radius, an ellipse.

## ellipse

An ellipse inside the box of the given top-left corner and size.

## arc

Part of an ellipse: its center, its two radii as a pair, the angle it starts at and how far it goes, in
degrees, from three o'clock going clockwise. `closed` draws the slice, from the center.

## curve

A curve from the first point to the last, pulled toward the ones between: one for a quadratic curve, two
for a cubic one.

## text

A string, with its top-left corner at the point.

## translate

Moves the rest of the drawing by the offset.

## rotate

Turns the rest of the drawing by the angle, in degrees, around the point given or `0x0`.

## scale

Makes the rest of the drawing bigger or smaller, by x and y; with one number, by it in both.

## push

Draws a block with its own pen, fill, font and transforms, so what it changes ends with it.
