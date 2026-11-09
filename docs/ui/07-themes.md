# 7. Themes and looks

Nothing so far has said what color a button is, how round a panel's corners are or which font the titles use.
Those come from the **theme**, and the theme is a handful of words: a hue, a shape, a density. Trebol works
out every color and size from them, in light and dark, with text that stays readable. This page dresses the
shop's screens in different clothes without touching their layout.

## Looks

A **look** is a complete set of choices that go together: colors, corners, fonts, shadows, the weight of
lines and how icons are drawn. `theme` with a look's name puts it on:

```trebol-ui
theme 'paper

view [
    title "Book a repair"
    form [
        field customer "Customer" required
        choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
        date due "Due back"
        submit "Book in" [toast/role "Booked in." 'success]
    ]
]
```

`minimal` is the look every app starts with. `paper` is warm, with serif titles and no shadows; `civic` is an
institutional blue with square corners and firm lines; `soft` is rounded and roomy; `ink` is black and white.
What warns or confirms keeps its color in every look, `ink` included, so a danger button is still red.

## Looks that change the controls

Some looks go further than colors and shapes: they build the controls another way, recalling the desktops
people already know. `classic` recalls the grey windows of the nineties, with buttons in relief; `cupertino`
recalls the Mac, `fusion` Qt on Linux, and `fluent` Windows 11. Try them on the same screen with the menu:

```trebol-ui
view [
    row [
        title "Book a repair"
        button #settings "Look" menu [
            "Minimal" minimal "Paper" paper "Civic" civic "Soft" soft "Ink" ink
            ---
            "Classic" classic "Cupertino" cupertino "Fusion" fusion "Fluent" fluent
        ] on-menu [theme event/picked]
    ]
    form [
        field customer "Customer" required
        choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
        date due "Due back"
        toggle urgent "Urgent"
        submit "Book in" [toast/role "Booked in." 'success]
    ]
    global table board [customer "Customer" bike "Bike" due "Due back"]
]

board/data: [
    #(customer: "Ada Lovelace" bike: "Road" due: 11-Nov-2026)
    #(customer: "Grace Hopper" bike: "City" due: 12-Nov-2026)
]
```

`theme` can be called at any time, and the whole screen changes at once. `looks` holds the looks with their
names in each language, ready to be the items of a menu.

## Your own theme

A look is only a starting point. `theme` with a block takes a look and changes what it names, or starts
from `minimal` when it names none:

```trebol-ui
theme [look: soft base: 20 font: serif]

view [
    title "Book a repair"
    form [
        field customer "Customer" required
        choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
        submit "Book in" [toast/role "Booked in." 'success]
    ]
]
```

These are the words a theme takes:

| Word | What it sets | Values |
| --- | --- | --- |
| `look` | where to start | `minimal`, `paper`, `civic`, `soft`, `ink`, `classic`, `cupertino`, `fusion`, `fluent` |
| `base` | the hue of the primary color | 0 to 360: 20 orange, 150 green, 250 blue, 330 pink |
| `accent` | the hue of the accent color | 0 to 360; opposite `base` when not given |
| `color` | how much color there is | 0 (black and white) to 1 |
| `neutral` | the tint of the greys | `cool`, `neutral`, `warm` |
| `mode` | light or dark | `light`, `dark`, `auto` (follows the system) |
| `density` | the room around things | `compact`, `normal`, `comfortable` |
| `radius` | corners | `sharp`, `soft`, `round` |
| `font` | the font of everything | `inter`, `system`, `sans`, `serif`, `mono`, `noto`, `segoe`, or a font's name as a string |
| `headings` | the font of titles | the same names as `font` |
| `line` | the weight of borders | 1 or 2 |
| `depth` | shadows | `flat`, `soft`, `lifted` |
| `icons` | how icons are drawn | `fine`, `round`, `sharp`, `bold` |
| `skin` | how controls are built | `modern`, `classic`, `cupertino`, `fusion`, `fluent` |

The colors are worked out from `base`, `accent` and `neutral` for light and dark alike, and every text and
background they give is checked to be readable (the AA level of the WCAG, the web's accessibility guidelines), for
every hue. That is why a theme takes a hue and not a color: any hue gives a theme that works.

## Light and dark

`mode: auto`, the default, follows the light or dark the reader chose for their system, and changes the
moment they change it. The examples in this documentation follow its own switch instead: change it at the
top of the page and they change with it. `mode: light` or `mode: dark` fixes one.

## What's next

The shop's screens speak English. The next page makes them speak Spanish too, dates and amounts included,
and switch from one to the other while they run.
