# 3. Layout

The counter screen has two jobs: booking a bike in, and showing what is already in the workshop. This page
puts both on one screen, side by side where there is room and one above the other where there is not.

## Containers

`view` stacks its faces from top to bottom. A *container* is a face that holds others and arranges them its
own way:

- `row` puts its faces side by side;
- `column` stacks them, like `view`;
- `panel` groups them on a raised card, with a title when it is given a string;
- `grid` lines them up in equal columns, two unless it is told otherwise;
- `form`, from the last page, lines up labels and controls.

Containers nest, so a whole screen is a tree of them:

```trebol-ui
view [
    row spread [
        title "Cog & Chain"
        text muted "Monday, 9 November"
    ]
    grid [
        panel "Book a repair" [
            form [
                field customer "Customer" required
                choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
                date due "Due back" required
                submit "Book in" [toast "Booked in"]
            ]
        ]
        panel "In the workshop" [
            text "Ada Lovelace, road bike, due Wednesday"
            text "Grace Hopper, city bike, due Thursday"
            text muted "Two bikes in, none ready yet."
        ]
    ]
]
```

`grid 3` would make three columns. A block of numbers gives each column a weight instead: `grid [3 2]`
makes the first column three fifths of the width and the second two fifths. A column is never squeezed
narrower than what it holds.

## Lining up

A `row` keeps its faces together at the start. A word after `row` moves them: `center`, `right`, or
`spread`, which pushes the first face to one end, the last to the other and shares the space between the
rest. That is how the title above sits at the left and the date at the right. `fill` on a face makes it
take whatever room is left:

```trebol-ui
view [
    panel "Ada Lovelace" [
        text "Road bike. The rear brake rubs and the chain slips in top gear."
        row [
            field note "Note" "Anything to tell the mechanic" fill
            button "Add"
        ]
        row right [
            button "Call"
            button primary "Ready for collection"
        ]
    ]
]
```

`primary` is a role, as `muted` was on the first page: the one button on a screen that does the main
thing. Use it once per screen, so the eye knows where to go.

Faces of different heights in a row line up at their middle. A row with labelled fields is the exception:
there everything lines up with the controls, so the button sits beside the field's box rather than its
label. `top`, `middle` and `bottom` after `row` choose for yourself.

## On a phone

Open the first example on its own and make the window narrow. Below 640 pixels the grid becomes a single
column, so the workshop list moves under the form, and a row of fields stacks them. The form already had
its labels above its controls in the grid's narrow column: a form decides by its own width, not the
screen's. None of it is written in the view. A screen is laid out once and the theme fits it
to the width it gets.

When a screen does want something different on a phone, `narrow-only` shows a face only on narrow screens
and `wide-only` only on wide ones:

```trebol-ui
view [
    row spread [
        title "Cog & Chain"
        text muted wide-only "Bicycle repairs, Monday to Saturday"
    ]
    text narrow-only "Swipe down for today's bookings."
]
```

## Space

The theme sets the space between faces and inside panels, and most screens never change it. When one
needs to, `gap` sets the space between a container's faces and `pad` the space inside it, each as a step
of the theme's scale from 0 to 7: `panel gap 1 [...]` packs a panel tight, `row gap 6 [...]` spreads a row
out. `gap none` and `pad none` are 0, `gap wide` and `pad wide` are 6.

## What's next

The workshop list above is three lines of text written by hand. The next page makes it a
table of the shop's real bookings: columns, sorting, totals, and choosing a row to work on.
