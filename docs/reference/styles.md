<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Styles

The styles of the UI dialect: the kinds of thing a layout is made of. A layout names a style and follows it with
what that face needs, in any order: a label for the code (`total:` before the style), a field name (the first
word after an input style), texts (a string, a text per language, or a quoted word of the dictionary), an icon
(`#search`), words of the dialect (see [the words of the dialect](dialect.md)), and blocks: the children of a
container, the items of a choice or a menu, and the action, the block at the end. `stylize` makes a style of
your own from one of these. See [building screens](../ui/01-first-screen.md).

The options a face is written with, by the names the styles below give them, and what each is.
Every face takes `label`, `global`, `text`, `hint`, `icon`, `role`, `size`, `align`, `fill`, `fit`, `hidden`, `disabled`, `inert`, `narrow-only`, `wide-only`, `drag`, `drop`, `reorder`, `menu`, `morph`, `action`, `react`, `is`, `on-over`, `on-dbl-click`, `on-key`, `on-focus`, `on-unfocus`, `on-menu`, `on-select`, `on-drop`, `on-reorder`; each style says what else it takes, and an option its style does not take is a problem of the layout.

- `label`: the word that names the face in the code: total: text
- `global`: the label is a word of the program, not of the screen
- `name`: the field's name: the key of its value in values
- `text`: what it says: a label, a title, a caption
- `hint`: the second text: what an empty field shows
- `icon`: an icon before the text
- `value`: what it shows: an image, a sound, a video, a percent, the screen a link goes to
- `role`: how it stands out
- `size`: how wide or tall it is; width small too
- `align`: where its children go across
- `valign`: where its children go up and down
- `pad`: the space inside it, a step from 0 to 7, none or wide
- `gap`: the space between its children, a step from 0 to 7, none or wide
- `cols`: its columns: a number, or the weight of each, \[1 4 1\] or \[small 1 small\]
- `pane`: the faces it holds
- `fill`: as wide as it can be
- `fit`: takes the height the window has left; what it holds scrolls inside
- `hidden`: not shown
- `disabled`: shown, but it cannot be used
- `readonly`: shown and sent, but not changed, and no rule applies
- `inert`: shown as it is, but neither it nor what it holds can be used
- `narrow-only`: shown only on a narrow screen
- `wide-only`: hidden on a narrow screen
- `drag`: can be dragged
- `drop`: takes what is dropped on it
- `reorder`: its children or rows can be moved around
- `menu`: its context menu, or the menu a button opens
- `morph`: a name shared with a face of the next screen, which this one becomes
- `action`: the block it runs when clicked or changed
- `react`: a block run again whenever what it reads changes; react later waits for the first change
- `is`: a block whose value it shows, kept up to date
- `calc`: a block whose value it holds, kept up to date; readonly
- `required`: it must have a value
- `email`: its text is an email address
- `url`: its text is a web address
- `integer`: its value is a whole number
- `min`: the least it takes: a number, an amount, a date, a time, or rows
- `max`: the most it takes
- `length`: the fewest and most letters it takes: length 2 40
- `pattern`: a parse rule its text must match
- `match`: another field its value must be the same as
- `check`: a block that says whether the value is good
- `check-async`: a check that asks a server
- `step`: how far one move takes a slider; minutes between the times of a time
- `currency`: the currency of an amount, its three letters: EUR
- `options`: what to choose from: texts, value and text, groups with a title
- `segmented`: its options as buttons joined in a bar
- `multiple`: takes more than one
- `accept`: the files it takes: \["pdf" "image/\*"\]
- `round`: cut to a circle
- `known`: what each value shows as
- `links`: the screen each value links to when it is read only
- `template`: the fields of one row
- `tag`: the element it is, as the page's JavaScript defines it: \<geo-map\>
- `props`: the element's properties
- `extent`: the size of its drawing space, or of an image
- `draw`: what it draws, in the draw dialect
- `kind`: the kind of chart
- `stacked`: its series one on top of another
- `columns`: the field of each column and its header
- `data`: what it shows: the items of a breadcrumb, the nodes of an orbit, the screens
- `key`: the field that tells one row from another
- `sortable`: its headers sort its rows
- `sorted`: the order it starts in: \[due asc\]
- `by`: the field that names the lane of a card
- `lanes`: a word and a label for each lane
- `card`: the fields a card shows
- `flow`: the machine that leads the steps
- `poster`: the image shown before it plays
- `captions`: its captions: a .vtt file, or one per language
- `loop`: starts again when it ends
- `muted`: plays without its sound
- `autoplay`: plays on its own, silent
- `linked`: stands for something kept elsewhere: an arrow
- `mark`: a second, small icon on its icon, and its label: mark #list "List"
- `count`: a number that changes runs from the old one to the new
- `shortcut`: a key that presses it: key "Ctrl+S"
- `on-change`: runs when the value changes
- `on-focus`: runs when it gets the keyboard
- `on-unfocus`: runs when it loses the keyboard
- `on-over`: runs when the pointer comes in or goes (event/away?)
- `on-dbl-click`: runs on a double click
- `on-key`: runs on a key that nothing else took
- `on-menu`: runs when an item of its menu is picked
- `on-select`: runs when a row is chosen, or a face inside an inert one
- `on-drop`: runs when something is dropped on it
- `on-reorder`: runs when its children or rows are moved around
- `on-search`: gives what was found for the text typed
- `on-sort`: sorts the rows when a header is chosen
- `on-expand`: runs when a row opens, and may load its children
- `on-close`: runs when it is closed
- `on-end`: runs when it ends
- `on-back`: runs when a node of the trail is picked, or Escape
- `on-find`: gives what Ctrl+K finds for the text typed
- `on-enter`: runs as the screen is entered
- `on-leave`: says whether the page may leave the screen

