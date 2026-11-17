# 12. When the app does not do what you expect

Sooner or later a button does nothing, a table stays empty or a message never shows. This page is the
order to look in: what an error says, how to find mistakes before running, how to look inside the app as
it runs, and the few traps that catch nearly everyone new to Trebol.

## Reading an error

Here a person types a name and presses *Book in*, and the action calls a function nobody wrote:

```text
view [
    title "Cog & Chain"
    form [
        field name "Name" required
        submit "Book in" [book-in values]
    ]
]
```

```text
** Script error: book-in has no value
** Where: action of button "Book in"
** Near: [book-in]
** At: http://localhost:5173/app.trb:5:27
```

Read it from the top. The first line is what went wrong: `book-in` is a word that holds nothing, mistyped
or never defined. *Near* is the code around the place, as you wrote it. *At* is the file, line and column:
line 5, column 27, where `book-in` starts. *Where* says what was running: the action of the button *Book in*.
An error inside a function of yours names that function instead, and an error in an event names it with its
face: `on-change of field email "Email"`.

The other errors you will meet most read the same way:

| The first line says                                   | It usually means                                            |
|-------------------------------------------------------|-------------------------------------------------------------|
| `x has no value`                                      | a word mistyped, or used before the line that sets it       |
| `+ does not allow string! for its a argument`         | a value of another kind than the function takes: `"12" + 1` |
| `layout: buton is not a style; did you mean button?`  | a word of the view that is not the dialect                  |
| `HTTP 404 Not Found for /api/client`                  | the server has nothing at that address                      |
| `cannot reach http://...`                             | the server is not running, or the address is wrong          |

## Check first

`npx trebol check` reads the app without running it and lists every mistake in its views, the views of
screens and dialogs included, which a running app reads only when it shows them:

```sh
npx trebol check
```

Run it after a change that does not show up, before anything else: a mistyped word in a view keeps the whole
view from showing. It runs nothing of the app but the imports at the top of a file, since a module only defines
things: that is how it knows the [rules](02-forms.md#rules-of-your-own) a package adds.

## The panel of errors

Under `npx trebol dev`, an error the app does not catch shows on the page itself, over the app, with *Close*
to put it away; the page reloads by itself when you save a file. On any other server, or in a page that
`trebol build` wrote, people using the app never see it: it goes to the browser's console only.

## Looking inside the app

`trebol dev` gives every page its own dev tools: press Ctrl+` or the small *Trebol* button in the bottom
corner. The panel opens at the bottom, and stays open when the page reloads.

**Faces** is the screen as Trebol sees it: every face, inside the one that holds it. Press *Pick* and click a
face on the page, or click a line of the tree, to see what the face holds now: its text, its value, the error
it shows, its rules and its events. Under the name is the line of `app.trb` where you wrote it; the link opens
it in VS Code. A grey line is a face that is not on show: a dialog that is closed, a tab not chosen.

**Machines** shows each machine the program keeps in a word, or in a field of an object in a word: its
states as a tree, `›` before the one each level starts in and a dot after the ones it is in now. Click the
machine for its state, its data, the events it takes now and every way out of its states; click a state for
the ways out of that one and what it does (its timeout, what it runs or invokes). A machine made inside a
function and kept nowhere else is not there.

**Console** runs Trebol against the app as it runs, the same `>>` and `==` as `npx trebol`. The face you
picked is `face`, so you can try a change before writing it in the file:

```text
>> face/text: "Book a repair"
== "Book a repair"
>> face/disabled: true
== true
```

The page shows each change at once. A name of the view, a function, a variable of the program: everything
the program can reach, the console reaches too. What `print` and `probe` write shows here, as well as in the
browser's console.

**Log** lists what happened, newest last: each event with its face (`click · button "Book in"`, `input ·
field name "Name" "Ann"`), each request with its answer and how long it took (`POST /api/bookings 422 · 34 ms`),
each toast, each error, and each change of state of a machine (`repair: received → work/checking`), whether
an event, a timer or another tab moved it. When a button seems to do nothing, the log tells whether the click arrived, whether a
request left and what the server answered.

## probe

`probe` prints a value and gives it back unchanged, so it fits around any expression without changing what
the code does:

```trebol-console
>> total: probe 2 + 3
5
== 5
```

Put it where you doubt: `either probe answer/status = 201 [...] [...]` shows which way the code went.
Take it out once you know.

## Traps

**A loop's word lives only inside the loop.** `foreach` gives its word each value in turn, and once the loop
ends the word is gone:

```trebol-console
>> clients: [#(id: 1 name: "Ann") #(id: 3 name: "Bea")]
== [#(id: 1 name: "Ann") #(id: 3 name: "Bea")]
>> foreach c clients [if c/id = 3 [break]]
>> value? 'c
== false
```

To keep what you found, set another word before leaving the loop:

```trebol-console
>> found: none
== none
>> foreach c clients [if c/id = 3 [found: c break]]
>> found/name
== "Bea"
```

**A block is not run by itself.** What is inside a block stays as it was written, words and all, until
something runs it; that is why a view's block can hold `button "Save"` without anything named `button`:

```trebol-console
>> n: 5
== 5
>> length? [n n * 2]
== 4
>> reduce [n n * 2]
== [5 10]
>> compose [total (n * 2)]
== [total 10]
```

`reduce` runs every value of the block; `compose` runs only what is in parens and leaves the rest. Both
give a new block.

**A name belongs to its view.** `status: text "..."` in a view gives the face a name its actions reach, but
code outside the view, a function defined at the top of the file, does not see it. Write `global` before the
name when the rest of the program needs the face:

```text
view [
    global status: text muted "Closed"
]
show-open: does [status/text: "Open"]
```

**Only inputs have a field name.** In `field email "Email"` the word after the style is the name of the field,
its key in `values`. A text, a heading or a button take no such word; give them a name with a set-word before
them: `total: text "0"`.

**Changing a block in place does not repaint.** Setting a face's field shows the change: `clients/data:
rows`. Changing the block it holds, with `append clients/data row`, changes the data but the face does not
know; set the field again to show it:

```text
append clients/data row
clients/data: clients/data
```

## Where to go from here

When the trouble is in the language rather than the screen, the console of `npx trebol` is the quickest
place to try a line: [Getting started](../language/01-getting-started.md) shows it. Screen tests
([Testing the screens](11-testing.md)) keep a fixed mistake from coming back.
