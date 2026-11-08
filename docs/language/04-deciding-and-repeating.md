# 4. Deciding and repeating

The shop charges a rush fee when a bike is due back tomorrow, and an order is the sum of its parts. This
page teaches Trebol to decide and to repeat — and you will see that both are done with blocks, the same
blocks as the last page.

We start from the price list:

```trebol-console
>> prices: [chain $12.50 tyre $22.00 brake-pads $9.90 bell $5.00]
== [chain $12.50 tyre $22.00 brake-pads $9.90 bell $5.00]
```

## Comparing

Comparisons give `true` or `false`. They work on every kind of value that has an order — numbers, money,
dates, text:

```trebol-console
>> $5.00 < $9.90
== true
>> 1 = 1.0
== true
>> 1 <> 2
== true
```

`=` compares what values mean: `1` and `1.0` are the same amount, and text compares without minding
capitals. `==` is stricter, and wants the same type and the same letters:

```trebol-console
>> "tyre" = "TYRE"
== true
>> "tyre" == "TYRE"
== false
```

## if

A bike is due tomorrow:

```trebol-console
>> today: 8-Nov-2026
== 8-Nov-2026
>> due: 9-Nov-2026
== 9-Nov-2026
>> if due - today <= 1 [print "Rush job"]
Rush job
```

`if` takes a condition and a block, and runs the block only when the condition holds. Remember the rule of
the first page — left to right: `due - today <= 1` is `(due - today) <= 1`, which is what we meant.

`if` is not special syntax. It is a function, and the block is a block like any other: `if` decides whether
to `do` it. When the condition fails, `if` gives `none`:

```trebol-console
>> if due - today > 3 [print "No hurry"]
== none
```

## either

`either` takes two blocks and runs one of them. Like everything in Trebol, it has a value — the value of the
block it ran — so the rush fee is one line:

```trebol-console
>> fee: either due - today <= 1 [$10.00] [$0.00]
== $10.00
```

## What counts as true

Only two values make a condition fail: `false` and `none`. Everything else counts as true — including `0`
and an empty string, unlike in some languages:

```trebol-console
>> if 0 [print "zero is true"]
zero is true
>> if none [print "never"]
== none
```

## all and any

`all` evaluates the expressions in a block one by one and stops at the first that fails; `any` stops at the
first that succeeds, and gives it back:

```trebol-console
>> all [due - today <= 1  fee > $0]
== true
>> any [none false "the first true value"]
== "the first true value"
```

## case and switch

When there are more than two roads, `case` takes conditions and blocks in pairs and runs the block of the
first condition that holds:

```trebol-console
>> days: 4
== 4
>> case [days <= 1 ["rush"]  days <= 3 ["soon"]  true ["normal"]]
== "normal"
```

`switch` chooses by value. Its block reads like a table — which it is:

```trebol-console
>> switch 'tyre [chain ["oil it"]  tyre ["check the pressure"]]
== "check the pressure"
>> switch/default 'bell [chain ["oil it"]] ["nothing to do"]
== "nothing to do"
```

## Repeating

`loop` repeats a block a number of times; `repeat` also counts, in a word you name:

```trebol-console
>> loop 2 [print "ding"]
ding
ding
>> repeat n 3 [print n]
1
2
3
```

The work of a repair shop is lists, and `foreach` goes through one. Here is an order — three words — and its
total:

```trebol-console
>> order: [chain tyre bell]
== [chain tyre bell]
>> total: $0
== $0.00
>> foreach part order [total: total + select prices part]
== $39.50
```

On each turn, `part` is the next word of the order, and `select` finds its price. The word `part` belongs to
the loop: once `foreach` is done, it is gone.

`foreach` can take several values at a time. The price list is pairs of a part and a price, so:

```trebol-console
>> foreach [part price] prices [print [part price]]
chain $12.50
tyre $22.00
brake-pads $9.90
bell $5.00
```

`print` with a block prints its values with spaces between them, after evaluating them.

## Collecting results

Often a loop builds a new list. `collect` gives a block of everything `keep` was given inside it — the
prices of the order:

```trebol-console
>> collect [foreach part order [keep select prices part]]
== [$12.50 $22.00 $5.00]
```

and the parts that cost under ten dollars:

```trebol-console
>> collect [foreach [part price] prices [if price < $10 [keep part]]]
== [brake-pads bell]
```

## while

`while` takes two blocks: a condition and a body. It runs the body as long as the condition holds — here,
taking money from a $50 gift card until the next part does not fit:

```trebol-console
>> card: $50.00
== $50.00
>> parts: [tyre tyre chain]
== [tyre tyre chain]
>> while [all [not tail? parts  card >= select prices first parts]] [
[        card: card - select prices first parts
[        parts: next parts
[    ]
== [chain]
>> card
== $6.00
```

While a block is open, the console waits for the rest and shows `[` at the start of each line; the loop
runs when the last `]` arrives. `next parts` moves on to the rest of the list, and `tail?` says when nothing
is left; a later step says more about moving through blocks.

## Control is just functions

`if`, `either`, `foreach` and `while` look like the keywords of other languages, but they are functions that
take blocks, as `print` takes a string. Nothing stops you from writing your own — a `twice` that runs a block
two times, or an `unless-closed` that checks the shop's opening hours. That is [the next step](05-functions).