(style-view)=
## view

Besides what every face takes, it takes `pad`, `gap`, `pane`, `on-find`.

The whole page: its children one under another. `view [...]` shows it; words before its first face (a width,
`on-key`) are the view's own.

(style-column)=
## column

Besides what every face takes, it takes `pad`, `gap`, `pane`.

Children one under another.

(style-row)=
## row

Besides what every face takes, it takes `pad`, `gap`, `pane`, `valign`.

Children side by side, wrapping onto the next line when they do not fit. With fields in it, they line up on
their controls; `top`, `middle` and `bottom` line them up otherwise. On a phone, a row with fields stacks them.

(style-form)=
## form

Besides what every face takes, it takes `pad`, `gap`, `pane`.

A form: its fields, with their labels beside them on a wide screen and above them on a narrow one. Its fields are
checked together, and its `submit` runs only when all of them are valid, with their `values`.

(style-panel)=
## panel

Besides what every face takes, it takes `pad`, `gap`, `pane`.

A group on a raised background, with a title when it is given a text.

(style-grid)=
## grid

Besides what every face takes, it takes `pad`, `gap`, `pane`, `cols`.

Columns: `grid 3 [...]` gives three equal ones, `grid [1 4 1] [...]` the weight of each, and `small`, `medium` or `large` in that block a column of a fixed width the theme sets (`grid [small 1 small]`). On a narrow screen, as
many as fit, down to one.

(style-scroll)=
## scroll

Besides what every face takes, it takes `pad`, `gap`, `pane`.

An area with a scroll of its own, at most 400 pixels high (`small` 240, `large` 640). Its text names it for
screen readers, and the keyboard scrolls it.

(style-desktop)=
## desktop

Besides what every face takes, it takes `pad`, `gap`, `pane`, `value`.

A mat that takes all the height left on the page, with the image it is given (`desktop %mat.png [...]`) or a
color of the theme, on which tiles are laid from left to right. Its `menu` is the context menu.

(style-title)=
## title

Besides what every face takes, it takes `count`.

The title of the page or of a screen: the text the browser shows for it, too.

(style-heading)=
## heading

Besides what every face takes, it takes `count`.

A heading inside a page.

(style-text)=
## text

Besides what every face takes, it takes `count`.

Text. A date, a time, a number or an amount is shown in the format of the active language.

(style-code)=
## code

