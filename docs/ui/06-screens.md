# 6. Screens and links

The shop has a counter where repairs are booked in and a workshop where the board hangs. Until now both
lived on one screen. This page gives each its own screen, gives every booking a screen of its own, and
gives each screen a link that can be bookmarked, opened in another tab or sent to a colleague.

## Two screens

`screens` holds the screens of the app and shows one at a time. Each screen is a name, a title and a
block with its layout. A `link` with a screen's name goes there:

```trebol-ui
bookings: copy []

view [
    screens [
        counter "Counter" [
            title "Book a repair"
            form [
                field customer "Customer" required
                choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
                submit "Book in" [
                    append bookings values
                    toast/role "Booked in." 'success
                    set-values face/form none
                ]
            ]
            link "See the workshop" 'workshop
        ]
        workshop "Workshop" [
            on-enter [board/data: bookings]
            title "In the workshop"
            table board "No bikes in the workshop" [customer "Customer" bike "Bike"]
            link "Back to the counter" 'counter
        ]
    ]
]
```

Book a bike in, then go to the workshop: it is on the board. The first screen is the one shown when the
app starts.

A screen is built again every time it is entered, from its block, so it starts with empty fields and its
own fresh faces. What must last from one screen to the next lives outside them, like `bookings` here.
`on-enter`, at the top of a screen's block, runs as the screen is entered, with its faces already made:
the place to give a table its rows. The screen shows only once `on-enter` has finished, so the reader never
sees it half filled. If `on-enter` keeps the reader waiting, longer than 300 ms, say for a slow server, the
new screen comes anyway, and what has no data yet (an empty title or text, a table or list with no rows)
shows as gray bars until `on-enter` ends: the reader sees at once where they went and what is coming.

The new screen slides in as the old one slides out, the way the reader went: going to a screen, it comes
from the side ahead; going back, from the side behind, as on a phone. The theme sets how long it takes, and
a reader who asked their system for less motion gets the new screen at once.

## A screen for each booking

A screen can take arguments, named in a block after its title like the arguments of a function. `go`
goes to a screen from code; with a block, the first word is the screen and the rest are its arguments:

```trebol-ui
bookings: [
    #(id: 1 customer: "Ada Lovelace" bike: "Road" fault: "The rear brake rubs.")
    #(id: 2 customer: "Grace Hopper" bike: "City" fault: "A flat front tyre.")
    #(id: 3 customer: "Alan Turing" bike: "Mountain" fault: "The chain slips in top gear.")
]

find-booking: function [id [string!]] [
    foreach b bookings [if id = form b/id [return b]]
    none
]

view [
    screens [
        workshop "Workshop" [
            on-enter [board/data: bookings]
            title "In the workshop"
            table board [customer "Customer" bike "Bike"] on-select [go [booking row/id]]
        ]
        booking "Booking" [id] [
            on-enter [
                either b: find-booking id [
                    crumbs/data: reduce ["Workshop" 'workshop b/customer]
                    who/text: rejoin [b/customer "'s " lowercase copy b/bike " bike"]
                    fault/text: b/fault
                ] [
                    who/text: "No such booking"
                ]
            ]
            crumbs: breadcrumb ["Workshop" workshop "…"] [go value]
            who: title
            fault: text muted
            row [button "Back" [go-back 'workshop]]
        ]
    ]
]
```

Choose a bike: its screen opens. Inside the screen, `id` is the argument it was entered with. Arguments
always arrive as strings, because they travel in the link, so `find-booking` compares `id` with the
booking's id turned into text by `form`. A link can name a booking nobody has, so the screen says so
instead of failing.

The `breadcrumb` shows where the screen sits: pairs of a label and a screen, and a last label for the
screen itself. Choosing a step runs its block with the screen's name in `value`. `go-back` returns to the
screen the reader came from, as the browser's back button would; if they arrived straight at this booking
from a link, there is nothing to go back to, and it goes to the screen it names instead.

## A row that becomes the screen

`morph` ties a face of one screen to a face of the next, so that as the screen changes one becomes the
other. On a table, `morph 'booking` names each row by the word and the booking's id; on the booking's
screen, `morph [booking id]` gives the title the same name, the word as written and the id it was entered
with:

