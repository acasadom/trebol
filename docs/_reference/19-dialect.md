# Words of the dialect

The words a face takes after its style, besides texts, icons and blocks: roles, sizes, alignments, flags, rules
and events. Any of them goes with any style, and each does what it means where it means something. Some
take a value right after them: `min 18`, `width small`, `menu [...]`.

A few things are written without a word of their own: `global` before a label makes it a word of the whole
program and not only of the layout; `---` separates the items of a menu or the buttons of a toolbar; a word of
three capital letters after `money` is its currency, `EUR`.

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

Less to the eye: grey.

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

`calc [values/qty * values/price]`: the value is the formula's, worked out again whenever the values it reads
change; the person cannot change it.

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

## on-change

When its value changes; on `screens`, after entering each screen.

## on-close

When a dialog closes.

## on-dbl-click

When it is double-clicked.

## on-drop

When something is dropped on it: `event/dropped` is what, `event/source` the face it came from, and
`event/index` where among the children or rows it goes.

## on-enter

On a screen of `screens`: when the screen is entered, before it shows. A `go` in it goes elsewhere instead.

## on-expand

When a row of a tree opens.

## on-focus

When it gets the focus.

## on-key

When a key is pressed: `event/key` says which.

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