Code, or any text shown exactly as written: in a fixed-width font, with its lines and spaces kept, and never
translated. A line too long for the screen scrolls on its own instead of wrapping.

(style-divider)=
## divider

A line between what comes before and after.

(style-field)=
## field

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `email`, `url`, `length`, `pattern`, `integer`.

A line of text. Its value is a string, or `none` when empty.

(style-password)=
## password

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `email`, `url`, `length`, `pattern`.

A field whose text is hidden.

(style-number)=
## number

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `integer`, `min`, `max`.

A field for a number. Its value is an integer or a decimal number; text that is not one stays on screen with its
message.

(style-money)=
## money

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `currency`, `min`, `max`.

A field for an amount: `money price "Price" EUR`. Its value is an exact `money!`; it shows formatted, and while
it is being edited, as a plain number in the language's way.

(style-date)=
## date

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `min`, `max`.

A field for a date, with a calendar. Its value is a `date!`; it is typed in the order of the active language, or
as `2026-12-02`.

(style-date-range)=
## date-range

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `min`, `max`.

Two dates, a start and an end, picked on one calendar: `date-range stay "Stay"`. Its value is a block of two
`date!` values, the start first, or `none`. The first day picked stays marked until the second; the field shows
both in the active language, and they are typed apart by a dash, as `3/11/2026 – 10/11/2026`. `min` holds for
the start and `max` for the end. A screen test sets it with `type "Stay" [3-Nov-2026 10-Nov-2026]`.

(style-time)=
## time

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `min`, `max`, `step`.

A field for a time of day, with a list of times: `time start "Start" step 15`. Its value is a `time!`. It is
shown in the active language and typed as `9:30`, `9.30`, `930` or `9:30 pm`. The list goes from its `min`
to its `max`, the whole day unless given, `step` minutes apart, 30 unless given, and opens on the time it holds
or the next one from now.

(style-area)=
## area

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `length`, `pattern`.

Several lines of text.

(style-rich)=
## rich

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`.

Rich text: headings, bold, italic, lists and links. Its value is Markdown, a plain string; `readonly` shows it
formatted. Code puts text where the user's cursor is with [`insert-text`](#fn-insert-text).

(style-check)=
## check

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`.

A check box. Its value is `true` or `false`.

(style-choice)=
## choice

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `options`.

A list to choose one from: `choice bike "Bike" ["Road" "City"]`. An option is a string, both its value and its
text, or a map with a `value` and a `text`. A title followed by a block is a group of options:
`["Repairs" ["Brakes" "Gears"] "Other"]`. The title, like a text, may be a text per language or a word of
the dictionary.

Until one is picked it shows its hint, or *Choose…*. When it is `required` that line cannot be picked again;
when it is not, picking it puts the value back to `none`.

