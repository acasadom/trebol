# 13. Modules

The shop's program has grown: prices, discounts, the reading of orders, the questions to the supplier. Kept in
one file, every word is everybody's — a `total` in the discount rules and a `total` in the receipt can step on
each other, and nothing says which words the rest of the program is meant to use. This page splits the program
into files: the prices in one, the rules in another, each saying what it gives the rest.

The examples use files kept in a folder called `shop`, next to where you start Trebol. Make the folder and the
files as the page shows them, then start the console in the folder that holds `shop`:

```sh
npx trebol
```

## A module

A **module** is a file of Trebol that the rest of the program imports. This one holds the prices:

```trebol
; file: shop/prices.trb
Trebol [title: "The shop's prices" exports: [price-of]]

print "loading the prices"

prices: #(chain: $12.50 tyre: $18.00 bell: $4.00 brake-pad: $6.80)

price-of: function [part [word!]] [
    any [select prices part  cause-error 'user 'no-price reduce ["No price for" part]]
]
```

It starts with a **header**: the word `Trebol` and a block that says what the file is. `title:` is for people.
`exports:` lists the words the module gives the rest of the program — here only `price-of`. `import` runs the
file and gives back the module:

```trebol-console
>> shop-prices: import %shop/prices.trb
loading the prices
== make object! [
    prices: #(chain: $12.50 tyre: $18.00 bell: $4.00 brake-pad: $6.80)
    price-of: func [part [word!]] [
        any [select prices part cause-error 'user 'no-price reduce ["No price for" part]]
    ]
]
```

A module is an object: its fields are the words it sets. The exported word is also set in the console, so it
can be used by its name, as if you had typed it there:

```trebol-console
>> price-of 'chain
== $12.50
>> error? try [price-of 'saddle]
== true
```

The rest stays in the module. `prices` is not a word of the console; the module's own functions use it, and
you can still reach it through the module, as any field of an object:

```trebol-console
>> value? 'prices
== false
>> shop-prices/prices/bell
== $4.00
```

So a module can name its words as it likes: nobody else's `prices` is touched, and the header says which of
its words are meant for the rest.

## Once per program

Importing a module again does not run it again. The first `import` runs the file, and every later one gives
the same module — no second "loading the prices":

```trebol-console
>> same? shop-prices import %shop/prices.trb
== true
```

That matters when several modules import the same one. The prices are loaded once, and everyone who asks
shares them.

## Modules that import modules

The rules need the prices. Their module imports the prices module, and the path is read from where the
importing file is — `%prices.trb` here is the file next to `rules.trb`, wherever the program started:

```trebol
; file: shop/rules.trb
Trebol [title: "The shop's rules"]

import %prices.trb

discounts: [[total > $50.00] 10% [find parts 'tyre] 5%]

export total-of: function [parts [block!] /local n part] [
    total: $0.00
    parse parts [some [set n integer! set part word! (total: total + (n * price-of part))]]
    total
]

export discount: function [order [object!]] [
    best: 0%
    foreach [test rate] discounts [
        if do bind/copy test order [best: max best rate]
    ]
    best
]
```

This header has no `exports:`. Instead, the word `export` marks each word the module gives, right where it is
set. Both ways do the same; a list in the header shows everything at a glance, a mark keeps the word and the
fact that it is given together. `export [a b]` marks several words at once.

```trebol-console
>> words-of import %shop/rules.trb
== [discounts total-of discount]
>> total-of [2 chain 1 tyre]
== $43.00
>> discount make object! [parts: [chain tyre] total: $43.00]
== 5%
```

There was no "loading the prices": the rules imported the same module the console had imported already.

## Data in a file

Not every file is a program. The stock is a list of parts and how many are left — data, nothing to run.
`load` reads a file's values without evaluating them:

```trebol
; file: shop/stock.trb
chain 40
tyre 6
bell 12
brake-pad 0
```

```trebol-console
>> stock: load %shop/stock.trb
== [chain 40
    tyre 6
    bell 12
    brake-pad 0
]
>> select stock 'tyre
== 6
```

`load` of a file with a header leaves the header out, and gives the rest. `read` gives a file's text as it is,
for when the file is not Trebol at all:

```trebol-console
>> first split read %shop/stock.trb newline
== "chain 40"
```

## Running a script

`do` runs a file as if you had typed it in the console: its words are the console's words, and it runs every
time you ask, not once. That suits a script — something to do — rather than a module, which is something to
use:

```trebol
; file: shop/open.trb
Trebol [title: "Opening the shop"]

orders: 0
print "the shop is open"
```

```trebol-console
>> do %shop/open.trb
the shop is open
>> orders
== 0
```

## A module in JavaScript

Some work is already done in JavaScript, by a library or by you. `import` of a `.js` file loads it as a
JavaScript module and gives an object with a function for each function it exports, named the way Trebol names
words, so `inchesToCm` is `inches-to-cm`; its other exports are values:

```js
// file: shop/units.js
// Wheel sizes are said in inches; the shop's tables are in centimetres.

export function inchesToCm(inches) {
  if (inches <= 0) throw new Error('a wheel has a size');
  return Math.round(inches * 254) / 100;
}

export const sizes = [26, 27.5, 29];
```

```trebol-console
>> units: import %shop/units.js
== make object! [
    inches-to-cm: #[native!]
    sizes: [26 27.5 29]
]
>> units/inches-to-cm 29
== 73.66
>> units/sizes
== [26 27.5 29]
>> spec-of :units/inches-to-cm
== [inches]
```

Values cross as JSON does: text, numbers, blocks, maps, `true`, `false` and `none` keep their shape, a word
arrives as its text and a file as its name. A function that gives a promise is waited for while other tasks go
on, as `fetch` is (page 12). An exception in JavaScript is an error in Trebol:

```trebol-console
>> error? answer: try [units/inches-to-cm 0]
== true
>> answer/message
== "inches-to-cm: a wheel has a size"
```

A function can say what it takes, as a Trebol spec in a `spec` property, so `help` describes it and Trebol
checks its arguments:

```text
inchesToCm.spec = '["A wheel size in centimetres." inches [number!]]';
```

## When the file is not there

A file that cannot be read is an `access` error, so `try` catches it as any other (page 7):

```trebol-console
>> error? answer: try [import %shop/saddles.trb]
== true
>> answer/id
== cannot-open
>> answer/message
== "cannot open %shop/saddles.trb: no such file"
```

A module that lists in `exports:` a word it never sets is an error too: the header promised something the file
does not give.

## What's next

The shop now speaks Trebol in several files. But its orders are still written as Trebol code — a block of
numbers and words that `parse` checks. The next page gives the shop a language of its own: a quote written
the way the shop says it, read by a dialect.
