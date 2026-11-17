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

A role; a flag of a video or a sound.

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

A flag.

Takes all the width it can.

(word-fit)=
## fit

A flag.

Takes the height the window has left, and its children scroll inside it.

(word-hidden)=
## hidden

A flag.

Not shown; `face/hidden: false` shows it.

(word-disabled)=
## disabled

A flag.

Shown, but it cannot be used.

(word-readonly)=
## readonly

A flag.

Shown and sent with the form, but the person cannot change it, and no rule applies to it.

(word-inert)=
## inert

A flag.

Shown as it is, but neither it nor its children can be used.

(word-narrow-only)=
## narrow-only

A flag.

Shown only on a narrow screen.

(word-wide-only)=
## wide-only

A flag.

Hidden on a narrow screen.

(word-linked)=
## linked

A flag.

Marks a tile with an arrow: it stands for something kept elsewhere, like a shortcut.

(word-mark)=
## mark

A word followed by its value.

`tile #folder "Records" [...] mark #list "List"`: a second icon, small, at the bottom right of the tile's icon,
so two tiles with the same icon tell what each one is. Its label, a text, a text per language or a word of the
dictionary, goes right after its icon, and a screen reader says it after the tile's: "Records, List". It goes
with `linked`, whose arrow is at the other corner.

(word-round)=
## round

A flag.

Cuts an image to a circle, as for a person's photo: `image %ada.jpg "Ada" 48x48 round`.

(word-count)=
## count

A flag.

A text, heading or title whose number, percent or amount changes runs from the old one to the new, in about
half a second: `title count is [total]`. Not the first it shows, nor with less motion asked for.

(word-drag)=
## drag

A flag.

It can be dragged: it carries its value, or the row in a table, list or tree.

(word-drop)=
## drop

A flag.

Things can be dropped on it: its `on-drop` runs.

(word-reorder)=
## reorder

A flag.

Its children, or its rows, can be moved around: its `on-reorder` runs.

(word-multiple)=
## multiple

A flag.

An upload or a lookup takes more than one.

(word-sortable)=
## sortable

A flag.

A table whose headers sort the rows it has, without the program. See `on-sort` for the program to sort them.

(word-stacked)=
## stacked

A flag.

A chart whose series sit on top of each other, so each bar or area shows the total too.

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

A rule.

The field must have a value.

(word-email)=
## email

A rule.

The text must be an email address.

(word-iban)=
## iban