(style-toggle)=
## toggle

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`.

A switch. Its value is `true` or `false`.

(style-slider)=
## slider

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `min`, `max`, `step`.

A number picked by moving a handle along a line, with the number it stands at after it:
`slider volume "Volume" 0 50 step 5`. The two numbers are the least and the most it takes, 0 and 100 unless
given, and `step` how far one move takes it, 1 unless given; a decimal step gives decimal values. It starts at
its least. The arrow keys, Home, End, Page Up and Page Down move it too. A screen test sets it with `type`.

(style-radio)=
## radio

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `options`, `segmented`.

Options to choose one from, all shown: the same options as a `choice`, groups included, each with its title
over its options. `segmented` shows them as buttons joined in a bar, the chosen one pressed.

(style-upload)=
## upload

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `multiple`, `accept`.

A button to choose files, which is also a place to drop them. Its value is a block of objects with the `name`,
`size`, `type` and `file` of each; `multiple` takes more than one, `accept ["pdf" "image/*"]` says which.

(style-video)=
## video

Besides what every face takes, it takes `value`, `poster`, `captions`, `loop`, `muted`, `autoplay`, `on-end`.

A video, with the browser's own controls: `video %intro.mp4 "Introduction"`. Its text is what a screen reader
says for it. It takes `poster`, `captions`, `loop`, `muted`, `autoplay` and `on-end` (see
[the words of the dialect](dialect.md)), and as wide as it can be unless `small`, `medium` or `large` says
otherwise.

(style-audio)=
## audio

Besides what every face takes, it takes `value`, `loop`, `muted`, `autoplay`, `on-end`.

A sound, with the browser's own controls: `audio %bell.m4a "Bell"`. It takes `loop`, `muted`, `autoplay` and
`on-end`.

(style-widget)=
## widget

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `tag`, `props`.

An element that the page's JavaScript defines, as a face like any other: `widget <geo-map> place "Place"
[zoom: 12]`. The tag names the element and comes first; the block sets its properties, and a second block is
the action. Its value is the element's `value` property, both ways, as JSON; when the element sends `change`,
the value is read back and `on-change` runs. Any other `on-xxx` listens to the element's event `xxx`, with the
event's `detail` in `event/detail`. With a name it is a field of its form, so `required` and the rules apply.
The theme's custom properties (`--tb-*`) reach it. See [A face in JavaScript](../ui/03-layout.md#a-face-in-javascript).

(style-photo)=
## photo

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `accept`, `round`, `value`.

An image and the buttons to choose another or remove it; clicking the image or dropping one on it chooses
too. Its value is `none`, the address of an image kept elsewhere (as a record from the server has it), or the
image chosen: an object with its `name`, `size`, `type` and `file`, as an upload's. It takes images unless
`accept` says otherwise; `round` makes it a circle: `photo picture "Photo" round`.

(style-lookup)=
## lookup

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `multiple`, `known`, `links`, `on-search`.

A field that searches as the person types: its `on-search` gives what was found, and the person picks one, or
several with `multiple`. `known` says what each value shows as; `links`, the screen each links to when it is
read only.

(style-progress)=
## progress

Besides what every face takes, it takes `value`.

A bar: its value is a percent or a number from 0 to 1; with `none`, it moves without saying how far.

(style-image)=
## image

Besides what every face takes, it takes `value`, `extent`, `round`.

An image, from a file or an address: `image %logo.png`. Its text is what a screen reader says for it; without
one it is decoration. `small`, `medium`, `large` and `fill` set its width, and a pair its size, which it fills,
cut to fit: `image %ada.jpg "Ada" 48x48 round`. `round` cuts it to a circle, as for a person's photo.

(style-backdrop)=
## backdrop

Besides what every face takes, it takes `value`.

An image behind what holds it: `view [backdrop %entry.jpg ...]`. It is not laid out with the rest; it
covers its container, and the whole window when that is the view or a screen. The theme lays a veil of the
background over it, just as strong as it takes for text on it to be easy to read on any image, in light and
dark; muted text takes the color of the text there.

(style-canvas)=
## canvas

It starts with `extent: 300x150`. Besides what every face takes, it takes `extent`, `draw`.

A drawing: `canvas 120x120 [fill-pen primary circle 60x60 50]`. The pair is the size of its drawing space, and
the block is in the [draw dialect](draw.md). It is as wide as that size, or narrower when there is no room,
and `fill` makes it as wide as it can be. With a string, the drawing is a picture with that name for a screen
reader; without one, it is decoration. Setting `draw` redraws it.

(style-chart)=
## chart

It starts with `kind: bar`. Besides what every face takes, it takes `kind`, `columns`, `stacked`.

A chart of rows: `chart bar income "Income" [month "Month" repairs "Repairs" parts "Parts"]`. The word after
`chart` is its kind, `bar`, `line`, `area` or `pie`; the next one is its label, as in a table. The first
column names each point and the others are the series, each in a color of the theme; numbers, money and
percents show as they do in a table. A pie shows the first series. `stacked` puts the series of a bar or area
chart on top of each other, and `small`, `medium` or `large` sets its height. The string is its caption.
Setting `data` redraws it, and a screen reader reads the same numbers as a table.

(style-orbit)=
## orbit

Besides what every face takes, it takes `data`, `on-back`.

One node of a graph in the middle and its neighbours on rings around it, joined by their edges:

```trebol-ui
view [
    orbit "Organization" [
        focus plenary
        nodes [plenary "Plenary" [primary count 9]  ana "Ana Ruiz" [accent]  town "Town council"]
        edges [plenary ana "Members"]
        trail [town]
    ] [print value]
]
```

`focus` is the node in the middle; `nodes` gives each node an id (a word, an integer, a string or an issue), a
title, and a block of hints if it has any: a role or a color word, `many` for one that stands for many (a second
ring), `dashed` for a shortcut, `count n` for how many it holds (small moons and a number), and `steps n at k`
for a ring of n steps with the k-th the current one. `edges` gives two ids, a label and `[solid]`, `[dashed]` or
`[faint]` if they have them; an edge between two neighbours bends around the middle. `trail` lists the nodes
the person came from, the most recent last; the last few show to one side, joined by a dotted line. Every node
given that is neither the focus nor in the trail is a neighbour; past 30, a bubble pages through them, and past
18, edge labels show only while the pointer is on a bubble.

Picking a neighbour sets `value` to its id and runs the action; picking a node of the trail, or Escape, runs
`on-back` instead, or the action when there is no `on-back`. The face never fetches anything: the action
sets `data` again, with the node picked in the middle, and the bubbles that stay move to their new places,
the new ones grow from the one picked and the rest fade. Dragging moves the view and a double click centres
it again; Ctrl and the wheel, or a pinch, zoom, and so does the wheel alone when `fit` makes it fill the
window. Tab goes through the neighbours and Enter picks one; a screen reader reads the node in the middle,
then each neighbour as a link with the label of its edge. `small`, `medium` or `large` sets its height.

(style-icon)=
## icon

An icon of the set Trebol brings, `icon #heart`, drawn in the color of its role.

