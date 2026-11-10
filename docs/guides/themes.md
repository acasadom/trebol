# Themes: a few numbers, every color

## What a theme is

A theme is a handful of parameters: the hue of the primary color, the hue of the accent, how warm the
greys are, how dense and how round things are, the fonts, light or dark, how much color, how thick the
lines, how deep the shadows, how the icons are drawn, and the **skin**. Every color, size and shadow on
screen is derived from those. The dialect accepts only the names of what the theme makes (`primary`,
`muted`, `danger`, `small`, `wide`), never a pixel or a hex color.

A **look** is a set of those parameters that go well together (`paper`, `civic`, `ink`...), and a skin is how
the controls are built: flat and modern, raised and grey like an old desktop, or after the Mac, Qt or
Windows 11. `theme 'civic` picks a look; `theme [look: civic base: 200]` starts from one and changes what you
say.

## How colors are made

Colors are computed in **OKLCH**, a color space where the lightness number means what the eye sees. Each
role (`surface`, `raised`, `border`, `muted`, `text`, `primary`...) has a fixed lightness for light mode and
another for dark; the hue and how much color it carries come from the theme. Dark mode is the same theme
with the other table of lightnesses.

Because the lightness of each role is fixed, the contrast between text and the background it sits on does
not depend on the hue. `theme.ts` has a `contrast()` function, and the tests run it over every hue, every
look and both modes: every text color meets WCAG AA on its background. A theme cannot make text you cannot
read.

## How it reaches the page

The theme is compiled once into CSS custom properties on `:root`, plus a fixed stylesheet for the
components, written against those properties. A skin adds its own rules after the components' and may
change the table of lightnesses and the height of its controls. Switching theme while the app runs only
swaps the properties.

## Why this way — and the alternatives

- **Let apps write CSS.** It is what every web framework allows, and it is how most apps end up
  inconsistent: one more color here, a margin there. Trebol takes the choice away on purpose, so that every
  screen of every app is coherent and accessible; a need that a theme cannot meet is a reason to add a
  parameter, for everyone.
- **A fixed palette per theme**, as most design systems ship: a designer picks every color by hand. It can
  look better than a formula, and every new theme is a designer's work, and dark mode doubles it. Trebol
  derives everything, so any hue makes a complete, accessible theme in both modes.
- **HSL** instead of OKLCH. HSL is in every browser and every tutorial, but its lightness is not what we
  see: a yellow and a blue of the same HSL lightness look nothing alike, so contrast would change with the
  hue. OKLCH keeps it steady.
- **Utility classes**, as Tailwind does: tokens are there, but the app combines them. It is still writing
  style by hand, only shorter. The dialect speaks of roles and intent, and leaves the combining to the theme.
