# 1. A first screen

The first tutorial wrote the back office of **Cog & Chain**, the bicycle repair shop, in the console. This one
gives the shop its screens: a counter where a repair is booked in, the list of bikes in the workshop, the
quote a customer takes home. There is no HTML and no CSS on any page, only Trebol.

Every example on these pages runs right under its code. Type in its fields and press its buttons: it is the
real app, not a picture of one.

## An app is a folder

An app is a folder with a file called `app.trb` in it. In the `cog-and-chain` folder of the first tutorial
(the one where Trebol is installed), save this as `app.trb`:

```trebol-ui
Trebol [title: "Cog & Chain"]

view [
    title "Cog & Chain"
    text muted "Bicycle repairs, done right."
    button "Book a repair" [toast "Booked in"]
]
```

and serve the folder:

```sh
npx trebol dev
```

and open <http://localhost:5173/> in a browser. The page reloads by itself every time you save the file, so
leave it open beside your editor.

## Reading a view

`view` takes a block and shows it as the page. The block is written in Trebol's UI dialect: a list of
*faces*, each one a style word followed by what it needs, in any order.

- `title "Cog & Chain"` is the heading of the page. It also names the browser tab.
- `text muted "..."` is a paragraph. `muted` is its *role*: a quieter colour, for what matters less.
- `button "Book a repair" [...]` is a button, and the block after it is its *action*, run when the button is
  pressed. `toast` shows a short message at the edge of the screen and lets it go.

The block after `button` is plain Trebol, the same language as the first tutorial; only the block that
`view` reads is the dialect.

## Faces with names

A set-word before a face gives it a name, and the name reaches the face from any action in the same view. A
face is an object, so changing one of its fields with a path changes what the page shows:

```trebol-ui
view [
    title "Cog & Chain"
    status: text muted "The workshop is closed."
    row [
        button "Open" [status/text: "The workshop is open." status/role: 'success]
        button "Close" [status/text: "The workshop is closed." status/role: 'muted]
    ]
]
```

`row` lays out its faces side by side, where `view` stacks them. Roles are words, so the action sets one
with a lit-word: `'success` is green and `'muted` is grey, whatever the theme.

A name belongs to its view. Two views can each have a `status` without one touching the other, and code
outside the view does not see it. That keeps a large app's screens from tripping over each other's names;
when code outside a view does need a face, `global` before the name makes it a word of the whole program.

## Things you did not write

Look at the examples again in dark mode, or on a phone. Nothing in them says how a button looks, how much
space goes between faces or which grey `muted` is. The theme decides all of it: the page follows the
system's light or dark, a row too narrow for its faces wraps them onto the next line, and every button
can be reached and pressed from the keyboard. A later page changes the theme; nothing in the views changes with it.

## When a view has a mistake

`view` reads its whole block before it shows anything. When something in it is not the dialect, a word
mistyped or a rule without what it takes, nothing is shown and the error lists every problem at once, each
with the line and column where it is and, when a word of the dialect is close, the one you may have meant:

```text
view [
    title "Cog & Chain"
    buton "Book a repair" [toast "Booked in"]
    field name "Name" requird
]
```

```text
** User error: layout: 2 problems
   app.trb:3:5  buton is not a style; did you mean button?
   app.trb:4:23 requird is not a word of field; did you mean required?
** Where: view
** Near: [buton "Book a repair" [toast "Booked in"]]
** At: app.trb:3:5
```

The browser shows it in its console (in Chrome, *View › Developer › JavaScript Console*). A view in the
action of a button is read when the button is pressed, so its mistakes show up only then.

## Putting it on the web

`trebol dev` is for writing the app. To put it on a web server, add a page called `index.html` next to
`app.trb`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cog &amp; Chain</title>
<script type="module" src="https://cdn.jsdelivr.net/npm/trebol@0.1/dist/trebol.js"></script>
<script type="text/trebol" src="app.trb"></script>
</head>
<body></body>
</html>
```

and copy the two files to any server that serves plain files. The first `script` brings all of Trebol in one
file; the second runs the app. To serve Trebol from your own server instead, copy
`node_modules/trebol/dist/trebol.js` next to the page and write `src="trebol.js"`.

## What's next

The shop's first real screen books a repair in: a customer, a bike, a price and a due date. The
[next page](02-forms) builds it as a form, with every field checked before it is saved.
