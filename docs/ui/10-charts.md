# 10. Drawings and charts

Cog & Chain wants its logo on the screen, and the owner wants to see at a glance how the months went. This
page draws both: a picture with Red's draw dialect, and charts made straight from rows, as a table is. Then
it walks through who rides what with an orbit.

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

## As wide as it can be

A canvas with `stretch` is as wide as what holds it and as tall as its extent. Its points spread across that
width, and only its points: lines keep their width, dots stay round and text keeps its size, so a small drawing
can run under a number from one side of a card to the other. A percent after a color draws that much of it,
with what is under it showing through, which makes an area under a line:

```trebol-ui
takings: [820 760 990 1040 930 1240]

line-of: function [numbers] [
    lo: hi: first numbers
    foreach n numbers [lo: min lo n  hi: max hi n]
    step: 100 / ((length? numbers) - 1)
    points: copy []
    repeat i length? numbers [
        y: 28 - to integer! ((pick numbers i) - lo * 24 / (hi - lo))
        append points as-pair i - 1 * step y
    ]
    points
]

points: line-of takings

view [
    panel [
        heading "Takings this week"
        global week: canvas 100x32 stretch []
    ]
]

week/draw: compose [
    pen off fill-pen primary 14%
    polygon (points) 100x32 0x32
    pen primary line-width 2 line-join round fill-pen off
    line (points)
    pen raised fill-pen primary
    circle (last points) 4
]
```

The canvas is 100 units wide, so the six days sit 20 apart, and on a wide card they sit further apart. The
last dot has a ring of `raised`, the color of the card under it, so it stands out from the line. Make the
window narrower and the line follows it.

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

## Over time

When the first column holds moments, `date!` values or texts in ISO form as servers send them
(`"2026-11-16T08:30:00Z"`), the chart puts each point at its moment: two readings an hour apart stand twice as
far as two half an hour apart, and the axis steps by round hours, days, months or years, in the app's language.
The rows can come in any order; the chart draws them oldest first.

A week of the workshop, read every half hour, is more points than have room for a dot each. Then the line has
no dots, and the pointer reads it instead: a rule down the chart at the nearest moment, and its values beside
it. `right-axis` after a column puts that series on its own scale, with its numbers on the right, so bikes and
money share one chart without one flattening the other:

```trebol-ui
readings: copy []
moment: 2026-11-16/0:00
till: $0.00
loop 7 * 48 [
    hour: moment/time/hour
    if moment/time = 0:00 [till: $0.00]
    open?: all [hour >= 8  hour < 19]
    bikes: either open? [3 + (hour - 8 * (19 - hour) / 6)] [0]
    till: till + ($6.50 * bikes)
    append readings make map! reduce ['at moment  'bikes bikes  'takings till]
    moment: moment + 0:30
]

view [
    global chart line week small "The workshop this week" [
        at "When" bikes "Bikes in" takings "Takings today" right-axis
    ]
]
week/data: readings
```

With two scales, the numbers of each side take the color of its series. A small chart has fewer steps up its
side, so its numbers never crowd. Bars go on a time axis too, each at its moment, as wide as the two closest
let them be.

## Numbers that count

A number on its own often says more than a chart: the takings of the day, the bikes still waiting. With
`count`, a text, heading or title whose number changes runs from the old one to the new, so the eye sees
how much it moved:

```trebol-ui
today: make object! [takings: $1240.00]
view [
    panel "Today" [
        title count is [today/takings]
        button "A repair paid" [today/takings: today/takings + $85.50]
    ]
]
```

It runs for about half a second, slowing as it arrives, through numbers of the kind and digits of the one it
ends on, each written in the active language. The number it first shows does not run, nor one that comes when
the user asked the system for less motion: it is there at once. A number, a percent and an amount count; a
text that is no number shows as it is.

A large number in a narrow place, a phone or a column of a grid, would break in two. With `shrink`, a text,
heading or title stays on one line and its letters are as large as its width lets them be, never larger than its
own size: in a wide place it looks as it always does, in a narrow one it is made smaller.

```trebol-ui
view [
    grid 3 [
        title shrink "$1,240.00"
        title shrink "$98,765,432.10"
        title shrink "7"
    ]
]
```

It never goes below about half its size: a line that still does not fit ends in `…`. It works with `count`, so a
number that runs keeps fitting.