```trebol-ui
bookings: [
    #(id: 1 customer: "Ada Lovelace" bike: "Road")
    #(id: 2 customer: "Grace Hopper" bike: "City")
    #(id: 3 customer: "Alan Turing" bike: "Mountain")
]

view [
    screens [
        workshop "Workshop" [
            on-enter [board/data: bookings]
            title "In the workshop"
            table board morph 'booking [customer "Customer" bike "Bike"] on-select [go [booking row/id]]
        ]
        booking "Booking" [id] [
            on-enter [
                foreach b bookings [if id = form b/id [who/text: b/customer]]
            ]
            who: title morph [booking id]
            row [button "Back" [go-back 'workshop]]
        ]
    ]
]
```

Choose a booking: its row moves up and grows into the title of its screen, and going back it shrinks into
its row again. A face with the same name on both screens is enough, a picture of a product that becomes the
large one, `morph 'photo`, or a button that becomes the dialog-like panel it opens; everything else slides
with its screen.

## Finding with Ctrl+K

Every app has a box that finds things: Ctrl+K opens it (⌘K on a Mac). Typing narrows what it offers: the
screens that need no arguments, and the buttons, links and menu items on show, each with its shortcut if it
has one. Choosing one, with the arrows and Enter or the pointer, goes to the screen or does what the button
does. The app adds what only it can find with `on-find` on the view: `value` is the text typed, and it gives a
label and a link for each thing found, as a breadcrumb's items:

```trebol-ui
bookings: [
    #(id: 1 customer: "Ada Lovelace" bike: "Road")
    #(id: 2 customer: "Grace Hopper" bike: "City")
]

view [
    on-find [
        collect [
            foreach b bookings [
                if find b/customer value [keep b/customer  keep/only reduce ['booking b/id]]
            ]
        ]
    ]
    screens [
        workshop "Workshop" [
            on-enter [board/data: bookings]
            row [title "In the workshop"  button "New booking" key "Ctrl+B" [toast "A new booking"]]
            table board [customer "Customer" bike "Bike"] on-select [go [booking row/id]]
        ]
        settings "Settings" [title "Settings"  row [button "Back" [go-back 'workshop]]]
        booking "Booking" [id] [
            on-enter [foreach b bookings [if id = form b/id [who/text: b/customer]]]
            who: title
            row [button "Back" [go-back 'workshop]]
        ]
    ]
]
```

Click the example, press Ctrl+K and type `gra`: Grace Hopper's booking is there, found by `on-find`, under
what the page itself has. `on-find` may ask a server, as a search does, and the box shows the answer when it
comes.

## The link

Every screen has a link of its own: the workshop is `#/workshop` and Grace's booking `#/booking/2`. The
browser's back and forward buttons move between screens, a `link` can be opened in a new tab, and a link
pasted in the address bar opens that very screen. A link that names no screen opens the first one. Open
the example above on its own to see the link change in the address bar.

The screen's title becomes the page's title, so the browser's tabs and history say where each one leads.
When a screen changes, the focus moves to its title and screen readers announce it.

For buttons of its own, a screen can ask whether there is anywhere to go: `can-go-back?` and
`can-go-forward?` say whether a screen of the app lies behind or ahead, and `go-forward` goes ahead.
`on-change` on `screens` runs after every screen is entered, the place to turn such buttons on and off.

## Leaving with changes not saved

A screen where the user edits something can say so with `unsaved yes`, and `unsaved no` once it is saved.
While it is marked, leaving it asks first, whichever way the user goes: a button that calls `go`, the
browser's back, a link. Closing or reloading the page asks too, in the browser's own words.

```trebol-ui
view [
    screens [
        home "Home" [title "Bookings" link "New booking" 'edit]
        edit "New booking" [
            field name "Name" on-change [unsaved yes]
            button "Save" [unsaved no  toast "Saved"]
            link "Back to the list" 'home
        ]
    ]
]
```

For a question of its own, a screen gives `on-leave` at the top of its block, as `on-enter`. It runs before
the page leaves it, may wait for a dialog, and keeps the screen if it gives `false`:

```trebol-ui
save-booking: does [unsaved no  toast "Saved"]
view [
    screens [
        home "Home" [title "Bookings" link "New booking" 'edit]
        edit "New booking" [
            on-leave [
                either unsaved? [
                    either confirm/with "Save before leaving?" ["Save" "Stay"] [save-booking  true] [false]
                ] [true]
            ]
            field name "Name" on-change [unsaved yes]
            link "Back to the list" 'home
        ]
    ]
]
```

## What's next

The shop's screens look the way Trebol's default look draws them. The [next page](07-themes) changes that: colors,
shapes, fonts and whole looks, from flat and modern to one that recalls a desktop of the nineties, all
without a line of CSS.
