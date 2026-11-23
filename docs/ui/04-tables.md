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

## Many rows

A table or a list can hold thousands of rows. Past two hundred, it draws only the ones near the screen and
leaves room for the rest, drawing others as the page scrolls, so ten thousand rows open as fast as fifty.
Nothing changes for the program: `data` has every row, and sorting, choosing, moving rows and printing work
on all of them. A row that is not drawn is not found with the browser's search, so a long table is better
with a field to search it.

When `data` changes, the rows move: a new row fades in, a row taken away fades where it stood while the
others close the gap, and rows sorted or moved glide to their places. Trebol knows a row by its `id`, or by
the field `key` names (`table key code`), so give rows one, or a change in the middle looks like a change
at the end. A long table, or a reader who asked their system for less motion, gets the rows at once.

## Groups

Rows can come in groups, each with a title above it and its subtotals below. Between the rows of `data` go
blocks: `[head 1 "Title"]` is a title the width of the table, and `[foot 1 row]` is a row of subtotals, shown
as the totals are. A second level, `2`, is indented under the first:

```trebol-ui
view [
    title "Bikes in, by kind"
    global table workshop [
        customer "Customer" due "Due back" estimate "Estimate"
    ] sortable
]

workshop/data: [
    [head 1 "Road"]
    #(customer: "Ada Lovelace" due: 11-Nov-2026 estimate: $45.50)
    #(customer: "Linus Torvalds" due: 13-Nov-2026 estimate: $30.00)
    [foot 1 #(customer: "2 bikes" estimate: $75.50)]
    [head 1 "Mountain"]
    [head 2 "Electric"]
    #(customer: "Alan Turing" due: 10-Nov-2026 estimate: $112.00)
    [foot 2 #(customer: "1 bike" estimate: $112.00)]
    [head 2 "Other"]
    #(customer: "Grace Hopper" due: 12-Nov-2026 estimate: $28.60)
    #(customer: "Barbara Liskov" due: 9-Nov-2026 estimate: $64.00)
    [foot 2 #(customer: "2 bikes" estimate: $92.60)]
    [foot 1 #(customer: "3 bikes" estimate: $204.60)]
]
```

Titles and subtotals are never chosen and never sorted: sorting the table sorts the rows inside each group,
so every subtotal still adds up. Trebol does not add them up itself, because a page of rows from a server is
not every row of a group; the program, or the server, writes them. A title can be a text per language, as
any text of the interface.

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

## Colour from the data

Some rows matter more than others: a bike that is late, a payment that failed. The row already says so in one of
its fields, and `role-by` paints the row in the role that field names. After a column, it paints only that
column's cell:

```trebol-ui
view [
    global table workshop role-by alert [
        customer "Customer" bike "Bike" state "State" role-by tone
    ]
]

workshop/data: [
    #(customer: "Ada Lovelace" bike: "Road" state: "Ready" tone: success)
    #(customer: "Grace Hopper" bike: "City" state: "Waiting for parts" tone: warning)
    #(customer: "Alan Turing" bike: "Mountain" state: "Two days late" tone: danger alert: danger)
]
```

The roles are those of every face: `success`, `warning`, `danger`, `primary`, `accent` and `muted`. The field
may hold a word or a text, as a server sends it, in any case. A row whose field is missing, `none` or a value
that names no role is drawn as usual: the data is not the layout's, so it is never a problem. Lists, boards and
trees take `role-by` the same way; in a list, a column's role paints its text.

## What happened, and when

The workshop keeps a log: a bike came in, brakes were ordered, a payment failed. A `timeline` shows it the way
people read a log, under the day each thing happened, newest first. It takes rows as a list does; its first
column is the field that says when and its second what happened, and the rest go on a quieter line beneath:

```trebol-ui
log: [
    #(at: 23-Nov-2026/9:30 text: "Bike in for a repair" who: "Ada Lovelace" tone: success)
    #(at: 23-Nov-2026/11:05 text: "Brakes ordered" who: "Grace Hopper")
    #(at: 22-Nov-2026/17:40 text: "Payment failed" who: "Till" tone: danger)
    #(at: "2026-11-20T08:00:00Z" text: "Shop opened for the winter")
]

view [
    timeline [at text who] role-by tone is [log]
    button "A bike came back" [
        append log make map! reduce ['at now 'text "A bike came back" 'who "Desk" 'tone 'accent]
    ]
]
```

The day headings say Today and Yesterday, or the weekday and date, in the language of the page, and they change
by themselves after midnight. A time can be a `date!` or, as a server sends it, a text in ISO form. A date with
a zone is that moment anywhere, said as the clock where the page is read it then, summer time or winter time
(see `local-date`); one without is the time on that clock; one with no time is a whole day, shown without a
time. `role-by` paints each mark and its text, as it paints a list's rows.

A log of what is going on now reads better with `relative`: a time less than a day ago says how long ago it was,
`5 minutes ago`, and keeps saying it as time goes by. A story told from the start takes `oldest`:

```trebol-ui
story: [
    #(at: 1-Mar-2025/10:00 text: "Cog & Chain opens")
    #(at: 23-Nov-2026/9:30 text: "The thousandth repair")
]

view [timeline [at text] oldest relative is [story]]
```

Code that appends to the block shows the new row at once, so a timeline fed by a server's events stays up to
date with nothing more.

## A board