A `stat` says what such a number is, puts a line under it, and draws how it got there: the board at the top of
a screen that tells the shop how the day goes.

```trebol-ui
today: make object! [takings: $1240.00 waiting: 7]
view [
    grid 3 [
        stat "Takings" count is [today/takings] "12 repairs today" trend [980 1100 860 1240] success
        stat "Bikes waiting" count is [today/waiting] "2 since yesterday" trend [3 5 4 8 7]
        stat "Late" 3 "of 41 this week" trend [0 1 1 2 3] danger
    ]
    button "A repair paid" [
        today/takings: today/takings + $85.50
        today/waiting: today/waiting - 1
    ]
]
```

Its text says what the number is and a second text is the line under it. `trend` takes the numbers it had,
oldest first, and draws them as a small line ending on a dot; a role colours the number and the line. Each stat
is a card of its own, so a `grid` lines them up, and the trends sit at the foot of each, side by side.

## A face that ticks

Some faces say something that changes with time alone: a clock, how long a bike has been on the stand. With
`rate`, as in R2 and Red, a face ticks — `rate 1` once a second, `rate 0:00:30` every half minute — and each tick
runs its `on-time`:

```trebol-ui
since: now
view [
    panel "On the stand" [
        title "0:00:00" rate 1 on-time [face/text: form to time! round difference now since]
        text muted "since the bike came in"
    ]
]
```

It ticks only while the face is on the page: a screen that leaves takes its ticks with it. `face/rate: none`
stops it, and a new rate starts it again.

## Moving through a graph

Some things are not rows but a web: customers ride bikes, bikes have repairs, repairs need parts. An `orbit`
shows one of them in the middle and what it is linked to around it. Picking a bubble goes there, and the way
back stays to one side:

```trebol-ui
things: [
    shop    "Cog & Chain"    [primary]
    ada     "Ada Lovelace"   [accent]
    grace   "Grace Hopper"   [accent]
    road    "Road bike"      [teal count 2]
    cargo   "Cargo bike"     [teal]
    brake   "Rear brake"     [orange steps 3 at 2]
    chain   "Chain"          [orange]
]
links: [
    shop ada "Customer"  shop grace "Customer"
    ada road "Rides"  grace cargo "Rides"
    road brake "Repair"  road chain "Repair"
]
here: 'shop
trail: copy []

around: function [id] [
    edges: copy []
    near: copy []
    foreach [a b label] links [
        if find reduce [a b] id [
            append edges reduce [a b label]
            append near either a = id [b] [a]
        ]
    ]
    nodes: copy []
    foreach [n title hints] things [
        if find compose [(id) (near) (trail)] n [append nodes reduce [n title hints]]
    ]
    compose/only [focus (id) nodes (nodes) edges (edges) trail (copy trail)]
]

visit: func [id] [
    either p: find trail id [clear p] [append trail here]
    here: id
    graph/data: around here
]

view [
    heading "Who and what"
    global graph: orbit "Workshop" [] [visit value]
]
graph/data: around here
```

The orbit's block says what it shows. `focus` is the node in the middle. `nodes` gives each one an id, a
title and a few hints: a role or a color, `count` for how many it holds (the small moons), `many` for one
that stands for many, `dashed` for a shortcut, and `steps 3 at 2` for a ring of steps with the second the
current one, as the brake's repair is half done. `edges` joins two ids with a label, and `trail` lists where
the person came from.

The orbit never fetches anything. Picking a bubble sets its `value` to the id and runs the action, and the
action gives it a new block; the orbit moves from what it showed to what it is given, so the bubbles that stay
glide to their places and the new ones grow from the one picked. Here the graph is two blocks, but `around`
could just as well be a `fetch`. Picking a node of the trail, or pressing Escape, runs `on-back` if the orbit
has one, and the action otherwise.

Drag to move the view and double-click to centre it again; Ctrl and the wheel zoom. With `fit`, the orbit
takes the height the window has left, and then the wheel alone zooms. Tab goes through the bubbles and Enter
picks one, and a screen reader reads each as a link: "Ada Lovelace, Customer". A test clicks them by their
title, `click "Road bike"`, and `see` finds the titles on show.

## What's next

The app draws now. The [last page](11-testing) makes sure it keeps doing what it does: tests that click, type
and check the screen as a person would, after every change.
