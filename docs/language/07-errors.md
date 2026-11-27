# 7. When things go wrong

A customer asks for a tyre the shop has run out of. Someone types the due date as `31-Feb-2026`. A price list
is missing a part. Programs meet these things every day, and this page is about what happens then: how Trebol
tells you something went wrong, how a program notices and carries on, and how your own functions report the
problems only they know about.

```trebol-console
>> prices: [chain $12.50 tyre $22.00 brake-pads $9.90 bell $5.00]
== [chain $12.50 tyre $22.00 brake-pads $9.90 bell $5.00]
```

## Reading an error

When an expression cannot be evaluated, Trebol stops and shows an **error**:

```trebol-console
>> to date! "31-Feb-2026"
** Script error: cannot convert string! to date!
** Where: to
** Near: [to date! "31-Feb-2026"]
** At: 1:1
```

Every error says the same four things. The first line gives its kind and what went wrong. `Where` names the
function that found the problem, `Near` shows the code it was running, and `At` gives the line and column, here
of what you typed; in a script it also names the file.

The kind tells you whose problem it is. A **script** error is a misuse of the language: a value of the wrong
type, a word with no value. A **math** error is arithmetic that has no answer:

```trebol-console
>> $34.50 / 0
** Math error: attempt to divide by zero
** Where: /
** Near: [$34.50 / 0]
** At: 1:1
```

A **syntax** error comes from text that is not valid Trebol, when `load` reads it; an **access** error comes
from the world outside, a server that does not answer; and **user** errors are the ones your programs make, as
you will see below. An **internal** error means Trebol itself could not go on: a value nested too deep for the
host's stack, or a function that calls itself with no end, gives one with the id `stack-overflow`, and text or a series too long for the host to hold gives
`too-long`. It is an error like any other, so `attempt` catches it and the rest of the program keeps running.

Sometimes the error shows up one step after the real mistake. The price list has no saddle, so `select` gives
`none`, and it is the addition that complains:

```trebol-console
>> (select prices 'saddle) + $1.00
** Script error: + does not allow none! for its a argument
** Where: +
** Near: [(select prices 'saddle) + $1.00]
** At: 1:1
```

## An error is a value

In the console an error stops the line and the session goes on. In a program, an error stops the program —
unless something catches it. `try` runs a block, and if an error happens inside, gives the error back as a
value instead of stopping:

```trebol-console
>> due: try [to date! "31-Feb-2026"]
** Script error: cannot convert string! to date!
** Where: to
** Near: [to date! "31-Feb-2026"]
** At: 1:11
>> error? due
== true
```

The console shows an error value just as it shows an error, but nothing stopped: `due` now holds the error,
and `error?` says so. When nothing goes wrong, `try` simply gives the value of its block:

```trebol-console
>> due: try [to date! "14-Nov-2026"]
== 14-Nov-2026
>> error? due
== false
```

An error is an object with fixed fields, which a program can read: `type` is its kind, `id` says exactly which
error it is, `message` is the text, and `near`, `where` and `at` say where it happened.

```trebol-console
>> e: try [to date! "31-Feb-2026"]
** Script error: cannot convert string! to date!
** Where: to
** Near: [to date! "31-Feb-2026"]
** At: 1:9
>> e/type
== script
>> e/id
== bad-to
>> e/message
== "cannot convert string! to date!"
```

So a function that reads the date a customer typed can catch the bad ones and say something useful:

```trebol-console
>> read-due: function [typed] [
[        due: try [to date! typed]
[        either error? due [
[            print ["Not a date:" typed]
[            none
[        ] [due]
[    ]
== func [typed /local due] [
    due: try [to date! typed]
    either error? due [
        print ["Not a date:" typed]
        none
    ] [due]
]
>> read-due "14-Nov-2026"
== 14-Nov-2026
>> read-due "31-Feb-2026"
Not a date: 31-Feb-2026
== none
```

