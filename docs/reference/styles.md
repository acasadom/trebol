<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Styles

The styles of the UI dialect: the kinds of thing a layout is made of. A layout names a style and follows it with
what that face needs, in any order: a label for the code (`total:` before the style), a field name (the first
word after an input style), texts (a string, a text per language, or a quoted word of the dictionary), an icon
(`#search`), words of the dialect (see [the words of the dialect](dialect.md)), and blocks: the children of a
container, the items of a choice or a menu, and the action, the block at the end. `stylize` makes a style of
your own from one of these. See [building screens](../ui/01-first-screen.md).

(style-view)=
## view

The whole page: its children one under another. `view [...]` shows it; words before its first face (a width,
`on-key`) are the view's own.

(style-column)=
## column

Children one under another.

(style-row)=
## row

Children side by side, wrapping onto the next line when they do not fit. With fields in it, they line up on
their controls; `top`, `middle` and `bottom` line them up otherwise. On a phone, a row with fields stacks them.

(style-form)=
## form

A form: its fields, with their labels beside them on a wide screen and above them on a narrow one. Its fields are
checked together, and its `submit` runs only when all of them are valid, with their `values`.

(style-panel)=
## panel

A group on a raised background, with a title when it is given a text.

(style-grid)=
## grid

Columns: `grid 3 [...]` gives three equal ones, `grid [1 4 1] [...]` the weight of each. On a narrow screen, as
many as fit, down to one.

(style-scroll)=
## scroll

An area with a scroll of its own, at most 400 pixels high (`small` 240, `large` 640). Its text names it for
screen readers, and the keyboard scrolls it.

(style-desktop)=
## desktop

A mat that takes all the height left on the page, with the image it is given (`desktop %mat.png [...]`) or a
color of the theme, on which tiles are laid from left to right. Its `menu` is the context menu.

(style-title)=
## title

The title of the page or of a screen: the text the browser shows for it, too.

(style-heading)=
## heading

A heading inside a page.

(style-text)=
## text

Text. A date, a time, a number or an amount is shown in the format of the active language.

(style-divider)=
## divider

A line between what comes before and after.

(style-field)=
## field

A line of text. Its value is a string, or `none` when empty.

(style-password)=
## password

A field whose text is hidden.

(style-number)=
## number

A field for a number. Its value is an integer or a decimal number; text that is not one stays on screen with its
message.

(style-money)=
## money

A field for an amount: `money price "Price" EUR`. Its value is an exact `money!`; it shows formatted, and while
it is being edited, as a plain number in the language's way.

(style-date)=
## date

A field for a date, with a calendar. Its value is a `date!`; it is typed in the order of the active language, or
as `2026-12-02`.

(style-area)=
## area

Several lines of text.

(style-rich)=
## rich

Rich text: headings, bold, italic, lists and links. Its value is Markdown, a plain string; `readonly` shows it
formatted.

(style-check)=
## check

A check box. Its value is `true` or `false`.

(style-choice)=
## choice

A list to choose one from: `choice bike "Bike" ["Road" "City"]`. An option is a string, both its value and its
text, or a map with a `value` and a `text`.

(style-toggle)=
## toggle

A switch. Its value is `true` or `false`.

(style-radio)=
## radio

Options to choose one from, all shown: the same options as a `choice`.

(style-upload)=
## upload

A button to choose files, which is also a place to drop them. Its value is a block of objects with the `name`,
`size`, `type` and `file` of each; `multiple` takes more than one, `accept ["pdf" "image/*"]` says which.

(style-lookup)=
## lookup

A field that searches as the person types: its `on-search` gives what was found, and the person picks one, or
several with `multiple`. `known` says what each value shows as; `links`, the screen each links to when it is
read only.

(style-progress)=
## progress

A bar: its value is a percent or a number from 0 to 1; with `none`, it moves without saying how far.

(style-image)=
## image

An image, from a file or an address: `image %logo.png`.

(style-icon)=
## icon

An icon of the set Trebol brings, `icon #heart`, drawn in the color of its role.

(style-button)=
## button

A button: the block after it runs when it is pressed. With a `menu`, it opens the menu instead.

(style-link)=
## link

A link to a screen of the app: `link "Clients" 'clients`. It is a link for the browser too, so it opens in a
new tab when the person asks.

(style-tile)=
## tile

A large icon with its name under it, for a desktop: `tile #folder "Reports" [...]`. `linked` marks with an arrow
one that stands for something kept elsewhere.

(style-table)=
## table

Rows of data in columns: `table board [customer "Customer" due "Due back"]` names the field of each column and
its header; its `data` is a block of maps or objects. On a narrow screen, each row is a card. `on-select` lets the
rows be chosen; `sortable` or `on-sort` let the headers sort them; `totals` is a row shown at the foot.

(style-list)=
## list

The same rows as a table, as a list: the first field stands out and the rest go on a second line.

(style-tabs)=
## tabs

It starts with `value: 1`.

Tabs, each with its title and its block: `tabs ["General" [...] "Advanced" [...]]`. Its value is the number of
the tab shown.

(style-tab)=
## tab

One tab of `tabs`, which makes it: it is not written in a layout.

(style-toolbar)=
## toolbar

A row of buttons that the keyboard reaches with one Tab and moves through with the arrows; `---` puts a separator.
On a narrow screen, a button with an icon shows only the icon.

(style-breadcrumb)=
## breadcrumb

Where the person is: `breadcrumb ["Home" home "Clients" clients "Ada"] [go value]`. Each item is a text and the
word its action receives; the last, without a word, is where they are.

(style-tree)=
## tree

Rows with rows inside, in their `children`, which open and close. Like a table, its rows can be chosen and
dragged.

(style-screens)=
## screens

The screens of an app, one shown at a time, each with a link of its own: `screens [home "Home" [...] client [id]
"Client" [...]]`. `go` goes to one; its value is the route shown.

(style-screen)=
## screen

One screen of `screens`, which makes it: it is not written in a layout.

(style-rows)=
## rows

A field made of rows the person adds and removes, each with the fields of its block:
`rows lines "Lines" min 1 [field part "Part" number qty "Qty"]`. Its value is a block with a map for each row.

(style-entry)=
## entry

One row of `rows`, which makes it: it is not written in a layout.

(style-submit)=
## submit

Made from [`button`](#style-button). It starts with `role: primary`, `submit: true`.

The button of a form: it runs its block only when every field of the form is valid, and Enter in any field
presses it. Its block sees the form's `values`.

(style-dialog)=
## dialog

It starts with `hidden: true`.

A window over the page, hidden until `open` shows it and `close` hides it, with a title when it is given a text.
On a phone, it takes the whole screen.

(style-split)=
## split

It starts with `value: 1`.

Two panes side by side, with a handle between them that the mouse or the arrows move. On a narrow screen one is
shown at a time: the one its value says, 1 or 2; the second has a button back to the first.
