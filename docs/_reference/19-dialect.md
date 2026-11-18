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

## primary

The color of the main thing to do: a button that stands out. A `submit` is primary by itself.

## accent

The theme's second color.

## danger

What removes or cannot be undone: red in every look. On a toast, it stays longer and is announced at once.

## success

What went well: green.

## warning

What needs care: amber.

## muted

Less to the eye: grey. On a video or a sound, it plays without its sound until the person turns it on.

## small

Smaller: a compact button, a lower scroll.

## medium

The size in between.

## large

Larger.

## left

The children start at the left.

## center

The children are centered.

## right

The children go to the right.

## spread

The children spread over the whole width: the first at the left, the last at the right.

## top

The children of a row line up at the top.

## middle

The children of a row line up in the middle.

## bottom

The children of a row line up at the bottom.

## fill

Takes all the width it can.

## fit

Takes the height the window has left, and its children scroll inside it. A `widget` with `fit` gives that
height to its element, which scrolls itself, as a code editor or a map does. Inside a pane of a `grid fit`,
a face with `fit` takes the height the pane has left: `scroll fit [...]` above a row with a field is a chat.

## hidden

Not shown; `face/hidden: false` shows it.

## disabled

Shown, but it cannot be used.

## readonly

Shown and sent with the form, but the person cannot change it, and no rule applies to it.

## inert

Shown as it is, but neither it nor its children can be used. With `on-select`, a click on it chooses the face
under the pointer, as on a designer's canvas: `preview: column inert on-select [pick-face event/face] [...]`.
The face chosen is its `selected`, and is marked; setting `selected` marks another.

## narrow-only

Shown only on a narrow screen.

## wide-only

Hidden on a narrow screen.

## linked

Marks a tile with an arrow: it stands for something kept elsewhere, like a shortcut.

## mark

`tile #folder "Records" [...] mark #list "List"`: a second icon, small, at the bottom right of the tile's icon,
so two tiles with the same icon tell what each one is. Its label, a text, a text per language or a word of the
dictionary, goes right after its icon, and a screen reader says it after the tile's: "Records, List". It goes
with `linked`, whose arrow is at the other corner.

## by

The field that names the lane of each card of a board: `board jobs by status [...]`.

## card

The fields a card of a board shows, as the columns of a list: `card [title "Job" who "Mechanic"]`.

## step

How far one move takes a slider: `slider volume "Volume" 0 50 step 5`. A number above 0; a decimal step gives
decimal values. On a `time`, the minutes between the times its list offers, from 1 to 720: `time start "Start"
step 15`.

## round

Cuts an image to a circle, as for a person's photo: `image %ada.jpg "Ada" 48x48 round`.

## count

A text, heading or title whose number, percent or amount changes runs from the old one to the new, in about
half a second: `title count is [total]`. Not the first it shows, nor with less motion asked for.

## drag

It can be dragged: it carries its value, or the row in a table, list or tree.

## drop

Things can be dropped on it: its `on-drop` runs.

## reorder

Its children, or its rows, can be moved around: its `on-reorder` runs.

## multiple

An upload or a lookup takes more than one.

## sortable

A table whose headers sort the rows it has, without the program. See `on-sort` for the program to sort them.

## stacked

A chart whose series sit on top of each other, so each bar or area shows the total too.

## segmented

A radio whose options are buttons joined in a bar, the chosen one pressed, as the switch between the views of a
page: `radio view "View" ["Design" "Split" "Code"] segmented`. Its text is read out, not shown.

## bar

A chart of bars, side by side for each label.

## line

A chart of lines, with a dot for each value.

## area

A chart of lines filled below.

## pie

A chart of slices, one for each label, of the first series.

## required

The field must have a value.

## email

The text must be an email address.

## iban