When you only care whether it worked, `attempt` is shorter: it gives the value of its block, or `none` if
anything failed. With `any`, it gives a default:

```trebol-console
>> attempt [to date! "31-Feb-2026"]
== none
>> any [attempt [to integer! "two"] 1]
== 1
```

Use `attempt` sparingly: it hides every error, also the ones you did not expect, such as a mistyped word inside
the block. `try` lets you look at what went wrong.

## Raising your own errors

Some problems only your program can see. Trebol has no idea that a shop cannot sell a tyre it does not have; the
function that takes parts from stock does. It **raises** an error with `do make error!` and a message:

```trebol-console
>> stock: #(chain: 3 tyre: 0 bell: 12)
== #(chain: 3 tyre: 0 bell: 12)
>> take-part: function [part] [
[        if stock/:part = 0 [do make error! rejoin ["No " part " left"]]
[        stock/:part: stock/:part - 1
[    ]
== func [part] [
    if stock/:part = 0 [do make error! rejoin ["No " part " left"]]
    stock/:part: stock/:part - 1
]
>> take-part 'chain
== 2
>> take-part 'tyre
** User error: No tyre left
** Where: do
** Near: [do make error! rejoin]
** At: 2:25
```

`stock/:part` reads the key held in `part`: the colon before a word inside a path takes its value, so with
`part` set to `chain` it means `stock/chain`.

`make error!` makes the error and `do` raises it. Whoever called `take-part` can catch it with `try` like any
other error.

A message is for people. When a program needs to tell one error from another, give it a `type` and an `id`
too, with `cause-error`. The last argument becomes the message. A block is formed, its values joined with spaces,
but it is not evaluated, so `reduce` it to put in the value of `part` rather than the word:

```trebol-console
>> take-part: function [part] [
[        if stock/:part = 0 [cause-error 'user 'out-of-stock reduce ["No" part "left"]]
[        stock/:part: stock/:part - 1
[    ]
== func [part] [
    if stock/:part = 0 [cause-error 'user 'out-of-stock reduce ["No" part "left"]]
    stock/:part: stock/:part - 1
]
```

```trebol-console
>> error? e: try [take-part 'tyre]
== true
>> e/id
== out-of-stock
>> e/message
== "No tyre left"
```

Now the shop can fill an order, take each part it can, and note the ones it is missing, instead of stopping at
the first:

```trebol-console
>> fill: function [parts] [
[        missing: copy []
[        foreach part parts [
[            e: try [take-part part]
[            if error? e [
[                either e/id = 'out-of-stock [append missing part] [do e]
[            ]
[        ]
[        missing
[    ]
== func [parts /local missing e] [
    missing: copy []
    foreach part parts [
        e: try [take-part part]
        if error? e [
            either e/id = 'out-of-stock [append missing part] [do e]
        ]
    ]
    missing
]
>> fill [chain tyre bell]
== [tyre]
>> stock
== #(chain: 1 tyre: 0 bell: 11)
```

`do e` raises an error again. `fill` only knows what to do about a part that is out of stock; anything else —
a part that is not in `stock` at all, say — goes on up to whoever called it.

## Leaving early: catch and throw

An error is for something that went wrong. Sometimes a program only wants to stop a search as soon as it has
the answer. `throw` leaves at once with a value, and `catch` receives it:

```trebol-console
>> first-missing: function [parts] [
[        catch [
[            foreach part parts [if stock/:part = 0 [throw part]]
[            none
[        ]
[    ]
== func [parts] [
    catch [
        foreach part parts [if stock/:part = 0 [throw part]]
        none
    ]
]
>> first-missing [bell tyre chain]
== tyre
>> first-missing [bell chain]
== none
```

A `throw` crosses loops and function calls until it meets a `catch`. It is not an error: `try` lets it pass,
and nothing is reported.

## What's next

The shop's data lives in blocks: price lists, parts, orders. The next step looks at blocks and strings — all
**series** — in depth: finding, inserting, removing, sorting and moving through them.