(style-button)=
## button

Besides what every face takes, it takes `shortcut`.

A button: the block after it runs when it is pressed. With a `menu`, it opens the menu instead.

(style-link)=
## link

Besides what every face takes, it takes `value`, `shortcut`.

A link to a screen of the app: `link "Clients" 'clients`. It is a link for the browser too, so it opens in a
new tab when the person asks. Given a url or text instead, `link "Web" client/website`, it opens a web, mail
(`mailto:`) or phone (`tel:`) address or one with no scheme; any other (`javascript:`, `data:`) shows as a link
that goes nowhere, so data from a server can never run code. The same holds for the `links` of a lookup.

(style-tile)=
## tile

Besides what every face takes, it takes `linked`, `mark`.

A large icon with its name under it, for a desktop: `tile #folder "Reports" [...]`. `linked` marks with an arrow
one that stands for something kept elsewhere, and `mark #list "List"` puts a second, small icon on its icon.

(style-table)=
## table

Besides what every face takes, it takes `columns`, `key`, `sortable`, `sorted`, `on-sort`.

Rows of data in columns: `table board [customer "Customer" due "Due back"]` names the field of each column and
its header; its `data` is a block of maps or objects. On a narrow screen, each row is a card. `on-select` lets the
rows be chosen; `sortable` or `on-sort` let the headers sort them; `totals` is a row shown at the foot.
Among the rows, `[head 1 "Title"]` is the title of a group, the width of the table, and `[foot 1 row]` its
subtotals; level 2 is indented. Neither is chosen or sorted: `sortable` sorts the rows inside each group. A
list shows them too. A column followed by `image` shows each row's picture, from the address or file in its
field, and `image round` cuts it to a circle: `table people [photo "" image round name "Name"]`.

(style-list)=
## list

Besides what every face takes, it takes `columns`, `key`, `sortable`, `sorted`.

The same rows as a table, as a list: the first field stands out and the rest go on a second line. The picture of
a column of images goes first.

(style-board)=
## board

Besides what every face takes, it takes `by`, `lanes`, `card`, `key`.

