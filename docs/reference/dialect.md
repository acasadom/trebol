<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Words of the dialect

The words a face takes after its style, besides texts, icons and blocks: roles, sizes, alignments, flags, rules
and events. Any of them goes with any style, and each does what it means where it means something. Some
take a value right after them: `min 18`, `width small`, `menu [...]`.

A few things are written without a word of their own: `global` before a label makes it a word of the whole
program and not only of the layout; `---` separates the items of a menu or the buttons of a toolbar; a word of
three capital letters after `money` is its currency, `EUR`.

`layout` (and `view`, which calls it) reads the whole block before it shows anything, and a value it cannot
place is a problem: an unknown word, a rule word without what it takes (`min "x"`), a block that is not what
its face takes. It gives one error with every problem in the block, each with its file, line and column, and
the word it may have meant when one is close: `buton is not a style; did you mean button?`. An `on-` word
that is no event is a problem too (`on-chnage is not an event; did you mean on-change?`), since its block
would never run (a `widget` takes any, as its element fires its own); a click is the block after the face, not an `on-click`. The faces of a
screen or of a row of `rows` are laid out, and checked, when they are first shown.

A role on a `text`, `heading` or `title` colours its letters, in a shade of the role's color that reads well
on the page: `title "Overdue" danger`.

(word-primary)=
## primary

A role.

The color of the main thing to do: a button that stands out. A `submit` is primary by itself.

(word-accent)=
## accent

A role.

The theme's second color.

(word-danger)=
## danger

A role.

What removes or cannot be undone: red in every look. On a toast, it stays longer and is announced at once.

(word-success)=
## success

A role.

What went well: green.

(word-warning)=
## warning

A role.

What needs care: amber.

(word-muted)=
## muted

