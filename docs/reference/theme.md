<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Theme

The words of `theme`, which dresses every screen: `theme 'paper` puts on a look, and
`theme [look: soft base: 20 font: serif]` starts from a look and changes what it names. Colors are worked out
from hues, for light and dark alike, with every text readable on its background. See
[themes and looks](../ui/07-themes.md).

(theme-look)=
## look

Takes `minimal`, `paper`, `civic`, `soft`, `ink`, `classic`, `cupertino`, `fusion`, `fluent`. Without it, `minimal`.

Where to start: a complete set of colors, shapes, fonts, shadows and icons that go together. `classic`,
`cupertino`, `fusion` and `fluent` also build the controls another way. `looks` holds their names in each
language, ready for a menu.

(theme-base)=
## base

Without it, `250`.

The hue of the primary color, from 0 to 360: 20 is orange, 150 green, 250 blue, 330 pink.

(theme-accent)=
## accent

The hue of the accent color, from 0 to 360. Without it, the hue opposite `base`, unless the look has its own.

(theme-neutral)=
## neutral

Takes `cool`, `neutral`, `warm`. Without it, `neutral`.

The tint of the greys: cool, neutral or warm.

(theme-density)=
## density

Takes `compact`, `normal`, `comfortable`. Without it, `normal`.

The room around things.

(theme-radius)=
## radius

Takes `sharp`, `soft`, `round`. Without it, `soft`.

The corners: square, a little rounded, or round.

(theme-font)=
## font

Without it, `inter`.

The font of everything: `inter`, `system`, `sans`, `serif`, `mono`, `noto`, `segoe`, or the name of a font as a
string.

(theme-headings)=
## headings

The font of titles and headings, with the same names as `font`. Without it, the same as `font`.

(theme-mode)=
## mode

Takes `light`, `dark`, `auto`. Without it, `auto`.

Light or dark; `auto` follows what the person chose for their system, and changes when they change it.

(theme-color)=
## color

Without it, `1`.

How much color there is, from 0 (black and white) to 1.

(theme-line)=
## line

Without it, `1`.

The weight of borders: 1 or 2.

(theme-depth)=
## depth

Takes `flat`, `soft`, `lifted`. Without it, `soft`.

Shadows.

(theme-icons)=
## icons

Takes `fine`, `round`, `sharp`, `bold`. Without it, `round`.

How the icons are drawn: the same shapes, with thinner or thicker lines and round or square ends.

(theme-skin)=
## skin

Takes `modern`, `classic`, `cupertino`, `fusion`, `fluent`. Without it, `modern`.

How the controls are built: `modern` is today's flat controls; `classic` recalls the grey windows of the
nineties, `cupertino` the Mac, `fusion` Qt and `fluent` Windows 11.