Cards in lanes: `board jobs by status [todo "To do" doing "Doing" done "Done"]` makes a lane for each word, with
its label, and puts in it, as a card, each row of its `data` whose `status` names it, a word or a text. A card
shows the row's `title`, or the fields of `card [title "Job" who "Mechanic"]`, the first one large, as a list
does. A card can be dragged to another lane, or moved there from its menu; then its field names that lane and
`on-drop` runs, with `event/row`, `event/from` and `event/to`: when it gives `false`, the card goes back.
`on-select`, or the block after the lanes when there is none, runs when a card is chosen, with it as `row`. When the field holds a machine, a lane is a state: a card goes to the
lane only by a way of its machine from where it is to that state, whose event the drop sends.

(style-tabs)=
## tabs

It starts with `value: 1`. Besides what every face takes, it takes `pane`.

Tabs, each with its title and its block: `tabs ["General" [...] "Advanced" [...]]`. Its value is the number of
the tab shown.

(style-tab)=
## tab

One tab of `tabs`, which makes it: it is not written in a layout.

(style-steps)=
## steps

It starts with `value: 1`. Besides what every face takes, it takes `pane`, `flow`.

A form filled in one step at a time: `steps ["Who" [...] "Company" when [values/kind = "Company"] [...] "Check"
[...]]`, each step a title and its block. A bar on top numbers the titles, and on a narrow screen a line says
"Step 2 of 3". Back and Next go under the step; Next shows the messages of the step's fields and moves on only
when they are all valid, and Enter in a field presses it. The submit buttons of the form show on the last step,
next to Back, and `values` holds the fields of every step. A step with `when` applies only while its block is
true: the bar leaves it out, and its fields are neither checked nor in `values`. Its value is the number of the
step on show, counting every step: setting it shows that step without checking anything. A step done is chosen
again with its title; each step moved on to is an entry in the browser's history, so Back returns to the one
before.

(style-step)=
## step

One step of `steps`, which makes it: it is not written in a layout.

(style-toolbar)=
## toolbar

Besides what every face takes, it takes `pad`, `gap`, `pane`.

A row of buttons that the keyboard reaches with one Tab and moves through with the arrows; `---` puts a separator.
On a narrow screen, a button with an icon shows only the icon.

(style-breadcrumb)=
## breadcrumb

Besides what every face takes, it takes `data`.

Where the person is: `breadcrumb ["Home" home "Clients" clients "Ada"] [go value]`. Each item is a text and the
word its action receives; the last, without a word, is where they are.

(style-tree)=
## tree

Besides what every face takes, it takes `columns`, `key`, `on-expand`.

Rows with rows inside, in their `children`, which open and close. Like a table, its rows can be chosen and
dragged.

(style-screens)=
## screens

Besides what every face takes, it takes `data`, `on-change`.

The screens of an app, one shown at a time, each with a link of its own: `screens [home "Home" [...] client [id]
"Client" [...]]`. `go` goes to one; its value is the route shown.

(style-screen)=
## screen

Besides what every face takes, it takes `on-enter`, `on-leave`.

One screen of `screens`, which makes it: it is not written in a layout.

(style-rows)=
## rows

Besides what every face takes, it takes `name`, `readonly`, `required`, `match`, `check`, `check-async`, `calc`, `on-change`, `template`, `min`, `max`.

A field made of rows the person adds and removes, each with the fields of its block:
`rows lines "Lines" min 1 [field part "Part" number qty "Qty"]`. Its value is a block with a map for each row.

(style-entry)=
## entry

One row of `rows`, which makes it: it is not written in a layout.

(style-submit)=
## submit

Made from [`button`](#style-button). It starts with `role: primary`, `submit: true`. Besides what every face takes, it takes `shortcut`.

The button of a form: it runs its block only when every field of the form is valid, and Enter in any field
presses it. Its block sees the form's `values`.

(style-dialog)=
## dialog

It starts with `hidden: true`. Besides what every face takes, it takes `pad`, `gap`, `pane`, `on-close`.

A window over the page, hidden until `open` shows it and `close` hides it, with a title when it is given a text.
On a phone, it takes the whole screen.

(style-split)=
## split

It starts with `value: 1`. Besides what every face takes, it takes `pad`, `gap`, `pane`.

Two panes side by side, with a handle between them that the mouse or the arrows move. On a narrow screen one is
shown at a time: the one its value says, 1 or 2; the second has a button back to the first.
