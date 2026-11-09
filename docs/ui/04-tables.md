# 4. Tables and lists

The workshop has a whiteboard: every bike in, whose it is, when it is due back and roughly what it will
cost. This page puts the whiteboard on the screen, as a table the shop can sort, total and pick from.

## A table

A table shows a block of rows. Each row is a map, as in the first tutorial, and the table's block says
which of its keys are columns, each followed by the header to show:

```trebol-ui
bookings: [
    #(customer: "Ada Lovelace" bike: "Road" due: 11-Nov-2026 estimate: $45.50)
    #(customer: "Grace Hopper" bike: "City" due: 12-Nov-2026 estimate: $28.60)
    #(customer: "Alan Turing" bike: "Mountain" due: 10-Nov-2026 estimate: $112.00)
]

view [
    title "In the workshop"
    global table workshop "No bikes in the workshop" [
        customer "Customer" bike "Bike" due "Due back" estimate "Estimate"
    ]
]

workshop/data: bookings
```

The word after `table` names it, like a set-word, and `global` makes the name reach code outside the view:
the last line, which gives the table its rows through its `data`. The string is what the table says when it
has no rows at all.

Every cell shows its value the way its type should look. The dates and amounts above were not formatted by
hand: they follow the app's language, which a later page changes. A row's other keys stay in the row
without a column; a phone number, say, can travel with a booking and never be shown.

On a phone a table turns each row into a card, with the headers as labels. Open the example on its own and
make the window narrow to see it.

## Sorting and totals

A table only sorts when it says so. `sortable` lets the reader sort by any column by pressing its header,
and `sorted` gives the order to start with. A table's `totals` is one more row, shown at its foot and never
sorted with the others:

```trebol-ui
bookings: [
    #(customer: "Ada Lovelace" bike: "Road" due: 11-Nov-2026 estimate: $45.50)
    #(customer: "Grace Hopper" bike: "City" due: 12-Nov-2026 estimate: $28.60)
    #(customer: "Alan Turing" bike: "Mountain" due: 10-Nov-2026 estimate: $112.00)
]

view [
    title "In the workshop"
    global table workshop [
        customer "Customer" bike "Bike" due "Due back" estimate "Estimate"
    ] sortable sorted [due asc]
]

total: $0
foreach booking bookings [total: total + booking/estimate]
workshop/data: bookings
workshop/totals: make map! reduce ['customer "Total" 'estimate total]
```

Dates sort as dates and amounts as amounts, not as the text they show. Sorting changes only what the table
shows: `bookings` keeps its order. `sortable` is for a table that has all its rows; one that shows a page
of thousands asks the server for them in order instead, with `on-sort`.

## Choosing a row

With `on-select`, the rows can be chosen with a click, or from the keyboard with Enter or Space. The handler finds
the row it was given in `row`:

```trebol-ui
bookings: [
    #(customer: "Ada Lovelace" bike: "Road" fault: "The rear brake rubs." due: 11-Nov-2026)
    #(customer: "Grace Hopper" bike: "City" fault: "A flat front tyre." due: 12-Nov-2026)
    #(customer: "Alan Turing" bike: "Mountain" fault: "The chain slips in top gear." due: 10-Nov-2026)
]

view [
    title "In the workshop"
    global table workshop [customer "Customer" bike "Bike" due "Due back"] on-select [
        details/text: rejoin [row/customer "'s " lowercase copy row/bike " bike. " row/fault]
    ]
    details: text muted "Choose a bike to see what is wrong with it."
]

workshop/data: bookings
```

`fault` has no column, but the row still carries it, so the handler can show it. The table also keeps the
chosen row as its `selected`, for code that runs later.

## Lists

Where a table has room for every column, a `list` shows the first one large and the rest on a quieter line
beneath. It takes the same block of columns and the same rows:

```trebol-ui
bookings: [
    #(customer: "Ada Lovelace" bike: "Road" due: 11-Nov-2026)
    #(customer: "Grace Hopper" bike: "City" due: 12-Nov-2026)
]

view [
    global list workshop [customer bike "Bike" due "Due back"]
]

workshop/data: bookings
```

A list suits a narrow column beside a form, or a phone; a table suits the screen where the rows are the
work.

## Adding rows

The rows belong to the program; the table only shows them. To add one, add it to the block and give the
table its data again, so it shows the new state:

```trebol-ui
bookings: copy []

view [
    title "Book a repair"
    form [
        field customer "Customer" required
        choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
        date due "Due back" required
        submit "Book in" [
            append bookings values
            workshop/data: bookings
            set-values face/form none
        ]
    ]
    table workshop "Nothing booked yet" [customer "Customer" bike "Bike" due "Due back"]
]
```

`values` is a new map every time, ready to keep. `face` is the button that was pressed and `face/form` its
form; `set-values` with `none` empties the form for the next customer. The table needs no `global` here: the
handler that uses its name is inside the same view.

## What's next

Choosing a row should open it, to change the booking or mark the bike as collected. The
[next page](05-dialogs) does that in a dialog, and confirms what was done with a toast.
