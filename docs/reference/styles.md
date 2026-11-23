<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Styles

The styles of the UI dialect: the kinds of thing a layout is made of. A layout names a style and follows it with
what that face needs, in any order: a label for the code (`total:` before the style), texts (a string, a text per
language, or a quoted word of the dictionary), handlers (`on-change [...]`), `react`, `is` and `calc`, and what
the style takes, which each style below lists: a field name (the first word after an input style), an icon
(`#search`), words of the dialect (see [the words of the dialect](dialect.md)), values, and blocks (the children
of a container, the items of a choice or a menu). A block no entry takes is the action, the block at the end.
What a style does not take is a problem of the layout: `field name poster %p.png` says "poster is not a word of
field".

Each style is made from another and takes what that one takes, and more: `face` is where every style starts,
`container`, `input` and `rows-face` are made from it, and no layout writes these four. `stylize` makes a style
of your own the same way, with a `takes:` block of its own; see [styles of your own](../ui/13-styles-of-your-own.md).

(style-face)=
## face

Styles are made from it; a layout never writes it.

Every face takes:

- an issue (`icon`): an icon before the text, one of those Trebol brings
- one of `primary`, `accent`, `danger`, `success`, `warning`, `muted` (`role`): how it stands out
- one of `small`, `medium`, `large` (`size`): how wide or tall it is
- [`width`](#word-width) and one of `small`, `medium`, `large`, `fill` (`size`): how wide it is: width small, or fill
- one of `left`, `center`, `right`, `spread` (`align`): where its children go across
- [`fill`](#word-fill): as wide as it can be
- [`fit`](#word-fit): takes the height the window has left; what it holds scrolls inside
- [`hidden`](#word-hidden): not shown
- [`disabled`](#word-disabled): shown, but it cannot be used
- [`inert`](#word-inert): shown as it is, but neither it nor what it holds can be used
- [`narrow-only`](#word-narrow-only): shown only on a narrow screen
- [`wide-only`](#word-wide-only): hidden on a narrow screen
- [`drag`](#word-drag): can be dragged
- [`drop`](#word-drop): takes what is dropped on it
- [`reorder`](#word-reorder): its children or rows can be moved around
- [`menu`](#word-menu) and a block: its context menu, or the menu a button opens
- [`morph`](#word-morph) and a lit-word or a block: a name shared with a face of the next screen, which this one becomes
- [`with`](#word-with) and a block: a block run bound to the face once it is read: the last way out, for a field nothing else sets

It fires [`on-over`](#word-on-over), [`on-dbl-click`](#word-on-dbl-click), [`on-key`](#word-on-key), [`on-focus`](#word-on-focus), [`on-unfocus`](#word-on-unfocus), [`on-menu`](#word-on-menu), [`on-select`](#word-on-select), [`on-drop`](#word-on-drop), [`on-reorder`](#word-on-reorder).

What every face is and takes. Its last way out, `with [...]`, runs a block bound to the face once it is read,
to set a field no word sets: use it when nothing else does, since check and a designer cannot see into it.

(style-container)=
## container

Made from [`face`](#style-face). Styles are made from it; a layout never writes it.

It takes what [`face`](#style-face) takes, and:

- [`pad`](#word-pad) and an integer or a word: the space inside it, a step from 0 to 7, none or wide
- [`gap`](#word-gap) and an integer or a word: the space between its children, a step from 0 to 7, none or wide
- a block (`pane`): the faces it holds

What a face that holds others takes: its children, and the spacing around and between them.

(style-input)=
## input

Made from [`face`](#style-face). Styles are made from it; a layout never writes it.

It takes what [`face`](#style-face) takes, and:

- a word, right after the style (`name`): the field's name: the key of its value in values
- [`readonly`](#word-readonly): shown and sent, but not changed, and no rule applies
- [`required`](#word-required): it must have a value
- [`match`](#word-match) and a word: another field its value must be the same as
- [`check`](#word-check) and a block: a block that says whether the value is good
- [`check-async`](#word-check-async) and a block: a check that asks a server
- a rule made with [`rule`](#fn-rule): a rule a program adds with rule

It fires [`on-change`](#word-on-change).

What a face that holds a value of a form takes: its name, its rules, `readonly`.

(style-rows-face)=
## rows-face

Made from [`face`](#style-face). Styles are made from it; a layout never writes it.

It takes what [`face`](#style-face) takes, and:

- a word, right after the style: the word that labels it: table clients is clients: table
- a block (`columns`): the field of each column and its header
- [`key`](#word-key) and a word: the field that tells one row from another
- [`role-by`](#word-role-by) and a word: the field of a row whose value, success or danger, is the role the row is painted in

What a face that shows rows takes: its columns, and the field that tells rows apart.

(style-view)=
## view

Made from [`container`](#style-container).

It fires [`on-find`](#word-on-find).

The whole page: its children one under another. `view [...]` shows it; words before its first face (a width,
`on-key`) are the view's own.

(style-column)=
## column

Made from [`container`](#style-container).

Children one under another.

(style-row)=
## row

Made from [`container`](#style-container).

It takes what [`container`](#style-container) takes, and:

- one of `top`, `middle`, `bottom` (`valign`): where its children go up and down

Children side by side, wrapping onto the next line when they do not fit. With fields in it, they line up on
their controls; `top`, `middle` and `bottom` line them up otherwise. On a phone, a row with fields stacks them.

(style-form)=
## form

Made from [`container`](#style-container).

A form: its fields, with their labels beside them on a wide screen and above them on a narrow one. Its fields are
checked together, and its `submit` runs only when all of them are valid, with their `values`.

(style-panel)=
## panel

Made from [`container`](#style-container).

A group on a raised background, with a title when it is given a text.

(style-grid)=
## grid

Made from [`container`](#style-container). Fields of its own: `resize: none`.

It takes what [`container`](#style-container) takes, and:

- an integer (`cols`): how many columns
- a block (`cols`): the weight of each column, \[1 4 1\], or small, medium or large for one as wide as the theme says
- [`resize`](#word-resize): a handle between two columns makes one wider; the browser keeps the widths

Columns: `grid 3 [...]` gives three equal ones, `grid [1 4 1] [...]` the weight of each, and `small`, `medium` or `large` in that block a column of a fixed width the theme sets (`grid [small 1 small]`). On a narrow screen, as
many as fit, down to one.

(style-scroll)=
## scroll

Made from [`container`](#style-container).

An area with a scroll of its own, at most 400 pixels high (`small` 240, `large` 640). Its text names it for
screen readers, and the keyboard scrolls it.

(style-desktop)=
## desktop

Made from [`container`](#style-container).

It takes what [`container`](#style-container) takes, and:

- a file or an url (`value`): the picture behind it

A mat that takes all the height left on the page, with the image it is given (`desktop %mat.png [...]`) or a
color of the theme, on which tiles are laid from left to right. Its `menu` is the context menu.

(style-device)=
## device

Made from [`container`](#style-container). Fields of its own: `screen: 390x844`.

It takes what [`container`](#style-container) takes, and:

- a pair (`screen`): the size of its screen in CSS pixels: 390x844
- one of `phone`, `tablet`, `desktop` (`screen`): a phone (390x844), a tablet (834x1112) or a desktop (1280x800)

A screen of another size: its faces laid out at the size of its screen, `phone` (390x844, the first),
`tablet` (834x1112), `desktop` (1280x800) or a pair from 200x200 to 3840x3840, and made smaller to fit its
place. The narrow rules go by the width of its screen, as they go by the page's. With `fit` it takes the height
left as well and the whole screen fits in it, in the middle of its place.

(style-title)=
## title

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- [`count`](#word-count): a number that changes runs from the old one to the new

The title of the page or of a screen: the text the browser shows for it, too.

(style-heading)=
## heading

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- [`count`](#word-count): a number that changes runs from the old one to the new

A heading inside a page.

(style-text)=
## text

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- [`count`](#word-count): a number that changes runs from the old one to the new

Text. A date, a time, a number or an amount is shown in the format of the active language.

(style-code)=
## code

Made from [`face`](#style-face).

Code, or any text shown exactly as written: in a fixed-width font, with its lines and spaces kept, and never
translated. A line too long for the screen scrolls on its own instead of wrapping.

(style-divider)=
## divider

Made from [`face`](#style-face).

A line between what comes before and after.

(style-field)=
## field

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- [`email`](#word-email): its text is an email address
- [`url`](#word-url): its text is a web address
- [`integer`](#word-integer): its value is a whole number
- [`length`](#word-length) and two integers: the fewest and most letters it takes: length 2 40
- [`pattern`](#word-pattern) and a block: a parse rule its text must match

A line of text. Its value is a string, or `none` when empty.

(style-password)=
## password

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- [`length`](#word-length) and two integers: the fewest and most letters it takes: length 8 64
- [`pattern`](#word-pattern) and a block: a parse rule its text must match

A field whose text is hidden.

(style-number)=
## number

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- [`integer`](#word-integer): its value is a whole number
- [`min`](#word-min) and a number: the least it takes
- [`max`](#word-max) and a number: the most it takes

A field for a number. Its value is an integer or a decimal number; text that is not one stays on screen with its
message.

(style-money)=
## money

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- a word (`currency`): the currency of the amount, its three letters: EUR
- [`min`](#word-min) and a money or a number: the least it takes
- [`max`](#word-max) and a money or a number: the most it takes

A field for an amount: `money price "Price" EUR`. Its value is an exact `money!`; it shows formatted, and while
it is being edited, as a plain number in the language's way.

(style-date)=
## date

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- [`min`](#word-min) and a date: the first day it takes
- [`max`](#word-max) and a date: the last day it takes

A field for a date, with a calendar. Its value is a `date!`; it is typed in the order of the active language, or
as `2026-12-02`.

(style-date-range)=
## date-range

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- [`min`](#word-min) and a date: the first day it takes
- [`max`](#word-max) and a date: the last day it takes

Two dates, a start and an end, picked on one calendar: `date-range stay "Stay"`. Its value is a block of two
`date!` values, the start first, or `none`. The first day picked stays marked until the second; the field shows
both in the active language, and they are typed apart by a dash, as `3/11/2026 – 10/11/2026`. `min` holds for
the start and `max` for the end. A screen test sets it with `type "Stay" [3-Nov-2026 10-Nov-2026]`.

(style-time)=
## time

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- [`min`](#word-min) and a time: the earliest time it takes
- [`max`](#word-max) and a time: the latest time it takes
- [`step`](#word-step) and a number: the minutes between the times it lists, 1 to 720

A field for a time of day, with a list of times: `time start "Start" step 15`. Its value is a `time!`. It is
shown in the active language and typed as `9:30`, `9.30`, `930` or `9:30 pm`. The list goes from its `min`
to its `max`, the whole day unless given, `step` minutes apart, 30 unless given, and opens on the time it holds
or the next one from now.

(style-area)=
## area

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- [`length`](#word-length) and two integers: the fewest and most letters it takes: length 0 500
- [`pattern`](#word-pattern) and a block: a parse rule its text must match

Several lines of text.

(style-rich)=
## rich

Made from [`input`](#style-input).

Rich text: headings, bold, italic, lists and links. Its value is Markdown, a plain string; `readonly` shows it
formatted. Code puts text where the user's cursor is with [`insert-text`](#fn-insert-text).

(style-check)=
## check

Made from [`input`](#style-input).

A check box. Its value is `true` or `false`.

(style-choice)=
## choice

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- a block (`options`): what to choose from: texts, value and text, groups with a title

A list to choose one from: `choice bike "Bike" ["Road" "City"]`. An option is a string, both its value and its
text, or a map with a `value` and a `text`. A title followed by a block is a group of options:
`["Repairs" ["Brakes" "Gears"] "Other"]`. The title, like a text, may be a text per language or a word of
the dictionary.

Until one is picked it shows its hint, or *Choose…*. When it is `required` that line cannot be picked again;
when it is not, picking it puts the value back to `none`.

(style-toggle)=
## toggle

Made from [`input`](#style-input).

A switch. Its value is `true` or `false`.

(style-slider)=
## slider

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- two numbers (`rules`): the least and the most it takes: 0 100
- [`step`](#word-step) and a number: how far one move takes it

A number picked by moving a handle along a line, with the number it stands at after it:
`slider volume "Volume" 0 50 step 5`. The two numbers are the least and the most it takes, 0 and 100 unless
given, and `step` how far one move takes it, 1 unless given; a decimal step gives decimal values. It starts at
its least. The arrow keys, Home, End, Page Up and Page Down move it too. A screen test sets it with `type`.

(style-radio)=
## radio

Made from [`choice`](#style-choice).

It takes what [`choice`](#style-choice) takes, and:

- [`segmented`](#word-segmented): its options as buttons joined in a bar

Options to choose one from, all shown: the same options as a `choice`, groups included, each with its title
over its options. `segmented` shows them as buttons joined in a bar, the chosen one pressed.

(style-upload)=
## upload

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- [`multiple`](#word-multiple): takes more than one file
- [`accept`](#word-accept) and a block: the files it takes: \["pdf" "image/\*"\]

A button to choose files, which is also a place to drop them. Its value is a block of objects with the `name`,
`size`, `type` and `file` of each; `multiple` takes more than one, `accept ["pdf" "image/*"]` says which.

(style-video)=
## video

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- a file or an url (`value`): the video it plays
- [`poster`](#word-poster) and a file or an url: the image shown before it plays
- [`captions`](#word-captions) and a file, an url or a block: its captions: a .vtt file, or one per language \[en %a.vtt es %b.vtt\]
- [`loop`](#word-loop) (`looping`): starts again when it ends
- [`muted`](#word-muted) (`silent`): plays without its sound
- [`autoplay`](#word-autoplay): plays on its own, silent

It fires [`on-end`](#word-on-end).

A video, with the browser's own controls: `video %intro.mp4 "Introduction"`. Its text is what a screen reader
says for it. It takes `poster`, `captions`, `loop`, `muted`, `autoplay` and `on-end` (see
[the words of the dialect](dialect.md)), and as wide as it can be unless `small`, `medium` or `large` says
otherwise.

(style-audio)=
## audio

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- a file or an url (`value`): the sound it plays
- [`loop`](#word-loop) (`looping`): starts again when it ends
- [`muted`](#word-muted) (`silent`): plays without its sound
- [`autoplay`](#word-autoplay): plays on its own, silent

It fires [`on-end`](#word-on-end).

A sound, with the browser's own controls: `audio %bell.m4a "Bell"`. It takes `loop`, `muted`, `autoplay` and
`on-end`.

(style-widget)=
## widget

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- a tag, right after the style (`tag`): the element it is, as the page's JavaScript defines it: \<geo-map\>
- a block (`props`): the element's properties

It fires whatever events its element fires.

An element that the page's JavaScript defines, as a face like any other: `widget <geo-map> place "Place"
[zoom: 12]`. The tag names the element and comes first; the block sets its properties, and a second block is
the action. Its value is the element's `value` property, both ways, as JSON; when the element sends `change`,
the value is read back and `on-change` runs. Any other `on-xxx` listens to the element's event `xxx`, with the
event's `detail` in `event/detail`. With a name it is a field of its form, so `required` and the rules apply.
The theme's custom properties (`--tb-*`) reach it. See [A face in JavaScript](../ui/03-layout.md#a-face-in-javascript).

(style-photo)=
## photo

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- [`accept`](#word-accept) and a block: the images it takes
- [`round`](#word-round): cut to a circle, as a person's photo
- a file or an url (`value`): the photo it starts with

An image and the buttons to choose another or remove it; clicking the image or dropping one on it chooses
too. Its value is `none`, the address of an image kept elsewhere (as a record from the server has it), or the
image chosen: an object with its `name`, `size`, `type` and `file`, as an upload's. It takes images unless
`accept` says otherwise; `round` makes it a circle: `photo picture "Photo" round`.

(style-lookup)=
## lookup

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- [`multiple`](#word-multiple): takes more than one
- [`known`](#word-known) and a map: what each value shows as
- [`links`](#word-links) and a map: the screen each value links to when it is read only

It fires [`on-search`](#word-on-search).

A field that searches as the person types: its `on-search` gives what was found, and the person picks one, or
several with `multiple`. `known` says what each value shows as; `links`, the screen each links to when it is
read only.

(style-progress)=
## progress

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- a percent (`value`): how far it is

A bar: its value is a percent or a number from 0 to 1; with `none`, it moves without saying how far.

(style-stat)=
## stat

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- a number or a money (`value`): the number it shows
- [`count`](#word-count): a number that changes runs from the old one to the new
- [`trend`](#word-trend) and a block: the numbers it had, oldest first, drawn as a small line: trend \[3 5 4 8\]

A number that stands for something, as a dashboard shows it: `stat "Takings" $1240.00`. Its text says what the
number is, its value is the number, and a second text is the line under it: `stat "Late" 3 "of 41 this week"`.
`trend [3 5 4 8]` draws the numbers it had, oldest first, as a small line at its foot, ending on a dot; two
numbers at least, or it is a problem of the layout. A role colours the number and the line (`stat "Late" 3
danger`), and with `count` a new number runs from the old one, as a text's does. `is [...]` gives it its number.
On its own it is a card; in a panel it drops its border. The number is as large as the width of the stat lets it
be, so four in a row never break one in two. A screen reader reads the text, the number and the line under it;
the trend is for the eye.

(style-image)=
## image

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- a file or an url (`value`): the picture it shows
- a pair (`extent`): its size
- [`round`](#word-round): cut to a circle, as a person's photo

An image, from a file or an address: `image %logo.png`. Its text is what a screen reader says for it; without
one it is decoration. `small`, `medium`, `large` and `fill` set its width, and a pair its size, which it fills,
cut to fit: `image %ada.jpg "Ada" 48x48 round`. `round` cuts it to a circle, as for a person's photo.

(style-backdrop)=
## backdrop

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- a file or an url (`value`): the picture it shows

An image behind what holds it: `view [backdrop %entry.jpg ...]`. It is not laid out with the rest; it
covers its container, and the whole window when that is the view or a screen. The theme lays a veil of the
background over it, just as strong as it takes for text on it to be easy to read on any image, in light and
dark; muted text takes the color of the text there.

(style-canvas)=
## canvas

Made from [`face`](#style-face). It starts with `extent: 300x150`.

It takes what [`face`](#style-face) takes, and:

- a pair (`extent`): the size of its drawing space
- a block (`draw`): what it draws, in the draw dialect

A drawing: `canvas 120x120 [fill-pen primary circle 60x60 50]`. The pair is the size of its drawing space, and
the block is in the [draw dialect](draw.md). It is as wide as that size, or narrower when there is no room,
and `fill` makes it as wide as it can be. With a string, the drawing is a picture with that name for a screen
reader; without one, it is decoration. Setting `draw` redraws it.

(style-chart)=
## chart

Made from [`face`](#style-face). It starts with `kind: bar`.

It takes what [`face`](#style-face) takes, and:

- one of `bar`, `line`, `area`, `pie`, right after the style (`kind`): the kind of chart
- a word, right after the style: the word that labels it: chart bar income is income: chart bar
- one of `bar`, `line`, `area`, `pie` (`kind`): the kind of chart
- a block (`columns`): the field of each series and its label
- [`stacked`](#word-stacked): its series one on top of another

A chart of rows: `chart bar income "Income" [month "Month" repairs "Repairs" parts "Parts"]`. The word after
`chart` is its kind, `bar`, `line`, `area` or `pie`; the next one is its label, as in a table. The first
column names each point and the others are the series, each in a color of the theme; numbers, money and
percents show as they do in a table. A pie shows the first series. `stacked` puts the series of a bar or area
chart on top of each other, and `small`, `medium` or `large` sets its height. The string is its caption.
Setting `data` redraws it, and a screen reader reads the same numbers as a table.

(style-orbit)=
## orbit

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- a word, right after the style: the word that labels it
- a block (`data`): what it shows: its focus, nodes, edges and trail

It fires [`on-back`](#word-on-back).

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

Made from [`face`](#style-face).

An icon of the set Trebol brings, `icon #heart`, drawn in the color of its role.

The icons, for `icon`, an icon before a face's text, a tile's `mark` and a menu's items; another name is a
problem of the layout (`#hart is not an icon; did you mean #heart?`), and `ui-icons` is the list:

`#search` `#plus` `#minus` `#close` `#check` `#chevron-left` `#chevron-right` `#chevron-up` `#chevron-down` `#chevrons-left` `#chevrons-right` `#arrow-left` `#arrow-right` `#arrow-up` `#arrow-down` `#edit` `#trash` `#user` `#mail` `#phone` `#info` `#warning` `#menu` `#home` `#folder` `#door` `#building` `#landmark` `#shield` `#fireworks` `#coins` `#book` `#scale` `#people` `#tree` `#truck` `#box` `#file` `#invoice` `#template` `#stack` `#image` `#settings` `#filter` `#refresh` `#undo` `#redo` `#download` `#upload` `#external` `#eye` `#lock` `#calendar` `#clock` `#star` `#heart` `#type` `#lines` `#rows` `#bold` `#italic` `#heading` `#list` `#list-ordered` `#link` `#hash` `#globe` `#banknote` `#check-square` `#toggle` `#radio` `#dropdown` `#panel` `#columns` `#grid` `#tabs` `#pointer`

(style-button)=
## button

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- [`key`](#word-key) and a string (`shortcut`): a key that presses it: key "Ctrl+S"

A button: the block after it runs when it is pressed. With a `menu`, it opens the menu instead.

(style-link)=
## link

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- a lit-word, a lit-path, a file or an url (`value`): where it goes: a screen, 'clients or 'client/42, a file or a url
- [`key`](#word-key) and a string (`shortcut`): a key that presses it: key "Ctrl+S"

A link to a screen of the app: `link "Clients" 'clients`. It is a link for the browser too, so it opens in a
new tab when the person asks. Given a url or text instead, `link "Web" client/website`, it opens a web, mail
(`mailto:`) or phone (`tel:`) address or one with no scheme; any other (`javascript:`, `data:`) shows as a link
that goes nowhere, so data from a server can never run code. The same holds for the `links` of a lookup.

(style-tile)=
## tile

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- [`linked`](#word-linked): stands for something kept elsewhere: marked with an arrow
- [`mark`](#word-mark) and an issue and a text: a second, small icon on its icon, and its label: mark #list "List"

A large icon with its name under it, for a desktop: `tile #folder "Reports" [...]`. `linked` marks with an arrow
one that stands for something kept elsewhere, and `mark #list "List"` puts a second, small icon on its icon.

(style-table)=
## table

Made from [`rows-face`](#style-rows-face).

It takes what [`rows-face`](#style-rows-face) takes, and:

- [`sortable`](#word-sortable): its headers sort its rows
- [`sorted`](#word-sorted) and a block: the order it starts in: \[due asc\]

It fires [`on-sort`](#word-on-sort).

Rows of data in columns: `table board [customer "Customer" due "Due back"]` names the field of each column and
its header; its `data` is a block of maps or objects. On a narrow screen, each row is a card. `on-select` lets the
rows be chosen; `sortable` or `on-sort` let the headers sort them; `totals` is a row shown at the foot.
Among the rows, `[head 1 "Title"]` is the title of a group, the width of the table, and `[foot 1 row]` its
subtotals; level 2 is indented. Neither is chosen or sorted: `sortable` sorts the rows inside each group. A
list shows them too. A column followed by `image` shows each row's picture, from the address or file in its
field, and `image round` cuts it to a circle: `table people [photo "" image round name "Name"]`.
`role-by tone` after the table's name paints each row in the role its `tone` field names, `success`, `danger`,
`warning`, `primary`, `accent` or `muted`, as a word or a text in any case: the row is tinted with a bar at its
start. After a column, `[state "State" role-by tone]`, it paints that column's cell in it instead. A value that
names no role, or none, paints nothing; data is never a problem of the layout.

(style-list)=
## list

Made from [`rows-face`](#style-rows-face).

The same rows as a table, as a list: the first field stands out and the rest go on a second line. The picture of
a column of images goes first. `role-by` paints a whole item, and, after a column, its text.

(style-board)=
## board

Made from [`face`](#style-face). Fields of its own: `field: none`, `lanes: none`, `card: none`.

It takes what [`face`](#style-face) takes, and:

- a word, right after the style: the word that labels it: board tasks is tasks: board
- [`by`](#word-by) and a word (`field`): the field of a card that names its lane: by status
- a block (`lanes`): a word and a label for each lane
- [`card`](#word-card) and a block: the fields a card shows
- [`key`](#word-key) and a word: the field that tells one card from another
- [`role-by`](#word-role-by) and a word: the field of a card whose value, success or danger, is the role the card is painted in

Cards in lanes: `board jobs by status [todo "To do" doing "Doing" done "Done"]` makes a lane for each word, with
its label, and puts in it, as a card, each row of its `data` whose `status` names it, a word or a text. A card
shows the row's `title`, or the fields of `card [title "Job" who "Mechanic"]`, the first one large, as a list
does. `role-by tone` paints each card in the role its `tone` names, as in a table. A card can be dragged to another lane, or moved there from its menu; then its field names that lane and
`on-drop` runs, with `event/row`, `event/from` and `event/to`: when it gives `false`, the card goes back.
`on-select`, or the block after the lanes when there is none, runs when a card is chosen, with it as `row`. When the field holds a machine, a lane is a state: a card goes to the
lane only by a way of its machine from where it is to that state, whose event the drop sends.

(style-tabs)=
## tabs

Made from [`face`](#style-face). It starts with `value: 1`.

It takes what [`face`](#style-face) takes, and:

- a block (`pane`): a label and a block of faces per tab

Tabs, each with its title and its block: `tabs ["General" [...] "Advanced" [...]]`. Its value is the number of
the tab shown.

(style-tab)=
## tab

Made from [`face`](#style-face). Another face makes it; a layout does not write it.

One tab of `tabs`, which makes it: it is not written in a layout.

(style-steps)=
## steps

Made from [`face`](#style-face). It starts with `value: 1`. Fields of its own: `flow: none`, `trail: none`.

It takes what [`face`](#style-face) takes, and:

- a word (`flow`): the machine that leads the steps
- a block (`pane`): a label and a block of faces per step

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

Made from [`face`](#style-face). Another face makes it; a layout does not write it.

One step of `steps`, which makes it: it is not written in a layout.

(style-toolbar)=
## toolbar

Made from [`container`](#style-container).

It takes what [`container`](#style-container) takes, and:

- a block (`pane`): the faces it holds; --- is a divider

A row of buttons that the keyboard reaches with one Tab and moves through with the arrows; `---` puts a separator.
On a narrow screen, a button with an icon shows only the icon.

(style-breadcrumb)=
## breadcrumb

Made from [`face`](#style-face).

It takes what [`face`](#style-face) takes, and:

- a block (`data`): its items: a label and where each goes

Where the person is: `breadcrumb ["Home" home "Clients" clients "Ada"] [go value]`. Each item is a text and the
word its action receives; the last, without a word, is where they are.

(style-tree)=
## tree

Made from [`rows-face`](#style-rows-face).

It fires [`on-expand`](#word-on-expand).

Rows with rows inside, in their `children`, which open and close. Like a table, its rows can be chosen and
dragged, and `role-by` paints a row, or, after its column, its label.

(style-screens)=
## screens

Made from [`face`](#style-face). Fields of its own: `entering: false`.

It takes what [`face`](#style-face) takes, and:

- a block (`data`): its screens: a word, a title and a block of faces each

It fires [`on-change`](#word-on-change).

The screens of an app, one shown at a time, each with a link of its own: `screens [home "Home" [...] client [id]
"Client" [...]]`. `go` goes to one; its value is the route shown.

(style-screen)=
## screen

Made from [`face`](#style-face). Another face makes it; a layout does not write it.

It fires [`on-enter`](#word-on-enter), [`on-leave`](#word-on-leave).

One screen of `screens`, which makes it: it is not written in a layout.

(style-rows)=
## rows

Made from [`input`](#style-input).

It takes what [`input`](#style-input) takes, and:

- a block (`template`): the fields of one row
- [`min`](#word-min) and an integer: the fewest rows it takes
- [`max`](#word-max) and an integer: the most rows it takes

A field made of rows the person adds and removes, each with the fields of its block:
`rows lines "Lines" min 1 [field part "Part" number qty "Qty"]`. Its value is a block with a map for each row.

(style-entry)=
## entry

Made from [`face`](#style-face). Another face makes it; a layout does not write it.

One row of `rows`, which makes it: it is not written in a layout.

(style-submit)=
## submit

Made from [`button`](#style-button). It starts with `role: primary`, `submit: true`.

The button of a form: it runs its block only when every field of the form is valid, and Enter in any field
presses it. Its block sees the form's `values`.

(style-dialog)=
## dialog

Made from [`container`](#style-container). It starts with `hidden: true`.

It fires [`on-close`](#word-on-close).

A window over the page, hidden until `open` shows it and `close` hides it, with a title when it is given a text.
On a phone, it takes the whole screen.

(style-split)=
## split

Made from [`container`](#style-container). It starts with `value: 1`.

Two panes side by side, with a handle between them that the mouse or the arrows move. On a narrow screen one is
shown at a time: the one its value says, 1 or 2; the second has a button back to the first.