A rule, made with [`rule`](#fn-rule) as a program would make one.

The text must be an IBAN: of a country that has them, of its length, with the right check digits
([`iban?`](#fn-iban-3f)). Spaces between the groups are fine.

(word-url)=
## url

A rule.

The text must be a web address.

(word-integer)=
## integer

A rule.

The text must be a whole number.

(word-min)=
## min

A word followed by its value.

`min 18`: the value must be at least that. On `rows`, the fewest rows. Numbers, amounts and dates.

(word-max)=
## max

A word followed by its value.

`max 99`: the value must be at most that. On `rows`, the most rows.

(word-length)=
## length

A word followed by its value.

`length 8 64`: the text must have from 8 to 64 characters; `length 5`, exactly 5.

(word-pattern)=
## pattern

A word followed by its value.

`pattern [some digit]`: the text must match the rule, as `parse` reads it.

(word-match)=
## match

A word followed by its value.

`match password`: the value must be the same as the field named.

(word-check)=
## check

A word followed by its value.

`check [value <> "admin"]`: the block gives true when the value is good, or the message to show.

(word-check-async)=
## check-async

A word followed by its value.

`check-async [not taken? value]`: like `check`, but it may wait, for a server with `fetch`; the field shows that
it is checking.

(word-calc)=
## calc

A word followed by its value.

`calc [values/qty * values/price]`: the value is the formula's, worked out again whenever what it reads
changes, as with [`is`](#word-is); the person cannot change it. A formula that fails, or lacks a value,
leaves the field empty, with no message.

(word-is)=
## is

A word followed by its value.

`text is [rejoin ["Hello, " name/value]]`: the face shows what the block gives, worked out when the face is
shown and again whenever something the block reads changes. It sets the face's main facet: `data` for a
table, list, tree, chart or orbit, `draw` for a canvas, `value` for a field and the rest of the inputs, a progress, an
image, a video or a sound, and `text` for everything else. Unlike `calc`, a field with `is` can still be typed
in; what it reads changing gives it the block's value again.

(word-react)=
## react

A word followed by its value.

`react [face/disabled: not values/email]`: the block runs when the face is shown and again whenever something
it reads changes; `face` is the face it follows. `react later [...]` runs only on a change, not when shown.
What a block reads is found by reading it, not by running it: every path in it, also inside its inner blocks,
that starts with a face's label (`total/text`), with `face` (`face/value`) or with `values` (`values/qty`, the
value of the field of that name). It runs at the end of the round in which that changed, before the screen is
drawn again, once per change however many of the things it reads changed. A reaction that sets what another
reads runs first, whatever the order of the faces. Changing a series in place (`append name/value "x"`) is not
a change: give the facet a new value, as elsewhere. Two reactions that set what the other reads would never
end: the second time round one of them is left out, and the console says where it is.

(word-width)=
## width

A word followed by its value.

`width small`, `medium` or `large`: how wide a field, or a view, is.

(word-pad)=
## pad

A word followed by its value.

`pad 4`: the room inside it, a step of the spacing scale from 0 to 7, or `none` and `wide`.

(word-gap)=
## gap

A word followed by its value.

`gap 2`: the room between its children, on the same scale as `pad`.

(word-menu)=
## menu

A word followed by its value.

`menu ["Edit" edit "Delete" delete]`: on a button or a link, the menu it opens; on anything else, its context
menu. Each item is a text and the word that `on-menu` receives in `event/picked`.

(word-accept)=
## accept

A word followed by its value.

`accept ["pdf" "image/*"]`: the files an upload takes.

(word-known)=
## known

A word followed by its value.

`known #("ada" "Ada Lovelace")`: what each value of a lookup shows as, for the values already chosen.

(word-links)=
## links

A word followed by its value.

`links #("ada" client/ada)`: the screen each value of a read-only lookup links to, written as for `link`.

(word-sorted)=
## sorted

A word followed by its value.

`sorted [due desc]`: the order a table shows, by a column, `asc` or `desc`.

(word-key)=
## key

A word followed by its value.

`key code`: the field that tells the rows of a table, list or tree apart, `id` unless told; a row keeps its
place in the selection and moves as itself when the rows change. `key "Ctrl+S"`: the shortcut of a button or
link.

(word-morph)=
## morph

A word followed by its value.

`morph 'logo`: a name the face shares with a face of the next screen; as the screen changes, one becomes the
other, moving and growing from where it was to where the other is. `morph [client id]` is a name made of a
word, as written, and the values after it, evaluated when the screen is entered, so the title of a client's
screen can carry the client's id. On a table or a list, `morph 'client` names each row by the word and its
key, `client 7`, so the row chosen becomes the face of the next screen named `[client id]`. Only faces on
show in both screens move; the rest go with their screen.

(word-poster)=
## poster

A word followed by its value.

`poster %intro.jpg`: the image a video shows before it plays.

(word-captions)=
## captions

A word followed by its value.

`captions %intro.vtt`: a video's captions, in WebVTT, in the active language; `captions [en %en.vtt es %es.vtt]`
gives one per language, and the one shown follows the active language.

(word-loop)=
## loop

A flag of a video or a sound.

A video or a sound starts again when it ends.

(word-autoplay)=
## autoplay

A flag of a video or a sound.

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

When a key is pressed: `event/key` says which.

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

When a row of a table, list or tree is chosen: it is in `row`.

(word-on-sort)=
## on-sort

An event: the block after it runs when it happens.

When a header of a table is chosen: `event/column` and `event/order` say how to sort, and the program sorts.

(word-on-unfocus)=
## on-unfocus

An event: the block after it runs when it happens.

When it loses the focus.
