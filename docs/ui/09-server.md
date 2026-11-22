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

## A file from the server

Some files only the server can make, like a report as a PDF. `download` takes the answer of
`fetch/with [... full: true]` and gives the user its body as a file, without leaving the page. What is asked
goes in the body of a POST, so it shows neither in the address nor in the server's logs:

```
answer: fetch/with "/api/reports" [method: 'POST body: #(year: 2026) full: true]
either answer/status < 400 [
    download %report.pdf answer
] [
    toast/role "The report could not be made" 'danger
]
```

The name comes from the server, when its answer says one in `content-disposition` (accents too); otherwise
it is the one given, here `report.pdf`. `download` gives back the name the file was saved under. An answer
with a status of 400 or more is an error, so the app looks at the status first, as above.

## How far it went

A photo of the bike, or a long report, takes a while to go up or come down. `progress:` shows how far the
request went. Given an upload field, its own bar fills as the files go up and goes away when they are there;
given a `progress` face, that bar fills; given a block, the block runs as the bytes go, with `done` and `total`
set:

```trebol-ui
view [
    title "Bike photos"
    global upload photos "Photos of the bike" multiple accept ["image/*"]
    row right [
        button primary "Send" [
            fetch/with "/api/photos" [
                multipart: collect [foreach file photos/value [keep reduce ['photo file/file]]]
                progress: photos
            ]
            toast/role "The photos are with the shop." 'success
        ]
    ]
]
```

A `photo` field sends the same way, and its bar fills too. Its value is an object only when the person chose
a new image; otherwise it is the address the server already has, or `none`. In the submit of a form with
`pic: photo picture "Photo"`:

```trebol
; docs-test: skip
if object? values/picture [
    fetch/with "/api/customers/42/picture" [multipart: reduce ['picture values/picture/file] progress: pic]
]
```

With a body, the count is first of the bytes sent and then of the bytes received; without one, of the bytes
received. `total` is `none` when the server does not say how many bytes come, and then a progress face moves
without saying how far. The block runs at most ten times a second, and always once at the end, when `total`
is known: `done` and `total` are then the bytes that came.

## Answers kept

A board many people change wants to show at once what it had, and the latest a moment later. `cached` gives
the last answer it got for an address, at once, and asks the server again behind; `is` puts it in the table,
and when the new answer comes the table follows by itself:

```trebol-ui
view [
    title "Workshop"
    table is [cached "/api/bookings"] [customer "Customer" bike "Bike" due "Due back"]
    text muted is [either b: cached "/api/bookings" [rejoin [length? b " bookings"]] ["Loading…"]]
    button "Refresh" [refresh "/api/bookings"]
]
```

The first time there is no answer yet, `none`, and the table shows empty for a moment. After that, coming
back to the screen shows the board as it was, and asks again. It also asks again when the reader comes back
to the tab from another one, and after the app sends a booking or removes one (a `fetch` with `'POST`,
`'PUT`, `'PATCH` or `'DELETE` to `/api/bookings` or an address under it). `refresh` asks now, for a button.

## News from the server

`cached` asks again when the reader does something; a board on the wall of the workshop wants to follow by
itself, when a mechanic on another screen books a repair. The server says so on a stream of events, and the
board asks again for what it shows:

```
news: open-events "/api/events"
on-message news [refresh "/api/bookings"]
on-open news [if reconnected [refresh "/api/bookings"]]

view [
    title "Workshop"
    table is [cached "/api/bookings"] [customer "Customer" bike "Bike" due "Due back"]
]
```

The server sends an event each time the bookings change, and every face that reads `cached "/api/bookings"`
follows. A stream that drops, because the server restarted or the network went away for a moment, opens again
by itself and goes on with the same handlers; `on-open` runs again then, with `reconnected` true, and the
board asks for what it may have missed. An event's `event` field comes as the word `event`, so one stream can
carry news of many kinds: `if event = 'booking [...]`. The cookie of the login goes with the stream, as with
`fetch`; `open-events/with` takes `headers` for a server that wants another sign, and the other options in
the [reference](../reference/network.md).

## What's next

The bookings live on a server now. The next page draws: the shop's logo, and its takings as charts.
