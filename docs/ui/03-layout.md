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
narrower than what it holds, except in a grid with `fit`, where what it holds scrolls inside it. The words `small`, `medium` and `large` give a column a fixed width the theme sets,
and the numbers share what is left: `grid fit [small 1 medium]` is a desktop app, with a narrow list on the left,
the work in the middle and a pane on the right.

With `resize`, the user sets the widths: a handle in the gap between two columns, dragged or moved with
the arrow keys, makes the column of a set width wider or narrower, and a double click gives it back the
width the theme sets. The browser keeps what the user chose, so the workshop opens with its list as wide
as they left it:

```trebol-ui
view [
    grid [small 1] resize [
        panel "Bikes in" [
            text "Ada Lovelace, road bike"
            text "Grace Hopper, city bike"
        ]
        panel "Road bike" [
            text "The rear brake rubs and the chain slips in top gear."
        ]
    ]
]
```

The words before a view's first face are the view's own, read as those after a style are a face's:
`view [width fill ...]` makes the page as wide as the window, and `on-key [...]` there gets the keys no face
handles. A word the view does not take is a problem `trebol check` names, as for any face. A screen's block
starts the same way, with its `on-enter` and `on-leave`.

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
to the width it gets: the width of the page, or of the device it is shown in.

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

A `device` shows a screen as it is on another one, at that size, made smaller when it does not fit its place.
It takes the size of its screen, `phone` (390 by 844), `tablet` (834 by 1112), `desktop` (1280 by 800) or a
pair such as `360x740`, and the faces of that screen. Narrow is the width of the device's screen, so the same
faces side by side show both ways:

```trebol-ui
view [
    width fill
    grid [1 2] [
        device phone [
            heading "Bookings"
            text narrow-only "On a phone"
            grid 2 [field "Name" field "Bike"]
        ]
        device tablet [
            heading "Bookings"
            text wide-only "On a tablet"
            grid 2 [field "Name" field "Bike"]
        ]
    ]
]
```

What only the device itself can do stays the device's: a finger, the bigger controls a touch screen gets, and
the menus and notices a page opens over everything, which open over the page.

## Space

The theme sets the space between faces and inside panels, and most screens never change it. When one
needs to, `gap` sets the space between a container's faces and `pad` the space inside it, each as a step
of the theme's scale from 0 to 7: `panel gap 1 [...]` packs a panel tight, `row gap 6 [...]` spreads a row
out. `gap none` and `pad none` are 0, `gap wide` and `pad wide` are 6.

## An image behind

`backdrop` puts an image behind the faces of its container. It takes no place among them: in a `panel` it
covers the panel, and in the `view` or a screen it covers the whole window, as on a sign-in page:

```trebol-ui
view [
    width small
    backdrop %workshop.svg
    title "Cog & Chain"
    text "Repairs and bookings."
    panel "Sign in" [
        form [
            field email "Email" email required
            password secret "Password" required
            submit "Sign in" [toast "Welcome back"]
        ]
    ]
]
```

You never have to choose an image that suits the text. The theme lays a veil of the page's color over it,
just as strong as it takes for text on it to read well on any image, in light and dark.

An `image` among the faces is a picture in its own place instead: `image %logo.svg "Cog & Chain" 48x48`
gives its size, which it fills, cut to fit, and `round` cuts it to a circle, as for a person's photo.

## Video and sound

`video` and `audio` play with the browser's own controls, which already work with the keyboard, on a phone
and in full screen. A video can show an image before it plays and captions as it does, one file per
language; the captions shown follow the language of the page:

```trebol-ui
view [
    video %workshop.webm "The workshop" poster %workshop.svg captions [en %workshop-en.vtt es %workshop-es.vtt]
        on-end [toast "Thanks for watching"]
    row [
        text "When a bike is ready, the counter hears:"
        audio %ready.m4a "Your bike is ready" small
    ]
]
```

`loop` starts it again when it ends, `muted` plays it without sound until the person turns it on, and
`autoplay` plays it as soon as it can, always without sound, since browsers let nothing else play on its own.
`on-end` runs when it ends.

