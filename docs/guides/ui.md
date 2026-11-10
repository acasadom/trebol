# From a block to the screen

## The path of a view

```trebol-ui
view [
    title "Cog & Chain"
    count: text muted "No bikes in yet."
    button "Book in" [count/text: "One bike in." count/role: 'success]
]
```

Three things happen between that block and what you see.

1. **`layout` reads the block.** It is Trebol code, in `src/ui/ui.trb`, written with `parse`. Each word of
   style (`title`, `text`, `button`) starts a face, and the words, strings and blocks after it are read as
   its modifiers. Styles give each face its starting fields. The result is a tree of **faces**: objects with
   fields such as `style`, `text`, `role`, `data` and `pane` (the children), as in Red. `layout` is pure: it
   touches no DOM, so it runs the same in Node, in the tests.
2. **`show` draws the tree.** It is a native of the browser host (`browser.ts`) that makes one DOM node per
   face, with semantic elements: a `button` is a `<button>`, a field is an `<input>` with its `<label for>`,
   a table is a `<table>`. The classes on them are a fixed set; the look comes from the theme (see
   [](themes.md)).
3. **Changes repaint by themselves.** `count/text: "One bike in."` sets a field of a face that is on screen.
   The host has given that face's context a `watch` list, and the core's `ctxSet` adds the context to it the
   first time a field changes. After each round of the scheduler, the host copies the fields of the faces in
   that list to their nodes, and clears it. Repainting costs what changed, not the number of faces.

Changing a series in place, `append count/text "!"`, changes the string but not the field, so it does not
repaint: set the field again.

## Events

A click, a key, a change in a field: the host turns each DOM event into a call of a Trebol function
(`ui-click`, `ui-input`, `ui-blur`...) in a new task. Those functions, in `ui.trb`, find the handler, bind
`face`, `value`, `event` and, in a form, `values`, and run it. Validation runs there too, in Trebol: the
rules on a field, the messages in the active language, the `submit` that stays disabled while a field has an
error.

So the host knows how to draw and how to listen, and the dialect knows what things mean. The line between
them is the face: fields the dialect writes and the host reads.

## Tables and lists

A table's `data` is a block of rows. When it is set again, the host compares the new rows with the old ones
by key (the `id` field, or `key` another field, or the position) and only makes, moves or removes the rows
that changed. On a narrow screen the same table is drawn as a list of cards.

## Accessibility is the default

Because the host draws every control, it can give each one what assistive technology needs, every time:
labels tied to fields, `aria-invalid` and the error message in `aria-describedby`, a disabled `submit` that
stays in the keyboard order and shows the errors when pressed, toasts in an `aria-live` region, icon buttons
named by their icon. An app gets all of it without asking.

## Why this way — and the alternatives

- **A virtual DOM**, as React does: build a new description of the whole screen after every change and
  compare it with the last. It frees the program from saying what changed. Trebol knows what changed,
  because every change is a field set on a face, so it has nothing to compare; one node per face is enough.
- **Signals or observables**, as Solid or Vue do: every value is wrapped, and reading it records who
  depends on it. It is precise, but every value in the program would need wrapping. In Trebol only a face's
  own fields are watched, and the program uses plain values everywhere else.
- **Templates of HTML**, as most web frameworks do. They give full control and need you to know HTML, CSS
  and their accessibility rules. Trebol's promise is the opposite: you say *what*, and the host knows *how*.
  A style you cannot express is a style to add to Trebol, for everyone.
- **Canvas drawing**, as some UI toolkits do in a browser: draw every pixel yourself. It looks the same
  everywhere, and loses text selection, the browser's accessibility, translation and zoom. Real DOM elements
  keep all of that.
