# 14. A dialect of your own

At the counter a quote takes one breath: two chains, a tyre, the bell as a gift, an hour and a half of work, ten
percent off. Page 11 read order lines out of text. This page writes the quote straight down as a Trebol block, in
the shop's own words, and then gives those words their meaning. A block in words of your own, with rules that
read it, is a **dialect**. Trebol's user interface is one: the block `view` takes on the first page of this guide.

## Words that mean nothing yet

Here is the quote, as the shop says it:

```trebol-console
>> order: [for "Ada Lovelace" 2 chain tyre bell as gift labour 1:30 10% off]
== [for "Ada Lovelace" 2 chain tyre bell as gift labour 1:30 10% off]
```

Nothing ran. `for` and `as` are functions in Trebol, but inside a block they are only words, waiting for someone
to read them. And Trebol has already done the work that page 11 did by hand: the name is a string, `2` is a
number, `1:30` a time and `10%` a percent.

```trebol-console
>> type? pick order 10
== time!
>> type? pick order 11
== percent!
```

What the words mean is up to whoever reads the block. That reader is the dialect.

## The grammar

First, what a quote may say. Each piece of it is a rule with a name (page 11): a part, with an amount in front
if there is more than one and `as gift` after it if it is free; some labour, which is the word `labour` and a time;
a discount, a percent followed by `off`; and the customer's name after `for`.

```trebol
item: [opt integer! word! opt ['as 'gift]]
labour: ['labour time!]
grammar: [any ['for string! | labour | percent! 'off | item]]
```

The order of the choices matters. `item` takes any word as a part, so it comes last; were it first, it would read
`labour` as a part called labour. With the grammar alone, `parse` says whether a quote is well written:

```trebol-console
>> parse order grammar
== true
>> parse [2 chain 3] grammar
== false
>> parse [labour 2] grammar
== false
```

A number with no part after it is not a quote, and labour is counted in time, not in plain numbers.

## Giving it meaning

The same rules, with `set` to take the values and parens to act on them, turn a quote into figures. The shop
keeps them in a module next to its prices (page 13):

```trebol
; file: shop/quote.trb
Trebol [title: "The shop's quotes" exports: [estimate]]

import %prices.trb

hourly: $30.00

estimate: function [
    "Reads a quote written the way the shop says it"
    spec [block!]
    /local n part time here
] [
    who: none
    rows: copy []
    off: 0%
    line: func [what amount] [append rows reduce [what amount]]
    item: [
        [set n integer! | (n: 1)] set part word!
        [   'as 'gift (line reform [n part "(gift)"] $0.00)
          | (line reform [n part] n * price-of part)
        ]
    ]
    labour: [
        'labour set time [time! | paren!] (
            if paren? time [time: do time]
            line reform ["labour" time] hourly * (time / 1:00)
        )
    ]
    unless parse spec [
        any [here: ['for set who string! | labour | set off percent! 'off | item]]
        end
    ] [
        cause-error 'user 'bad-quote reduce ["Cannot read the quote at" mold/only copy/part here 2]
    ]
    sum: $0.00
    foreach [what amount] rows [sum: sum + amount]
    cut: sum * off
    make object! [customer: who lines: rows discount: cut total: sum - cut]
]
```

Each rule now does something when it matches. `[set n integer! | (n: 1)]` takes the amount, or, when there is
none, matches nothing and sets `n` to one. A part as a gift goes in at no charge; any other is priced by
`price-of`, from the prices module. Labour is charged by the hour: dividing a time by `1:00` gives the hours, so
`1:30` is 1.5 hours. `reform` reduces a block and forms it, with spaces between the values, which makes the
text of each line of the quote.

```trebol-console
>> words-of import %shop/quote.trb
loading the prices
== [hourly estimate]
>> q: estimate order
== make object! [
    customer: "Ada Lovelace"
    lines: ["2 chain" $25.00 "1 tyre" $18.00 "1 bell (gift)" $0.00 "labour 1:30" $45.00]
    discount: $8.80
    total: $79.20
]
```

The quote is an object now, and printing it is ordinary Trebol. `pad` fills a text with spaces up to a width,
on the left with `/left`, so the amounts line up:

```trebol
receipt: function [q [object!]] [
    if q/customer [print ["Quote for" q/customer]]
    foreach [what amount] q/lines [print [pad what 16 pad/left form amount 8]]
    unless zero? q/discount [print [pad "discount" 16 pad/left form negate q/discount 8]]
    print [pad "total" 16 pad/left form q/total 8]
]
```

```trebol-console
>> receipt q
Quote for Ada Lovelace
2 chain            $25.00
1 tyre             $18.00
1 bell (gift)       $0.00
labour 1:30        $45.00
discount           -$8.80
total              $79.20
```

## When the quote is wrong

A quote the grammar cannot read is an error, and the error says where the reading stopped:

```trebol-console
>> error? e: try [estimate [2 chain 3]]
== true
>> e/message
== "Cannot read the quote at 3"
```

That is the work of `here:`. A set-word inside a `parse` rule sets the word to the input at that point, without
matching anything. It comes first in each piece of the quote, so when the reading stops, `here` is the piece
that went wrong.

A word the dialect does not know is read as a part, since any word can be one, and the price list has the last
say:

```trebol-console
>> error? e: try [estimate [2 chain 1 saddle]]
== true
>> e/message
== "No price for saddle"
```

## Trebol inside the dialect

Sometimes it is easier to work a figure out than to say it: two brakes at a quarter of an hour each. The
labour rule also accepts a paren, and runs it with `do`:

```trebol-console
>> receipt estimate [for "Grace Hopper" 2 brake-pad labour (2 * 0:15)]
Quote for Grace Hopper
2 brake-pad        $13.60
labour 0:30        $15.00
total              $28.60
```

Only that paren runs, and only because the dialect chose to run it; every other value in the block stays data.
That choice is the dialect's to make, and it is worth making with care: a dialect that runs parens runs whatever
code they hold, so one that reads quotes from strangers should leave parens out.

## What's next

Trebol has dialects of its own besides `parse`. The next page is about one for code that moves through stages,
such as a repair that goes from the counter to the workshop and back: machines.
