# 5. Dialogs and toasts

Choosing a booking on the whiteboard should open it, to change what was written or to take the bike off the
board when its owner collects it. This page opens a booking in a dialog, confirms what was done with a toast,
and asks before doing something that cannot be undone.

## A dialog

A `dialog` goes in the layout like any other face, but it starts hidden. `open` shows it and `close` hides it
again:

```trebol-ui
view [
    title "Bike shop"
    button "When are you open?" [open hours]
    hours: dialog "Opening hours" [
        text "Monday to Friday, 9:00 to 18:00."
        text "Saturdays, 10:00 to 14:00."
        button "Close" [close hours]
    ]
]
```

The reader can also close it with Esc or with the button in its corner. While it is open, the page behind it
waits: clicks and keys go only to the dialog, and its first field takes the focus.

## Changing a booking

A dialog can hold a form. Choosing a row fills the form with that booking and opens the dialog; saving
writes the form's values back into the booking:

```trebol-ui
bookings: [
    #(customer: "Ada Lovelace" bike: "Road" due: 11-Nov-2026 fault: "The rear brake rubs.")
    #(customer: "Grace Hopper" bike: "City" due: 12-Nov-2026 fault: "A flat front tyre.")
    #(customer: "Alan Turing" bike: "Mountain" due: 10-Nov-2026 fault: "The chain slips in top gear.")
]

view [
    title "In the workshop"
    global table workshop [customer "Customer" bike "Bike" due "Due back"] on-select [
        set-values booking row
        open edit
    ]
    edit: dialog "Change the booking" [
        booking: form [
            field customer "Customer" required
            choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
            date due "Due back" required
            submit "Save" [
                foreach [key value] values [put workshop/selected key value]
                workshop/data: bookings
                close edit
            ]
        ]
    ]
]

workshop/data: bookings
```

`set-values` fills each named field of the form from the key of the same name, and leaves the fields as
untouched, so no error shows until the reader changes something. The table keeps the chosen row as its
`selected`: the very map in `bookings`, not a copy. `foreach` walks the form's `values` key by key and `put`
writes each one into that map, so a key the form does not show, like `fault`, stays as it was. Giving the
table its data again shows the change.

## Toasts

A toast is a short notice at the foot of the screen that goes away by itself. It needs no place in the
layout: `toast` shows one from any handler. `toast/role` gives it a role, which colors it:

```trebol-ui
view [
    title "Notices"
    row [
        button "Plain" [toast "The shop opens at 9:00."]
        button "Success" [toast/role "Booking saved." 'success]
        button "Warning" [toast/role "Ada's bike is due back today." 'warning]
        button "Danger" [toast/role "The card was declined." 'danger]
    ]
]
```

A toast stays four seconds, or six when its role is `danger`, and a click dismisses it sooner. Screen readers
announce it; a `danger` toast interrupts them, the others wait their turn. A toast shows above an open dialog
too, so it can confirm what the dialog did as it closes.

## Asking first

When the owner collects a bike, it comes off the board. Removing a booking cannot be undone, so the screen
asks first, in a small dialog with two answers:

```trebol-ui
bookings: [
    #(customer: "Ada Lovelace" bike: "Road")
    #(customer: "Grace Hopper" bike: "City")
    #(customer: "Alan Turing" bike: "Mountain")
]

view [
    title "In the workshop"
    global table workshop "No bikes in the workshop" [customer "Customer" bike "Bike"] on-select [
        question/text: rejoin ["Has " row/customer " collected the " lowercase copy row/bike " bike?"]
        open collected
    ]
    collected: dialog "Bike collected" [
        question: text ""
        row right [
            button "Not yet" [close collected]
            button primary "Collected" [
                remove find/same bookings workshop/selected
                workshop/data: bookings
                close collected
                toast/role "Taken off the board." 'success
            ]
        ]
    ]
]

workshop/data: bookings
```

`find/same` looks for the very map that was chosen, and `remove` takes it out of `bookings`. The question is
a text face whose `text` the handler sets before opening the dialog, so the same dialog asks about every
bike.

A dialog can also do something when the reader closes it with Esc or its corner button, rather than through
one of its own buttons: `on-close [...]` after the dialog's block runs then. Code that closes it with `close`
does not trigger it.

## What's next

The shop now books bikes in, keeps the board and takes bikes off it, all on one screen. The next page splits
the work into screens of their own, each with its own link, so the counter and the workshop can each keep
theirs open.
