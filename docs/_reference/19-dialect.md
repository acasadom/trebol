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
the word it may have meant when one is close: `buton is not a style; did you mean button?`. The faces of a
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

Takes the height the window has left, and its children scroll inside it.

## hidden

Not shown; `face/hidden: false` shows it.

## disabled

Shown, but it cannot be used.

## readonly

Shown and sent with the form, but the person cannot change it, and no rule applies to it.

## inert

Shown as it is, but neither it nor its children can be used.

## narrow-only

Shown only on a narrow screen.

## wide-only

Hidden on a narrow screen.

## linked

Marks a tile with an arrow: it stands for something kept elsewhere, like a shortcut.

## round

Cuts an image to a circle, as for a person's photo: `image %ada.jpg "Ada" 48x48 round`.

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

## url

The text must be a web address.

## integer

The text must be a whole number.

## min

`min 18`: the value must be at least that. On `rows`, the fewest rows. Numbers, amounts and dates.

## max

`max 99`: the value must be at most that. On `rows`, the most rows.

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
menu. Each item is a text and the word that `on-menu` receives in `event/picked`.

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

## on-focus

When it gets the focus.

## on-key

When a key is pressed: `event/key` says which.

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

When a row of a table, list or tree is chosen: it is in `row`.

## on-sort

When a header of a table is chosen: `event/column` and `event/order` say how to sort, and the program sorts.

## on-unfocus

When it loses the focus.
