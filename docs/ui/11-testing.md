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
| `click "Book in"` | clicks a button, link, tile, check, toggle or tab; or the row of a table or list that shows that text |
| `type "Customer" "Luis Gil"` | types in a field and leaves it; `""` empties it |
| `choose "Bike" "City"` | chooses an option of a choice, radio or lookup, by the text it shows |
| `see "Booked in."` | checks that the text is on the screen: in a face, a field, a row, a message or a notice |
| `see/not "Booked in."` | checks that it is not |

Each of them gives `true`, so a test whose last step is one of them passes when every step does. A test can
end in any other check instead, as long as it gives `true`: after `click "Ana Ruiz"`,
`board/selected/id = 1`.

Only what is on show counts, as for a person: a dialog until it opens, the faces of a tab until it is chosen,
a screen until the app goes to it. The screen is a wide one. A `confirm` is answered yes.

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

A request no `serve` answers fails the test, and says which one it was.

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
