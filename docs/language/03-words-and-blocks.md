# 3. Words and blocks

The shop has prices, but nowhere to keep them. This page gives values names, gathers them into a price
list, and arrives at the idea everything else in Trebol is built on: a block of code is just a block of
data.

## Naming a value

A word followed by a colon gives a value a name; the word alone gives it back:

```trebol-console
>> labour-rate: $30.00
== $30.00
>> labour-rate * 2
== $60.00
```

`labour-rate:` is a *set-word*. Words can hold dashes, question marks and most other signs, so names read
like the shop talks. A word that was never set has no value, and Trebol says so:

```trebol-console
>> chain
** Script error: chain has no value
** Near: [chain]
** At: 1:1
```

## Blocks

Square brackets make a **block**: a list of values, kept exactly as written. Here is the shop's price list:

```trebol-console
>> prices: [chain $12.50 tyre $24.00 brake-pads $9.90]
== [chain $12.50 tyre $24.00 brake-pads $9.90]
```

Look at what happened to `chain`. Outside a block it was an error; inside, Trebol did not try to look it up.
**Nothing inside a block is evaluated.** The block holds six values: three words — `chain`, `tyre`,
`brake-pads` — and three amounts.

That sentence counts words as values, and they are: a word is a value of type `word!`, just as `$12.50` is
a value of type `money!`. What makes a word special is that it can also *name* another value, as
`labour-rate` names `$30.00`. Outside a block, Trebol replaces a word by the value it names; inside a block,
the word stays a word:

```trebol-console
>> length? prices
== 6
>> first prices
== chain
>> type? first prices
== word!
>> second prices
== $12.50
>> last prices
== $9.90
```

## Finding things in a block

A block of names and values is a natural lookup table. `select` finds a value and gives the one after it:

```trebol-console
>> select prices 'tyre
== $24.00
```

The quote in `'tyre` means *this word itself*, not the value it names: we are asking for the word `tyre` in
the block. A path does the same, shorter, and a number in a path picks by position:

```trebol-console
>> prices/tyre
== $24.00
>> prices/2
== $12.50
```

`find` gives the block from the value it finds onwards:

```trebol-console
>> find prices 'tyre
== [tyre $24.00 brake-pads $9.90]
```

## Changing a block

Tyres go on sale. A path followed by a colon sets the value it points at:

```trebol-console
>> prices/tyre: $22.00
== $22.00
>> prices
== [chain $12.50 tyre $22.00 brake-pads $9.90]
```

and `append` adds to the end — the shop starts selling bells:

```trebol-console
>> append prices [bell $5.00]
== [chain $12.50 tyre $22.00 brake-pads $9.90 bell $5.00]
>> prices/chain + prices/bell
== $17.50
```

## Code is data

Here is the shop's rule for 45 minutes of work, kept in a block:

```trebol-console
>> labour: [labour-rate * 45 / 60]
== [labour-rate * 45 / 60]
```

It is a block like the price list, with nothing evaluated. It holds five values: the word `labour-rate`,
the word `*`, the number `45`, the word `/` and the number `60` — operators are words too. But it is also a
piece of Trebol, and `do` runs it:

```trebol-console
>> do labour
== $22.50
>> third labour
== 45
```

The same block is data when you read it and code when you run it. There is no separate syntax for code:
a Trebol program *is* blocks of words and values, and anything you can do to a block — pick from it,
change it, build it from pieces — you can do to a program. That is why Trebol can describe a whole user
interface as a block, and later read that block with a few lines of its own.

One more way to run a block: `reduce` evaluates each expression in it and gives a new block of the
results, which is how you turn a template into data:

```trebol-console
>> reduce ["Chain and labour" prices/chain + do labour]
== ["Chain and labour" $35.00]
```

## What's next

The shop can price a part and an hour of work. [Next](04-deciding-and-repeating) it learns to decide and
to repeat: charge the rush fee only when a bike is due tomorrow, and add up every line of an order.
