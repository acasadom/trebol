# 9. Talking to a server

So far the bookings have lived and died with the page: reload it and they are gone. A real workshop keeps
them on a **server**, where every screen that opens finds them. This page fetches the board from one, sends it
the new bookings, and shows what it says when it refuses one.

The examples talk to a small workshop server that lives inside this documentation, so they work as they are.
It answers at three addresses, as a server written for the app would:

| Request | What it does |
| --- | --- |
| `GET /api/bookings` | gives every booking: `id`, `customer`, `bike`, `due` |
| `POST /api/bookings` | keeps a new booking and gives it back with its `id`; refuses one with a reason for each field |
| `DELETE /api/bookings/2` | removes booking 2 |

Each example starts with the same two bookings, and each answer takes a moment, as over a real network.

## Fetching the board

`fetch`, which the first tutorial used to ask a supplier for parts, works the same in an app. JSON comes back
as Trebol values, a list of bookings as a block of maps:

```trebol-ui
view [
    title "Workshop"
    global table board "Loading…" [customer "Customer" bike "Bike" due "Due back"]
]

bookings: fetch "/api/bookings"
foreach b bookings [b/due: to date! b/due]
board/data: bookings
```

The view shows first, so the screen is there at once; while `fetch` waits for the server, the app goes on
answering the person. When the answer comes, the table gets its rows.

JSON has no dates: the server sends the day as text, `"2026-11-11"`, and `to date!` makes it a date again,
which the table shows in the format of the language. On the way out, Trebol does the opposite by itself.

## When the server cannot be reached

A server may be down, or slow, or give an error. For `fetch` all of them are errors, and `try` catches them,
so the app can say so instead of stopping. The second button asks for an address the server does not have:

```trebol-ui
bookings: copy []

load-board: func [address] [
    either error? try [bookings: fetch address] [
        toast/role "The workshop cannot be reached" 'danger
    ] [
        foreach b bookings [b/due: to date! b/due]
        board/data: bookings
    ]
]

view [
    row [
        title "Workshop"
        button #refresh "Refresh" [load-board "/api/bookings"]
        button "Wrong address" [load-board "/api/bookngs"]
    ]
    global table board "Nothing booked yet" [customer "Customer" bike "Bike" due "Due back"]
]

load-board "/api/bookings"
```

## Sending a booking

`fetch/with` and a `body` send the body to the address. A map, like the `values` of a form, goes as JSON, and
the server answers with the booking it kept, now with its `id`:

```trebol-ui
bookings: fetch "/api/bookings"
foreach b bookings [b/due: to date! b/due]

view [
    title "Book a repair"
    form [
        field customer "Customer" required
        choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
        date due "Due back" required
        submit "Book in" [
            either error? try [b: fetch/with "/api/bookings" [body: values]] [
                toast/role "The booking was not sent. Try again." 'danger
            ] [
                b/due: to date! b/due
                append bookings b
                board/data: bookings
                set-values face/form none
                toast/role "Booked in." 'success
            ]
        ]
    ]
    global table board [customer "Customer" bike "Bike" due "Due back"]
]

board/data: bookings
```

The table shows what the server kept, not what was typed: the server has the last word, and the `id` it gave
is what the app uses to name the booking from now on.

## When the server says no

Some rules only the server knows. This workshop is closed on Sundays, and a form cannot know which days a
workshop opens. The server refuses the booking with status 422 and a reason for each field it did not
accept:

```json
{"errors": {"due": "The workshop is closed on Sundays"}}
```

With `full: true`, `fetch` does not turn an answer like that into an error: it gives an object with the
`status`, the `headers` and the `body` of the answer, so the app can read the reasons. `field-error` shows
each under its field, where the person looks, until they change it:

```trebol-ui
view [
    title "Book a repair"
    form [
        field customer "Customer" required
        choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
        date due "Due back" required
        submit "Book in" [
            answer: fetch/with "/api/bookings" [body: values full: true]
            either answer/status = 201 [
                set-values face/form none
                toast/role "Booked in." 'success
            ] [
                foreach [name reason] answer/body/errors [field-error face/form name reason]
            ]
        ]
    ]
]
```

Try a Sunday: 15/11/2026. The form checks what it can by itself, so the person hears about an empty field at
once; the server checks the rest. Each says it in the same place and the same way.

## Removing a booking

A request with `method: 'DELETE` removes the booking whose `id` is in the address. Here a booking is chosen in
the table, and the button removes it from the server first and from the board after:

```trebol-ui
bookings: fetch "/api/bookings"
foreach b bookings [b/due: to date! b/due]

view [
    row [
        title "Workshop"
        global remove-button: button danger #trash "Remove" disabled [
            b: board/selected
            either error? try [fetch/with rejoin ["/api/bookings/" b/id] [method: 'DELETE]] [
                toast/role "The booking was not removed" 'danger
            ] [
                remove find/same bookings b
                board/data: bookings
                remove-button/disabled: true
                toast rejoin [b/customer "'s booking was removed"]
            ]
        ]
    ]
    global table board "Nothing booked yet" [customer "Customer" bike "Bike" due "Due back"]
        on-select [remove-button/disabled: false]
]

board/data: bookings
```

`find/same` finds the very booking that was chosen, not another one that looks like it.

## Where to go from here

The screens of this tutorial are the pieces of a whole app: forms, tables, dialogs, screens with links, a
theme, two languages and a server. `examples/clients` puts them together in a list of
clients that are added, searched, changed and removed on a server. In Trebol's folder, `npm run dev` serves it,
server included, on http://localhost:5173/examples/clients/.
