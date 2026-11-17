# 11. Testing the screens

Every change to an app can break something a person does with it: a button that no longer books, a message
that no longer shows. Trying each screen by hand after every change is slow, and soon skipped. A **screen
test** does it for you: it types, clicks and chooses as a person would, and checks what the screen says.
It runs without a browser, in a moment, every time.

## The app

The board of the workshop, with a form to book a repair in. The server keeps the bookings and refuses a
Sunday, the day the workshop is closed:

```trebol-ui
bookings: fetch "/api/bookings"
foreach b bookings [b/due: to date! b/due]

view [
    title "Workshop"
    global table board "Nothing booked yet" [customer "Customer" bike "Bike" due "Due back"]
    form [
        field customer "Customer" required
        choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
        date due "Due back" required
        submit "Book in" [
            answer: fetch/with "/api/bookings" [body: values full: true]
            either answer/status = 201 [
                b: answer/body
                b/due: to date! b/due
                append bookings b
                board/data: bookings
                set-values face/form none
                toast/role "Booked in." 'success
            ] [
                foreach [name reason] answer/body/errors [field-error face/form name reason]
            ]
        ]
    ]
]

board/data: bookings
```

## Its tests

The tests of `app.trb` go in `app.test.trb`, next to it. The file has the form of Trebol's own test suites: a
string names a group, and each block after it is one test. Every test starts the app anew, so what one test
books is gone in the next:

```trebol-test
Trebol [title: "Workshop: screen tests"]

booked: [
    #(id: 1 customer: "Ana Ruiz" bike: "Road" due: "2026-11-12")
]

serve [
    GET "/api/bookings" [booked]
    POST "/api/bookings" [
        either body/due = "2026-11-15" [
            reply 422 #(errors: #(due: "The workshop is closed on Sundays"))
        ] [
            b: copy body
            b/id: 2
            append booked b
            reply 201 b
        ]
    ]
]

"the board"
[see "Ana Ruiz"]

"booking a repair"
[
    type "Customer" "Luis Gil"
    choose "Bike" "City"
    type "Due back" "2026-11-20"
    click "Book in"
    see "Booked in."
    see "Luis Gil"
]
[
    type "Customer" "Luis Gil"
    choose "Bike" "City"
    type "Due back" "2026-11-15"
    click "Book in"
    see "The workshop is closed on Sundays"
    see/not "Booked in."
]
```

`npx trebol test` runs them: the files you name, or every `*.test.trb` under the folder you are in. It says how
each test went and ends with an error status when one fails, so a script that publishes the app can stop
there:

```sh
npx trebol test
```

```text
ok    app.test.trb:22:1  the board
ok    app.test.trb:25:1  booking a repair
ok    app.test.trb:33:1  booking a repair
3 tests, all passed.
```

## What a test does

A test names the faces by what the person sees: the label of a field, the text of a button, a hint. A word
names a field by its name instead, `type 'due "2026-11-20"`, which still holds when the labels are
translated.

| Word | What the person does |
| --- | --- |
| `click "Book in"` | clicks a button, link, tile, check, toggle or tab; or the row of a table, list or tree that shows that text |
| `type "Customer" "Luis Gil"` | types in a field and leaves it; `""` empties it |
| `choose "Bike" "City"` | chooses an option of a choice, radio or lookup, by the text it shows |
| `attach "Photos" [%front.jpg %side.jpg]` | chooses files next to the test for an upload or photo, as the person picks or drops them; its `accept` refuses the others |
| `pick-menu "Ana Ruiz" "Remove"` | chooses an item of the menu a button opens, of a face's context menu, or of the menu of the row of a table, list or tree that shows that text; `["Move to" "Top"]` names one in a submenu |
| `drag "Rest" "Write"` | drags a face, or the row that shows that text, onto another: where things can be reordered it takes the place of the other, else it is dropped on a face with `drop`, or before a row of one |
| `press "Ctrl+S"` | presses a key: the button or link with that `key` as its shortcut, or else the view's `on-key` |
| `press/on "Enter" "Customer"` | presses it with the cursor in a face: its `on-key`, or the nearest one around it; Enter in a field of a form clicks its submit (in a form in steps, Next until the last step), Escape closes a dialog |
| `say no` | answers no to the next question of `confirm`; with nothing said, the answer is yes |
| `click "Undo"` | clicks the *Undo* of the newest notice that has one, as `toast/undo` shows it |
| `dismiss "Ana Ruiz removed"` | lets the notice that shows that text go, as if its time had passed: the block of `toast/then` runs |
| `see "Booked in."` | checks that the text is on the screen: in a face, a field, a row, a message, a notice or a question asked |
| `see/not "Booked in."` | checks that it is not |
| `see-mark "Records" #list` | checks the mark of the tile that shows that text; `none`, that it has none |

Each of them gives `true`, so a test whose last step is one of them passes when every step does. A test can
end in any other check instead, as long as it gives `true`: after `click "Ana Ruiz"`,
`board/selected/id = 1`.

Only what is on show counts, as for a person: a dialog until it opens, the faces of a tab until it is chosen,
the fields of a step until *Next* reaches it (a step done is chosen again with `click` and its title), a
screen until the app goes to it. The screen is a wide one.

A `confirm` is answered yes, unless `say no` comes before the step that asks it; each `say` answers one
question, and one that no question took fails the test, since the app did not ask what the test expected:

```text
"keeping a booking"
[
    click "Ana Ruiz"
    say no
    click "Remove"
    see "Remove the booking of Ana Ruiz?"
    see "Ana Ruiz"
]
```

No time passes in a test, so a notice with *Undo* waits until the test clicks it, dismisses it or goes to
another screen; one still waiting when the test ends goes then, and the request its `/then` sends needs an
answer from `serve` like any other.

## What the server answers

`serve` takes a method, a path and a block for each request the app makes, as the server would answer it.
The block sees `body`, what the app sent, and `query`, the map of what follows `?` in the address. A word
starting with `:` in the path takes that part of the address: `"/api/bookings/:id"` answers
`/api/bookings/2` with `id` as `"2"`. What the block gives is the answer, sent as JSON; `reply` gives it a
status other than 200.

What comes before the first group runs before the app starts, in every test: the data the server keeps and
the `serve` that answers. A `serve` inside a test comes before the ones it follows, so one test can make the
server fail:

```text
"when the server fails"
[
    serve [POST "/api/bookings" [reply 500 none]]
    ...
]
```

A request no `serve` answers fails the test, and says which one it was. Files sent with `multipart`, after an
`attach`, reach `body` as their name, size and type: `body/photo/name`.

## When a test fails

A failing test says what went wrong and where, at the step of the test or at the line of the app:

```text
FAIL  app.test.trb:25:1  booking a repair
        ** User error: click: "Book in" cannot be used now
        ** Where: click
        ** Near: [click "Book in"]
        ** At: app.test.trb:28:5
```

Here the test forgot to choose a bike: the form keeps its submit disabled until every field is valid, and a
person could not have clicked it either. An error in the app is told the same way, with the line of
`app.trb` where it happened.

## Where to go from here

The screens of this tutorial are the pieces of a whole app: forms, tables, dialogs, screens with links, a
theme, two languages and a server. `examples/clients` puts them together in a list of
clients that are added, searched, changed and removed on a server, with its screen tests in
`app.test.trb`. In Trebol's folder, `npm run dev` serves it, server included, on
http://localhost:5173/examples/clients/, and `npx trebol test examples` runs its tests.