## Faces made from data

So far every face was written in the layout. When how many there are comes from data, a list of bikes the
server sends, code writes the block of the dialect and lays it out. `layout/only` turns a block into its faces,
without a view around them, and a container shows whatever faces its `pane` holds:

```trebol-ui
bikes: [
    ["Road bike" "Brakes rub" warning]
    ["City bike" "New chain" success]
]
card: func [bike] [compose/deep [panel (bike/1) [text (bike/2) (bike/3)]]]
view [
    width small
    button "Bike in" [
        append in-shop/pane layout/only card ["Cargo bike" "Flat tyre" danger]
    ]
    global in-shop: grid []
]
in-shop/pane: layout/only collect [foreach b bikes [keep card b]]
```

```trebol-test
"the bikes come from the data, and the button adds one"
[see "Road bike"  see "New chain"  see/not "Cargo bike"]
[click "Bike in"  see "Cargo bike"  see "Flat tyre"]
```

`compose` puts the bike's values in the block: the dialect sees them as if they had been written there. Giving a
container a new block of faces draws them in place of the old ones, and so do `append`, `insert`, `remove` or
`clear` on the block it holds. The faces put in this way belong to the screen as those written in it do: a
field put in a form is one of its values and its checks show, and the theme, the phone and the tests treat
them all alike. The names given inside a block are local to that `layout`, as in any other; `global` names a
face the rest of the app reaches.

## One after another

Some things come in order: the steps of a repair, what happened to a bike. A `column` with `rail` puts its children
down a line, each with a mark on it, and the role of a child paints its mark:

```trebol-ui
view [
    width small
    column rail [
        column success [text "Booked in"  text muted small "Monday, by Ada"]
        column success [text "Brakes ordered"  text muted small "Tuesday"]
        column primary [text "On the stand"  text muted small "now"]
        column [text muted "Ready to collect"]
    ]
]
```

A screen reader hears it as a list, each child an item of it.

## A face in JavaScript

Sooner or later a screen needs something Trebol does not draw: a map, a code editor, a library someone else
wrote. The web's way to package one is a custom element, and `widget` makes any of them a face. Here the
workshop asks how a repair went, with `<star-rating>`, an element of some fifty lines of JavaScript that
draws five stars:

```trebol-ui
import %star-rating.js
view [
    width small
    panel "How did we do?" [
        form [
            widget <star-rating> stars "Your repair" required
                on-delight [toast event/detail]
            area comment "Anything to tell us?"
            submit "Send" [toast reform ["Thanks for the" values/stars "stars"]]
        ]
    ]
]
```

`import` of a `.js` file runs it, and the file defines the element. The tag names the element and comes before
the face's name; a block after it sets the element's properties, as `widget <geo-map> place [zoom: 12]`.

The face's value is the element's `value` property, both ways: Trebol sets it, and when the element sends a
`change` event Trebol reads it back and runs `on-change`. With a name, the widget is a field of its form like
any other: it is sent with the rest, and `required` and the rules check it. Any other event the element sends
reaches the `on-` word of the same name with what it carries in `event/detail`: the element above sends
`delight` for five stars.

What the element needs to do is little, and it is the web's own way, not Trebol's:

```text
class StarRating extends HTMLElement {
  get value() { ... }                        // what the face's value is
  set value(v) { ... }                       // Trebol sets it
  ... this.dispatchEvent(new Event('change'))                       // the person changed it
  ... this.dispatchEvent(new CustomEvent('delight', { detail: 'five stars' }))
}
customElements.define('star-rating', StarRating);
```

Values cross as JSON does, so text, numbers, blocks and maps keep their shape. The theme's colors reach the
element as CSS custom properties (`var(--tb-primary)`, `var(--tb-text)`, `var(--tb-border)`...), so it can
look like the rest of the screen, in light and dark.

## What's next

The workshop list above is three lines of text written by hand. The [next page](04-tables) makes it a
table of the shop's real bookings: columns, sorting, totals, and choosing a row to work on.