A role; a flag, of [`video`](#style-video) and [`audio`](#style-audio).

Less to the eye: grey. On a video or a sound, it plays without its sound until the person turns it on.

(word-small)=
## small

A size.

Smaller: a compact button, a lower scroll.

(word-medium)=
## medium

A size.

The size in between.

(word-large)=
## large

A size.

Larger.

(word-left)=
## left

An alignment of the children.

The children start at the left.

(word-center)=
## center

An alignment of the children.

The children are centered.

(word-right)=
## right

An alignment of the children.

The children go to the right.

(word-spread)=
## spread

An alignment of the children.

The children spread over the whole width: the first at the left, the last at the right.

(word-top)=
## top

A vertical alignment of a row's children.

The children of a row line up at the top.

(word-middle)=
## middle

A vertical alignment of a row's children.

The children of a row line up in the middle.

(word-bottom)=
## bottom

A vertical alignment of a row's children.

The children of a row line up at the bottom.

(word-fill)=
## fill

A flag, of [`face`](#style-face).

Takes all the width it can.

(word-fit)=
## fit

A flag, of [`face`](#style-face).

Takes the height the window has left, and its children scroll inside it. A `widget` with `fit` gives that
height to its element, which scrolls itself, as a code editor or a map does. Inside a pane of a `grid fit`,
a face with `fit` takes the height the pane has left: `scroll fit [...]` above a row with a field is a chat.

(word-hidden)=
## hidden

A flag, of [`face`](#style-face).

Not shown; `face/hidden: false` shows it.

(word-disabled)=
## disabled

A flag, of [`face`](#style-face).

Shown, but it cannot be used.

(word-readonly)=
## readonly

A flag, of [`input`](#style-input).

Shown and sent with the form, but the person cannot change it, and no rule applies to it.

(word-inert)=
## inert

A flag, of [`face`](#style-face).

Shown as it is, but neither it nor its children can be used. With `on-select`, a click on it chooses the face
under the pointer, as on a designer's canvas: `preview: column inert on-select [pick-face event/face] [...]`.
The face chosen is its `selected`, and is marked; setting `selected` marks another.

(word-narrow-only)=
## narrow-only

A flag, of [`face`](#style-face).

Shown only on a narrow screen.

(word-wide-only)=
## wide-only

A flag, of [`face`](#style-face).

Hidden on a narrow screen.

(word-linked)=
## linked

A flag, of [`tile`](#style-tile).

Marks a tile with an arrow: it stands for something kept elsewhere, like a shortcut.

(word-mark)=
## mark

A word followed by its value, of [`tile`](#style-tile).

`tile #folder "Records" [...] mark #list "List"`: a second icon, small, at the bottom right of the tile's icon,
so two tiles with the same icon tell what each one is. Its label, a text, a text per language or a word of the
dictionary, goes right after its icon, and a screen reader says it after the tile's: "Records, List". It goes
with `linked`, whose arrow is at the other corner.

(word-by)=
## by

A word followed by its value, of [`board`](#style-board).

The field that names the lane of each card of a board: `board jobs by status [...]`.

(word-card)=
## card

A word followed by its value, of [`board`](#style-board).

The fields a card of a board shows, as the columns of a list: `card [title "Job" who "Mechanic"]`.

(word-step)=
## step

A word followed by its value, of [`time`](#style-time) and [`slider`](#style-slider).

How far one move takes a slider: `slider volume "Volume" 0 50 step 5`. A number above 0; a decimal step gives
decimal values. On a `time`, the minutes between the times its list offers, from 1 to 720: `time start "Start"
step 15`.

(word-round)=
## round

A flag, of [`photo`](#style-photo) and [`image`](#style-image).

Cuts an image to a circle, as for a person's photo: `image %ada.jpg "Ada" 48x48 round`.

(word-count)=
## count

A flag, of [`title`](#style-title), [`heading`](#style-heading), [`text`](#style-text) and [`stat`](#style-stat).

A text, heading, title or stat whose number, percent or amount changes runs from the old one to the new, in about
half a second: `title count is [total]`. Not the first it shows, nor with less motion asked for.

(word-bold)=
## bold

A flag, of [`text`](#style-text).

A text with heavier letters, as the label over a number or the name in a line: `text "Takings" muted bold`.
Headings and titles are bold already.

(word-shrink)=
## shrink

A flag, of [`title`](#style-title), [`heading`](#style-heading) and [`text`](#style-text).

A text, heading or title on one line, its letters as large as its width lets the line be, never larger than its
own size nor smaller than about half of it (then it ends in `…`): `title shrink is [total]`. In a row it takes an
equal share of what is left.

(word-stretch)=
## stretch

A flag, of [`canvas`](#style-canvas).

A canvas as wide as it can be and as tall as its extent: `canvas 100x32 stretch [line 0x28 50x10 100x4]`. It is
drawn again at each width; its points spread across it, while its lines, dots and text keep their size.

(word-rail)=
## rail

A flag, of [`column`](#style-column).

On a `column`: its children go down a line, each with a mark on it, and the role of a child paints its mark; a
screen reader hears a list. `column rail [text "Booked in" text "On the stand"]`.

(word-drag)=
## drag

A flag, of [`face`](#style-face).

It can be dragged: it carries its value, or the row in a table, list or tree.

(word-drop)=
## drop

A flag, of [`face`](#style-face).

Things can be dropped on it: its `on-drop` runs.

(word-reorder)=
## reorder

A flag, of [`face`](#style-face).

Its children, or its rows, can be moved around: its `on-reorder` runs.

(word-resize)=
## resize

A flag, of [`grid`](#style-grid).

A grid shows a handle between two columns: dragged, or moved with the arrow keys, it makes one wider.
It sizes the column of a set width (`small`, `medium`, `large`), or the left one of two weighted
columns, which keeps the width from then on. A double click gives that column back its width. The
browser keeps the widths, so the page opens as the user left it. On a narrow screen there are no
handles: the grid shows one column.

(word-multiple)=
## multiple

A flag, of [`upload`](#style-upload) and [`lookup`](#style-lookup).

An upload or a lookup takes more than one.

(word-sortable)=
## sortable

A flag, of [`table`](#style-table).

A table whose headers sort the rows it has, without the program. See `on-sort` for the program to sort them.

(word-newest)=
## newest

An order of a timeline.

A timeline whose newest rows come first, as it starts.

(word-oldest)=
## oldest

An order of a timeline.

A timeline whose oldest rows come first, as a story is told.

(word-relative)=
## relative

A flag, of [`timeline`](#style-timeline).

A timeline whose times less than a day ago say how long ago they were, `5 minutes ago`, and keep saying it as time
goes by; older ones show the time on the clock, as their day is said above them.

(word-stacked)=
## stacked

A flag, of [`chart`](#style-chart).

A chart whose series sit on top of each other, so each bar or area shows the total too.

(word-segmented)=
## segmented

A flag, of [`radio`](#style-radio).

A radio whose options are buttons joined in a bar, the chosen one pressed, as the switch between the views of a
page: `radio view "View" ["Design" "Split" "Code"] segmented`. Its text is read out, not shown.

(word-bar)=
## bar

A kind of chart.

A chart of bars, side by side for each label.

(word-line)=
## line

A kind of chart.

A chart of lines, with a dot for each value.

(word-area)=
## area

A kind of chart.

A chart of lines filled below.

(word-pie)=
## pie

A kind of chart.

A chart of slices, one for each label, of the first series.

(word-required)=
## required

A rule, of [`input`](#style-input).

The field must have a value.

(word-email)=
## email

A rule, of [`field`](#style-field).

The text must be an email address.

(word-iban)=
## iban

A rule, made with [`rule`](#fn-rule) as a program would make one.

The text must be an IBAN: of a country that has them, of its length, with the right check digits
([`iban?`](#fn-iban-3f)). Spaces between the groups are fine.

(word-url)=
## url

A rule, of [`field`](#style-field).

The text must be a web address.

(word-integer)=
## integer

A rule, of [`field`](#style-field) and [`number`](#style-number).

The text must be a whole number.

(word-min)=
## min

A rule, of [`number`](#style-number), [`money`](#style-money), [`date`](#style-date), [`date-range`](#style-date-range), [`time`](#style-time) and [`rows`](#style-rows).

`min 18`: the value must be at least that. On `rows`, the fewest rows; on `date-range`, its start. Numbers,
amounts, dates and times.

(word-max)=
## max

A rule, of [`number`](#style-number), [`money`](#style-money), [`date`](#style-date), [`date-range`](#style-date-range), [`time`](#style-time) and [`rows`](#style-rows).

`max 99`: the value must be at most that. On `rows`, the most rows; on `date-range`, its end.

(word-length)=
## length

A rule, of [`field`](#style-field), [`password`](#style-password) and [`area`](#style-area).

`length 8 64`: the text must have from 8 to 64 characters; `length 5`, exactly 5.

(word-pattern)=
## pattern

A rule, of [`field`](#style-field), [`password`](#style-password) and [`area`](#style-area).

`pattern [some digit]`: the text must match the rule, as `parse` reads it.

(word-match)=
## match

A rule, of [`input`](#style-input).

`match password`: the value must be the same as the field named.

(word-check)=
## check

A rule, of [`input`](#style-input).

`check [value <> "admin"]`: the block gives true when the value is good, or the message to show.

(word-check-async)=
## check-async

A rule, of [`input`](#style-input).

`check-async [not taken? value]`: like `check`, but it may wait, for a server with `fetch`; the field shows that
it is checking. It runs when the person leaves the field and when a form is sent. If the value changes while a
check waits, only the newest check gives its answer: a slow answer about the old value never shows on the new
one. Of several `check-async` on a field, the first that finds a problem is the one shown. A check that fails
with an error stops showing that it is checking, and the error goes on as any other. An empty field is not
checked and keeps no old answer.

(word-calc)=
## calc

A word followed by a block, after any face.

`calc [values/qty * values/price]`: the value is the formula's, worked out again whenever what it reads
changes, as with [`is`](#word-is); the person cannot change it. A formula that fails, or lacks a value,
leaves the field empty, with no message.

(word-is)=
## is

A word followed by a block, after any face.

`text is [rejoin ["Hello, " name/value]]`: the face shows what the block gives, worked out when the face is
shown and again whenever something the block reads changes. It sets the face's main facet: `data` for a
table, list, tree, chart or orbit, `draw` for a canvas, `value` for a field and the rest of the inputs, a progress, an
image, a video or a sound, and `text` for everything else. Unlike `calc`, a field with `is` can still be typed
in; what it reads changing gives it the block's value again.

(word-react)=
## react

A word followed by a block, after any face.

`react [face/disabled: not values/email]`: the block runs when the face is shown and again whenever something
it reads changes; `face` is the face it follows. `react later [...]` runs only on a change, not when shown.
What a block reads is found by reading it, not by running it: every path in it, also inside its inner blocks,
that starts with a face's label (`total/text`), with `face` (`face/value`) or with `values` (`values/qty`, the
value of the field of that name). It runs at the end of the round in which that changed, before the screen is
drawn again, once per change however many of the things it reads changed. A reaction that sets what another
reads runs first, whatever the order of the faces. Changing a series in place is a change too: `append
name/text "x"`, or `append first values/items 4` to a block inside the block read (see `version-of`), and the change alone runs it, with no field set. Two reactions that set what the other reads would never
end: the second time round one of them is left out, and the console says where it is. A round checks each
reaction once and then only those that read what a reaction that ran set, so its time grows with what runs,
not with the square of the reactions on the page.

(word-width)=
## width

A word followed by its value, of [`face`](#style-face).

`width small`, `medium` or `large`: how wide a field, or a view, is.

(word-pad)=
## pad

A word followed by its value, of [`container`](#style-container).

`pad 4`: the room inside it, a step of the spacing scale from 0 to 7, or `none` and `wide`.

(word-gap)=
## gap

A word followed by its value, of [`container`](#style-container).

`gap 2`: the room between its children, on the same scale as `pad`.

(word-menu)=
## menu

A word followed by its value, of [`face`](#style-face).

`menu ["Edit" edit "Delete" delete]`: on a button or a link, the menu it opens; on anything else, its context
menu. Each item is a text and the word that `on-menu` receives in `event/picked`, with an icon before the text if
it has one: `#trash "Delete" delete`. `danger` before an item says it removes or cannot be undone, and shows it
red: `danger #trash "Delete" delete`. `---` draws a line between items, and a block after a text in place of the
word is a submenu.

Code may give a face a menu, or another one, at any time, written the same way: `actions/menu: ["Copy" copy]`.
The face opens the menu it has when it is clicked, even one it had none of when it was shown.

On a phone, swiping a row of a table or list with a menu to the left shows its first two items behind it, as
buttons, the `danger` ones red, and *More* for the whole menu when it has others. A swipe less than halfway
goes back, as does a touch anywhere else or a scroll.

(word-accept)=
## accept

A word followed by its value, of [`upload`](#style-upload) and [`photo`](#style-photo).

`accept ["pdf" "image/*"]`: the files an upload takes.

(word-known)=
## known

A word followed by its value, of [`lookup`](#style-lookup).

`known #("ada" "Ada Lovelace")`: what each value of a lookup shows as, for the values already chosen.

(word-links)=
## links

A word followed by its value, of [`lookup`](#style-lookup).

`links #("ada" client/ada)`: the screen each value of a read-only lookup links to, written as for `link`.

(word-sorted)=
## sorted

A word followed by its value, of [`table`](#style-table).

`sorted [due desc]`: the order a table shows, by a column, `asc` or `desc`.

(word-key)=
## key

A word followed by its value, of [`rows-face`](#style-rows-face), [`button`](#style-button), [`link`](#style-link) and [`board`](#style-board).

`key code`: the field that tells the rows of a table, list or tree apart, `id` unless told; a row keeps its
place in the selection and moves as itself when the rows change. `key "Ctrl+S"`: the shortcut of a button or
link.

(word-role-by)=
## role-by

A word followed by its value, of [`rows-face`](#style-rows-face) and [`board`](#style-board).

`role-by tone`: the field of each row whose value, `success`, `danger`, `warning`, `primary`, `accent` or
`muted`, as a word or a text, is the role a table, list, board, tree or timeline paints that row or card in. In a block of
columns, after a column, `[state "State" role-by tone]`, it paints that column's cell instead. Any other value
paints nothing.

(word-trend)=
## trend

A word followed by its value, of [`stat`](#style-stat).

`trend [3 5 4 8]`: the numbers a stat had, oldest first, numbers or amounts, two at least. It draws them as a
small line at the stat's foot, ending on a dot, in the colour of its role.

(word-morph)=
## morph

A word followed by its value, of [`face`](#style-face).

`morph 'logo`: a name the face shares with a face of the next screen; as the screen changes, one becomes the
other, moving and growing from where it was to where the other is. `morph [client id]` is a name made of a
word, as written, and the values after it, evaluated when the screen is entered, so the title of a client's
screen can carry the client's id. On a table or a list, `morph 'client` names each row by the word and its
key, `client 7`, so the row chosen becomes the face of the next screen named `[client id]`. Only faces on
show in both screens move; the rest go with their screen.

(word-with)=
## with

A word followed by its value, of [`face`](#style-face).

`with [role: 'danger]`: a block run bound to the face once the rest of it is read, so its set-words set the
face's fields. It is the last way out, for a field no word of the style sets; `trebol check` does not run it and a
designer shows it as code, so a style that needs a field often is better given a word for it in its `takes:`.

(word-rate)=
## rate

A word followed by its value, of [`face`](#style-face).

`rate 2` makes a face tick twice a second, `rate 0:00:30` every half minute, as in R2 and Red; each tick runs its
`on-time` while the face is on the page. A new rate starts the ticks again, `face/rate: none` stops them, and a
face taken off the page stops by itself.

(word-poster)=
## poster

A word followed by its value, of [`video`](#style-video).

`poster %intro.jpg`: the image a video shows before it plays.

(word-captions)=
## captions

A word followed by its value, of [`video`](#style-video).

`captions %intro.vtt`: a video's captions, in WebVTT, in the active language; `captions [en %en.vtt es %es.vtt]`
gives one per language, and the one shown follows the active language.

(word-loop)=
## loop

A flag, of [`video`](#style-video) and [`audio`](#style-audio).

A video or a sound starts again when it ends.

(word-autoplay)=
## autoplay

A flag, of [`video`](#style-video) and [`audio`](#style-audio).

A video or a sound plays as soon as it can, and always without its sound: browsers let nothing else play on
its own.

(word-on-back)=
## on-back

An event: the block after it runs when it happens.

On an orbit: when the person steps back to a node of the trail, by picking it or with Escape. `value` is
its id.

(word-on-change)=
## on-change

An event: the block after it runs when it happens.

When its value changes; on `screens`, after entering each screen.

(word-on-close)=
## on-close

An event: the block after it runs when it happens.

When a dialog closes.

(word-on-dbl-click)=
## on-dbl-click

An event: the block after it runs when it happens.

When it is double-clicked.

(word-on-drop)=
## on-drop

An event: the block after it runs when it happens.

When something is dropped on it: `event/dropped` is what, `event/source` the face it came from, and
`event/index` where among the children or rows it goes.

(word-on-end)=
## on-end

An event: the block after it runs when it happens.

When a video or a sound reaches its end; with `loop`, never.

(word-on-enter)=
## on-enter

An event: the block after it runs when it happens.

On a screen of `screens`: when the screen is entered, before it shows. A `go` in it goes elsewhere instead.

(word-on-expand)=
## on-expand

An event: the block after it runs when it happens.

When a row of a tree opens.

(word-on-find)=
## on-find

An event: the block after it runs when it happens.

On a view: when the user types in the palette (Ctrl+K, ⌘K on a Mac), with what was typed as `value`. It gives
a block of a label and a link for each thing it found, as a breadcrumb's items: `["Ada Lovelace" [booking 1]]`.
They show under the screens, buttons and menu items that match, and choosing one goes to its link. It may wait
for a server.

(word-on-focus)=
## on-focus

An event: the block after it runs when it happens.

When it gets the focus.

(word-on-key)=
## on-key

An event: the block after it runs when it happens.

When a key is pressed: `event/key` says which, `event/ctrl?`, `event/shift?`, `event/alt?` and `event/meta?` the keys
held with it, and `event/typing?` is `true` when it is pressed in a box the user types in, which undoes its own
typing with Ctrl+Z.

(word-on-leave)=
## on-leave

An event: the block after it runs when it happens.

On a screen of `screens`: before the page leaves it, by `go`, back or forward, the browser's buttons or a
link. `false` (or `'continue`, as Red's `on-close`) keeps the screen; anything else lets the page go. It may
wait for a dialog first. Without it, a screen marked with `unsaved yes` asks the user.

(word-on-menu)=
## on-menu

An event: the block after it runs when it happens.

When an item of its menu is chosen: `event/picked` is its word.

(word-on-over)=
## on-over

An event: the block after it runs when it happens.

When the pointer goes over it.

(word-on-reorder)=
## on-reorder

An event: the block after it runs when it happens.

When one of its children or rows was moved, which the dialect has already done: `event/from` and
`event/to` are the positions.

(word-on-search)=
## on-search

An event: the block after it runs when it happens.

When the person types in a lookup: the block gives what was found for `query`.

(word-on-select)=
## on-select

An event: the block after it runs when it happens.

When a row of a table, list or tree is chosen: it is in `row`. On an `inert` face, when a face inside it is
clicked: it is in `event/face`.

(word-on-sort)=
## on-sort

An event: the block after it runs when it happens.

When a header of a table is chosen: `event/column` and `event/order` say how to sort, and the program sorts.

(word-on-time)=
## on-time

An event: the block after it runs when it happens.

At each tick of its `rate`.

(word-on-unfocus)=
## on-unfocus

An event: the block after it runs when it happens.

When it loses the focus.