Work that goes through stages reads best as a board: a lane for each stage, and a card for each job in the lane
it has reached. `board` takes the field that names the stage after `by`, then a word and a label for each lane:

```trebol-ui
view [
    global board jobs by status [todo "To do" doing "In the shop" done "Ready"]
        card [title "Job" customer "Customer"]
        on-drop [toast reform [event/row/title "is" event/to]]
]

jobs/data: [
    #(title: "Fix brakes" customer: "Ada Lovelace" status: todo)
    #(title: "True wheel" customer: "Grace Hopper" status: todo)
    #(title: "New chain" customer: "Alan Turing" status: doing)
]
```

Dragging a card to another lane, or choosing *Move to* in its menu (right click, or the Menu key), writes that
lane in its `status` and runs `on-drop`, which sees the row, where it was (`event/from`) and where it went
(`event/to`). The place to tell the server is there; when `on-drop` gives `false` the card goes back to its
lane. Giving the board its `data` again deals the cards again, so a change made elsewhere shows.

When each job has a machine, as in the language tutorial's page on machines, the lanes are its states. A card
moves only where its machine has a way to from where it is, and the drop takes that way:

```trebol-ui
job: [
    initial waiting
    state waiting []
    state doing []
    state done []
    from waiting to doing on start
    from doing to done on finish
    from doing to waiting on stop
]

view [
    global board jobs by step [waiting "To do" doing "In the shop" done "Ready"]
]

jobs/data: reduce [
    make map! reduce ['title "Fix brakes" 'step machine job]
    make map! reduce ['title "New chain" 'step machine job]
]
```

Here *Fix brakes* cannot go straight to *Ready*: it has to be in the shop first.

## Pictures

A column followed by `image` shows each row's picture instead of its text: the field holds the picture's
address, as it comes from the server, or a file. `image round` cuts it to a circle, as for people. A list
puts the picture first, before the row's text; a table shows it in its column, small:

```trebol-ui
customers: [
    #(photo: "ada.svg" name: "Ada Lovelace" bike: "Road")
    #(photo: "grace.svg" name: "Grace Hopper" bike: "City")
]

view [
    global list people [photo image round  name "Name"  bike "Bike"]
    global table shop [photo "" image  name "Name"  bike "Bike"]
]

people/data: customers
shop/data: customers
```

## Adding rows

The rows belong to the program; the table only shows them. To add one, add it to the block the table shows:
the table sees the change and draws the new row.

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
            set-values face/form none
        ]
    ]
    global table workshop "Nothing booked yet" [customer "Customer" bike "Bike" due "Due back"]
]

workshop/data: bookings
```

`values` is a new map every time, ready to keep. `face` is the button that was pressed and `face/form` its
form; `set-values` with `none` empties the form for the next customer. A row changed in its block, with `put`
or by setting a field of an object row, shows at once too, and so does a row taken away with `remove`.

## To and from a spreadsheet

Spreadsheets read and write CSV. `to-csv` writes the rows as CSV text, with a first line of the keys, and
`download` gives the user that text as a file to save. To read rows back, an upload takes the file,
`read-file` gets its bytes and `load-csv/as-records` turns them into a map per row, with the first line
giving the keys:

```trebol-ui
bookings: [
    #(customer: "Ada Lovelace" bike: "Road" due: 11-Nov-2026)
    #(customer: "Grace Hopper" bike: "City" due: 12-Nov-2026)
]

view [
    title "In the workshop"
    global table workshop "No bikes in the workshop" [customer "Customer" bike "Bike" due "Due back"]
    row [
        button "Download" [download %bookings.csv to-csv workshop/data]
        upload sheet "Load a CSV file" accept ["csv"] on-change [
            unless empty? face/value [
                workshop/data: load-csv/as-records read-file face/value/1/file
            ]
        ]
    ]
]

workshop/data: bookings
```

Every field of a CSV file is text. A table shows it as it is, but code that counts or adds converts it
first, as `to integer! row/("Bikes")` or `to date! row/("Due back")`. The keys are strings, the names in the
first line of the file; the table finds them by its column words. `load-csv` reads other delimiters too,
such as `load-csv/with text #";"`.

To keep the board itself for later, not for a spreadsheet, `save %board.trb workshop/data` gives the user a
file of Trebol values, and `load read-file` turns that file back into the same rows, dates and amounts
included.

`to-csv` writes dates as `2026-11-11` and amounts as `45.50`, which every program reads. A file for a person
to open in a spreadsheet in Spanish is better as that person writes them: `to-csv/language rows 'es` gives
`11/11/2026` and `45,50 €`, with semicolons between the fields, as a Spanish spreadsheet expects. The
[reference](../reference/data-formats.md) lists all of it.

## On paper

`print-page` opens the browser's print dialog, where the user prints the screen or saves it as a PDF. With
`/only` it prints one face and what is inside it, such as the board without the buttons around it:

```trebol-ui
view [
    title "In the workshop"
    board: panel [
        heading "Bikes in the workshop"
        global table jobs [customer "Customer" bike "Bike"]
    ]
    row right [button "Print the board" [print-page/only board]]
]

jobs/data: [
    #(customer: "Ada Lovelace" bike: "Road")
    #(customer: "Grace Hopper" bike: "City")
]
```

On paper the page drops what only works on screen: toasts, and dialogs that are not open.

## What's next

Choosing a row should open it, to change the booking or mark the bike as collected. The
[next page](05-dialogs) does that in a dialog, and confirms what was done with a toast.
