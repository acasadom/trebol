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

Changing what a field holds works the same: `append status/text " Back soon."` adds to the string the text
shows, and the page shows it too. So does a row added to the block a table shows, as the tables chapter does.

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

`trebol dev` shows it on the page, over the app, with every other error the app does not catch, such as one in
the action of a button; *Close* puts it away. On any other server the page shows nothing of it, and the error is
in the browser's console (in Chrome, *View › Developer › JavaScript Console*).

`trebol dev` also gives the page its own dev tools: the small *Trebol* button in the corner, or Ctrl+`, opens a
panel at the bottom with four tabs. *Faces* shows the faces on the screen as a tree; *Pick* and a click on one
shows what it holds (its text, value, error, rules, events) and the line where you wrote it, a link that opens
the file in VS Code. *Console* runs Trebol against the app as it runs, with `face` being the face picked:
`face/text: "Hello"` changes it on the screen, and what `print` writes shows there too. *Machines* shows the
state machines of the program, which come later in this guide. *Log* lists what happened, newest last: the
events of each face, each request with its status and time, toasts, errors, the changes of state of machines. A page that
`trebol build` writes has none of it.

A view in the action of a button is read when the button is pressed, so its mistakes show up only then.
`npx trebol check` finds them before: it reads `app.trb` (or the files you name) without running it, lays out
every block after `view` and `layout`, and the faces of every screen, and lists what it finds the same way:

```sh
npx trebol check
```

```text
app.trb:3:5   buton is not a style; did you mean button?
app.trb:4:23  requird is not a word of field; did you mean required?
```

It ends with an error status when there is a problem, so a script that publishes the app can stop there. In a
`view compose [...]`, the parens hold values that only running the app gives, and `check` takes them on trust.

## Putting it on the web

`trebol dev` is for writing the app. To put it on the web, build it:

```sh
npx trebol build
```

That writes `build/index.html`, one page with all of Trebol, the Inter font and every `.trb` file of the
folder inside it (but the tests, `app.test.trb`). The images, sounds, videos, JavaScript modules and data files
(`.csv`, `.json` and the like) are copied next to it, in the same folders; the rest of the folder, like a
backend or `package.json`, stays out. Copy the `build` folder to any server that serves plain files, and that
is the app. The page even opens from the disk with a double click, with no server, as long as the app imports
no JavaScript module (the browser loads those only from a server). `trebol build other-folder --out site`
builds another folder into `site`. A second build replaces the folder of the first; a folder it did not make
is left alone, with an error. For a server with a strict Content-Security-Policy, `trebol build --csp` puts
Trebol and the fonts next to the page as files ([A strict Content-Security-Policy](../strict-csp.md)).

The header of `app.trb` gives the page its head: `title:` names the browser tab before the view does,
`description:` is what a search engine shows under the link, and `icon:` is the file shown in the tab. The
page `trebol dev` serves takes the same head:

```text
Trebol [title: "Cog & Chain" description: "Bicycle repairs, done right." icon: %cog.svg]
```

The page has the fonts its own text needs: Latin always, Cyrillic, Greek and Vietnamese only when some `.trb`
file has one of their letters. Other letters show in the system font.

You can also keep the files apart and let a CDN bring Trebol. Add a page called `index.html` next to
`app.trb`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cog &amp; Chain</title>
<script type="module" src="https://cdn.jsdelivr.net/npm/trebol@0.4/dist/trebol.js"></script>
<script type="text/trebol" src="app.trb"></script>
</head>
<body></body>
</html>
```

and copy the two files to any server that serves plain files. The first `script` brings all of Trebol in one
file, which loads Inter from the `fonts` folder next to it; the second runs the app. To serve Trebol from your
own server instead, copy `node_modules/trebol/dist/trebol.js` and `node_modules/trebol/dist/fonts` next to the
page and write `src="trebol.js"`.

## What's next

The shop's first real screen books a repair in: a customer, a bike, a price and a due date. The
[next page](02-forms) builds it as a form, with every field checked before it is saved.
