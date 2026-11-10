# 10. Drawings and charts

Cog & Chain wants its logo on the screen, and the owner wants to see at a glance how the months went. This
page draws both: a picture with Red's draw dialect, and charts made straight from rows, as a table is.

## A drawing

A `canvas` takes the size of its drawing space and a block of drawing commands. The commands are Red's: a
`pen` for lines, a `fill-pen` for what is inside, then the shapes, each placed by pairs:

```trebol-ui
view [
    row [
        canvas 96x96 "Cog & Chain" [
            pen primary line-width 6 fill-pen off
            circle 48x48 38
            line-width 3
            line 48x10 48x86 line 10x48 86x48
            line 21x21 75x75 line 75x21 21x75
            fill-pen primary circle 48x48 10
        ]
        title "Cog & Chain"
    ]
]
```

The canvas is 96 units square, from `0x0` at the top left. The drawing scales with the canvas, so on a
smaller screen it is smaller, and never blurred: it is drawn as lines, not pixels.

Colors are not numbers. A drawing uses the roles of the theme, `primary`, `accent`, `danger`, `muted`, `text`,
or Red's color words, `red`, `orange`, `teal`, `navy` and the rest, which the theme makes a little lighter in
dark mode so they still stand out. Switch the documentation to dark and the logo follows.

The string is the drawing's name for a screen reader. A canvas without one is taken as decoration.

## Drawing from data

A drawing is a block, so code can build it. This one draws a bar for each day's bikes, and a `push` keeps the
label's pen from leaking into the next bar. `compose/deep` fills in the parens inside the `push` too:

```trebol-ui
bikes: [6 9 4 11 8]
days: ["Mon" "Tue" "Wed" "Thu" "Fri"]

bars: copy [fill-pen accent pen off]
repeat i length? bikes [
    x: 10 + (i - 1 * 40)
    h: 10 * pick bikes i
    append bars compose/deep [
        box (as-pair x 120 - h) (as-pair x + 28 120) 3
        push [pen muted text (as-pair x 126) (pick days i)]
    ]
]

view [
    heading "Bikes in this week"
    global week: canvas 210x150 []
]

week/draw: bars
```

The canvas starts empty, and setting its `draw` draws it: every time it is set, so `every` and a new block
animate it. (In the dialect, a word after `canvas` would be read as a word of the dialect, not as the value
it holds; `compose` is the other way to put a block in.)

## A chart

Most of the time, though, the numbers are already rows, and a chart reads them directly. Its block is a
table's: the first column names each point, and every other column is a series:

```trebol-ui
view [
    global chart bar income "Takings by month" [month "Month" repairs "Repairs" parts "Parts"]
]

income/data: [
    #(month: "Jul" repairs: $1200.00 parts: $340.00)
    #(month: "Aug" repairs: $1450.00 parts: $410.00)
    #(month: "Sep" repairs: $1620.00 parts: $380.00)
    #(month: "Oct" repairs: $1380.00 parts: $520.00)
]
```

Amounts show as money on the axis and in each bar's tooltip, as they would in a table. The series take the
theme's primary and accent colors, then Red's colors in turn, and a legend names them. The chart is drawn at
the width it has, and again when that changes, so its text is always the size of the page's.

`stacked` puts the series on top of each other, so each bar is the month's total:

```trebol-ui
view [
    global chart bar income stacked "Takings by month" [month "Month" repairs "Repairs" parts "Parts"]
]

income/data: [
    #(month: "Jul" repairs: $1200.00 parts: $340.00)
    #(month: "Aug" repairs: $1450.00 parts: $410.00)
    #(month: "Sep" repairs: $1620.00 parts: $380.00)
    #(month: "Oct" repairs: $1380.00 parts: $520.00)
]
```

## Lines, areas and pies

The kind is the word after `chart`: `bar`, `line`, `area` or `pie`. `small`, `medium` and `large` set the
height, and a `grid` puts two side by side:

```trebol-ui
view [
    grid 2 [
        global chart line visits small "Bikes in" [day "Day" bikes "Bikes"]
        global chart pie jobs small "Jobs" [job "Job" count "Count"]
    ]
]

visits/data: [
    #(day: "Mon" bikes: 6) #(day: "Tue" bikes: 9) #(day: "Wed" bikes: 4)
    #(day: "Thu" bikes: 11) #(day: "Fri" bikes: 8)
]
jobs/data: [
    #(job: "Brakes" count: 14) #(job: "Chains" count: 9) #(job: "Wheels" count: 6) #(job: "Other" count: 3)
]
```

A pie shows the first series, a slice for each label, and its tooltip gives each slice's share. A screen
reader reads every chart as a table of the same numbers. A chart with no rows says so, in the app's language.

`chart/data: rows` draws it again, so a chart that follows a server is a `fetch` and an assignment, as the
workshop board was on the last page.

## Where to go from here

The screens of this tutorial are the pieces of a whole app: forms, tables, dialogs, screens with links, a
theme, two languages and a server. `examples/clients` puts them together in a list of
clients that are added, searched, changed and removed on a server. In Trebol's folder, `npm run dev` serves it,
server included, on http://localhost:5173/examples/clients/.
