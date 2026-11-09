# 1. A first screen

The first tutorial wrote the back office of **Cog & Chain**, the bicycle repair shop, in the console. This one
gives the shop its screens: a counter where a repair is booked in, the list of bikes in the workshop, the
quote a customer takes home. There is no HTML and no CSS on any page, only Trebol.

Every example on these pages runs right under its code. Type in its fields and press its buttons: it is the
real app, not a picture of one.

## An app is a folder

An app is a folder with a file called `app.trb` in it. Make a folder `cog-and-chain` next to the `trebol`
folder and save this in it as `app.trb`:

```trebol-ui
Trebol [title: "Cog & Chain"]

view [
    title "Cog & Chain"
    text muted "Bicycle repairs, done right."
    button "Book a repair" [toast "Booked in"]
]
```

From the `trebol` folder, serve it:

```sh
npm run trb -- dev ../cog-and-chain
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

## What's next

The shop's first real screen books a repair in: a customer, a bike, a price and a due date. The
[next page](02-forms) builds it as a form, with every field checked before it is saved.
