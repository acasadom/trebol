# Theme

The words of `theme`, which dresses every screen: `theme 'paper` puts on a look, and
`theme [look: soft base: 20 font: serif]` starts from a look and changes what it names. Colors are worked out
from hues, for light and dark alike, with every text readable on its background. See
[themes and looks](../ui/07-themes.md).

## look

Where to start: a complete set of colors, shapes, fonts, shadows and icons that go together. `classic`,
`cupertino`, `fusion` and `fluent` also build the controls another way. `looks` holds their names in each
language, ready for a menu.

## base

The hue of the primary color, from 0 to 360: 20 is orange, 150 green, 250 blue, 330 pink.

## accent

The hue of the accent color, from 0 to 360. Without it, the hue opposite `base`, unless the look has its own.

## neutral

The tint of the greys: cool, neutral or warm.

## density

The room around things.

## radius

The corners: square, a little rounded, or round.

## font

The font of everything: `inter`, `system`, `sans`, `serif`, `mono`, `noto`, `segoe`, or the name of a font as a
string.

## headings

The font of titles and headings, with the same names as `font`. Without it, the same as `font`.

## mode

Light or dark; `auto` follows what the person chose for their system, and changes when they change it.

## color

How much color there is, from 0 (black and white) to 1.

## line

The weight of borders: 1 or 2.

## depth

Shadows.

## icons

How the icons are drawn: the same shapes, with thinner or thicker lines and round or square ends.

## skin

How the controls are built: `modern` is today's flat controls; `classic` recalls the grey windows of the
nineties, `cupertino` the Mac, `fusion` Qt and `fluent` Windows 11.
