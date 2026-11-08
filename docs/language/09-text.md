# 9. Text

A bike comes in, and the shop writes: the customer's name, a note about what is wrong, a line on the receipt for
each part, a message when the bike is ready. All of that is text, and text in Trebol is a string — a series of
characters, so everything on the previous page works on it. This page is about what is special to text: building
it from other values, cleaning up what people type, splitting it apart, and filling in the messages the shop
sends.

```trebol-console
>> customer: "Ada"
== "Ada"
>> total: $36.50
== $36.50
```

## Building text

`rejoin` reduces a block and joins the results into one string. It adds nothing between them, so the spaces are
yours to put in:

```trebol-console
>> rejoin ["Thanks, " customer "! You owe " total "."]
== "Thanks, Ada! You owe $36.50."
```

`print` takes a block too, and puts a space between the values for you. `join` puts one value after another:

```trebol-console
>> print ["Thanks," customer "- you owe" total]
Thanks, Ada - you owe $36.50
>> join "Order " 1024
== "Order 1024"
```

Each of them turns values into text the same way, with `form`.

## Text for people, text for Trebol

There are two ways to turn a value into text. `form` makes it readable for people. `mold` writes it the way you
would type it in Trebol, so that `load` can read it back as the same value:

```trebol-console
>> form [chain $12.50 "front"]
== "chain $12.50 front"
>> mold [chain $12.50 "front"]
== {[chain $12.50 "front"]}
>> load mold [chain $12.50 "front"]
== [chain $12.50 "front"]
```

The difference shows in the quotes: `form` drops them, because a person reading a receipt does not want them;
`mold` keeps them, because without them `"front"` would come back as a word. Use `form` for what people read, and
`mold` for what a program will read again — a file, a message to another program.

The console shows every result with `mold`. That is why a string with a quote inside is shown between braces,
the other way to write a string, which also lets it run over several lines:

```trebol-console
>> {He said "Ready tomorrow".}
== {He said "Ready tomorrow".}
>> print {He said "Ready tomorrow".}
He said "Ready tomorrow".
```

## From text to values

Going the other way, `to` turns a string into a value of the type you ask for. Every type also has its own
converter, `to-` and its name:

```trebol-console
>> to-money "12.50"
== $12.50
>> to-integer "3"
== 3
>> to-string $12.50
== "$12.50"
```

`load` reads a whole string as Trebol, finding the type of each value by how it looks — the same way the console
reads what you type:

```trebol-console
>> load "chain $12.50 3"
== [chain $12.50 3]
```

## Cleaning up what people type

People type names with spaces around them and capitals in odd places. `trim` removes the spaces at both ends;
`lowercase` and `uppercase` change the case, and with `/part` only of the first characters:

```trebol-console
>> typed: "   ada LOVELACE  "
== "   ada LOVELACE  "
>> name: lowercase trim copy typed
== "ada lovelace"
>> uppercase/part name 1
== "Ada lovelace"
```

Like the series functions of the last page, these change the string they are given — `copy` keeps `typed` as it
was. `trim/all` removes every space, and `trim/lines` turns each run of spaces and new lines into one space:

```trebol-console
>> trim/lines "  front   brake  ^/ squeaks "
== "front brake squeaks"
```

`^/` inside a string is a new line. The caret writes the characters you cannot type in a string: `^-` is a tab,
`^"` a double quote, `^^` the caret itself.

Comparing text with `=` does not mind the case, so `"chain"` and `"Chain"` are equal; `==` minds it. `find` does
not mind the case either, unless you ask with `/case`:

```trebol-console
>> "chain" = "Chain"
== true
>> "chain" == "Chain"
== false
>> find "Chain is worn" "chain"
== "Chain is worn"
>> find/case "Chain is worn" "chain"
== none
```

## Splitting

An order typed at the counter is one line, with the parts separated by commas. `split` cuts a string at a
delimiter and gives a block of the pieces:

```trebol-console
>> parts: split "chain, tyre ,bell" ","
== ["chain" " tyre " "bell"]
>> foreach part parts [trim part]
== "bell"
>> parts
== ["chain" "tyre" "bell"]
```

A mechanic's note has a line for each thing found. The character that ends a line has a name, `newline`, and
`split` cuts at a character as well as at a string:

```trebol-console
>> note: "Brakes squeak.^/Chain is worn.^/Tyre is fine."
== {Brakes squeak.
Chain is worn.
Tyre is fine.}
>> split note newline
== ["Brakes squeak." "Chain is worn." "Tyre is fine."]
```

Other characters have names too: `space`, `tab`, `comma`, `slash`, `dbl-quote`, and a few more.

## Replacing

`replace` finds a piece of text and puts another in its place — the first time it appears, or with `/all` every
time:

```trebol-console
>> replace copy "Chain is worn." "worn" "new"
== "Chain is new."
>> replace/all copy "worn chain, worn tyre" "worn" "new"
== "new chain, new tyre"
```

## Filling in a message

The shop sends the same message every time a bike is ready; only the name, the bike and the total change. Write
it once, with a `$` before each part that changes, and `reword` fills it in:

```trebol-console
>> ready: "Hello $name, your $bike is ready. Total: $total."
== "Hello $name, your $bike is ready. Total: $total."
>> reword ready [name customer bike "blue road bike" total total]
== "Hello Ada, your blue road bike is ready. Total: $36.50."
```

In the block, each keyword is taken as it is written and the value after it is evaluated, so `customer` gives
`"Ada"`. The values can also come from an object or a map, with the field names as keywords. `ready` itself is
left as it was, ready for the next customer.

When `$` would get in the way, `reword/escape` marks the keywords another way: with another character, or with a
block of what goes before and after each one:

```trebol-console
>> reword/escape "Hello <name>!" [name customer] ["<" ">"]
== "Hello Ada!"
```

## Lining up a receipt

A receipt puts the parts in one column and the prices in another. `pad` adds spaces to a string up to a length —
on the right, so the text starts the column, or with `/left` on the left, so it ends it, as numbers do:

```trebol-console
>> pad "chain" 10
== "chain     "
>> pad/left "$12.50" 8
== "  $12.50"
```

With `form` to turn each part and price into text, that is all a receipt needs:

```trebol
receipt: func [order [block!] /local sum] [
    sum: $0.00
    foreach [part price] order [
        print rejoin [pad form part 12 pad/left form price 8]
        sum: sum + price
    ]
    print rejoin [pad copy "Total" 12 pad/left form sum 8]
]
```

```trebol-console
>> receipt [chain $12.50 tyre $24.00 bell $5.00]
chain         $12.50
tyre          $24.00
bell           $5.00
Total         $41.50
```

`pad` changes the string it pads, like `trim` does; `form` makes a new string each time, so nothing else
changes.

## What's next

`reword` knew what `customer` meant inside its block. How a word in a block finds its value — and how a function
or an object gives words values of their own — is the subject of the next step: contexts and binding.