The text must be an IBAN: of a country that has them, of its length, with the right check digits
([`iban?`](#fn-iban-3f)). Spaces between the groups are fine.

## url

The text must be a web address.

## integer

The text must be a whole number.

## min

`min 18`: the value must be at least that. On `rows`, the fewest rows; on `date-range`, its start. Numbers,
amounts, dates and times.

## max

`max 99`: the value must be at most that. On `rows`, the most rows; on `date-range`, its end.

## length

`length 8 64`: the text must have from 8 to 64 characters; `length 5`, exactly 5.

## pattern

`pattern [some digit]`: the text must match the rule, as `parse` reads it.

## match

`match password`: the value must be the same as the field named.

## check

`check [value <> "admin"]`: the block gives true when the value is good, or the message to show.

## check-async

`check-async [not taken? value]`: like `check`, but it may wait, for a server with `fetch`; the field shows that
it is checking.

## calc

`calc [values/qty * values/price]`: the value is the formula's, worked out again whenever what it reads
changes, as with [`is`](#word-is); the person cannot change it. A formula that fails, or lacks a value,
leaves the field empty, with no message.

## is

`text is [rejoin ["Hello, " name/value]]`: the face shows what the block gives, worked out when the face is
shown and again whenever something the block reads changes. It sets the face's main facet: `data` for a
table, list, tree, chart or orbit, `draw` for a canvas, `value` for a field and the rest of the inputs, a progress, an
image, a video or a sound, and `text` for everything else. Unlike `calc`, a field with `is` can still be typed
in; what it reads changing gives it the block's value again.

## react

`react [face/disabled: not values/email]`: the block runs when the face is shown and again whenever something
it reads changes; `face` is the face it follows. `react later [...]` runs only on a change, not when shown.
What a block reads is found by reading it, not by running it: every path in it, also inside its inner blocks,
that starts with a face's label (`total/text`), with `face` (`face/value`) or with `values` (`values/qty`, the
value of the field of that name). It runs at the end of the round in which that changed, before the screen is
drawn again, once per change however many of the things it reads changed. A reaction that sets what another
reads runs first, whatever the order of the faces. Changing a series in place (`append name/value "x"`) is not
a change: give the facet a new value, as elsewhere. Two reactions that set what the other reads would never
end: the second time round one of them is left out, and the console says where it is.

## width

`width small`, `medium` or `large`: how wide a field, or a view, is.

## pad

`pad 4`: the room inside it, a step of the spacing scale from 0 to 7, or `none` and `wide`.

## gap

`gap 2`: the room between its children, on the same scale as `pad`.

## menu

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

## accept

`accept ["pdf" "image/*"]`: the files an upload takes.

## known

`known #("ada" "Ada Lovelace")`: what each value of a lookup shows as, for the values already chosen.

## links

`links #("ada" client/ada)`: the screen each value of a read-only lookup links to, written as for `link`.

## sorted

`sorted [due desc]`: the order a table shows, by a column, `asc` or `desc`.

## key

`key code`: the field that tells the rows of a table, list or tree apart, `id` unless told; a row keeps its
place in the selection and moves as itself when the rows change. `key "Ctrl+S"`: the shortcut of a button or
link.

## morph

`morph 'logo`: a name the face shares with a face of the next screen; as the screen changes, one becomes the
other, moving and growing from where it was to where the other is. `morph [client id]` is a name made of a
word, as written, and the values after it, evaluated when the screen is entered, so the title of a client's
screen can carry the client's id. On a table or a list, `morph 'client` names each row by the word and its
key, `client 7`, so the row chosen becomes the face of the next screen named `[client id]`. Only faces on
show in both screens move; the rest go with their screen.

## with

`with [role: 'danger]`: a block run bound to the face once the rest of it is read, so its set-words set the
face's fields. It is the last way out, for a field no word of the style sets; `trebol check` does not run it and a
designer shows it as code, so a style that needs a field often is better given a word for it in its `takes:`.

## poster

`poster %intro.jpg`: the image a video shows before it plays.

## captions

`captions %intro.vtt`: a video's captions, in WebVTT, in the active language; `captions [en %en.vtt es %es.vtt]`
gives one per language, and the one shown follows the active language.

## loop

A video or a sound starts again when it ends.

## autoplay

A video or a sound plays as soon as it can, and always without its sound: browsers let nothing else play on
its own.

## on-back

On an orbit: when the person steps back to a node of the trail, by picking it or with Escape. `value` is
its id.

## on-change

When its value changes; on `screens`, after entering each screen.

## on-close

When a dialog closes.

## on-dbl-click

When it is double-clicked.

## on-drop

When something is dropped on it: `event/dropped` is what, `event/source` the face it came from, and
`event/index` where among the children or rows it goes.

## on-end

When a video or a sound reaches its end; with `loop`, never.

## on-enter

On a screen of `screens`: when the screen is entered, before it shows. A `go` in it goes elsewhere instead.

## on-expand

When a row of a tree opens.

## on-find

On a view: when the user types in the palette (Ctrl+K, ⌘K on a Mac), with what was typed as `value`. It gives
a block of a label and a link for each thing it found, as a breadcrumb's items: `["Ada Lovelace" [booking 1]]`.
They show under the screens, buttons and menu items that match, and choosing one goes to its link. It may wait
for a server.

## on-focus

When it gets the focus.

## on-key

When a key is pressed: `event/key` says which, `event/ctrl?`, `event/shift?`, `event/alt?` and `event/meta?` the keys
held with it, and `event/typing?` is `true` when it is pressed in a box the user types in, which undoes its own
typing with Ctrl+Z.

## on-leave

On a screen of `screens`: before the page leaves it, by `go`, back or forward, the browser's buttons or a
link. `false` (or `'continue`, as Red's `on-close`) keeps the screen; anything else lets the page go. It may
wait for a dialog first. Without it, a screen marked with `unsaved yes` asks the user.

## on-menu

When an item of its menu is chosen: `event/picked` is its word.

## on-over

When the pointer goes over it.

## on-reorder

When one of its children or rows was moved, which the dialect has already done: `event/from` and
`event/to` are the positions.

## on-search

When the person types in a lookup: the block gives what was found for `query`.

## on-select

When a row of a table, list or tree is chosen: it is in `row`. On an `inert` face, when a face inside it is
clicked: it is in `event/face`.

## on-sort

When a header of a table is chosen: `event/column` and `event/order` say how to sort, and the program sorts.

## on-unfocus

When it loses the focus.
