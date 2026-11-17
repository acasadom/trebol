# 10. Contexts and binding

Early on you learned that a word names a value. But an order has a `total`, and so might the day's takings, and a
function may have an argument called `total` too. Which one does the word `total` mean? This page answers that
question. The answer is short — every word carries its own link to where its value lives — and it is what lets
the shop keep its discount rules as data and run them against any order.

```trebol-console
>> total: $10.00
== $10.00
>> order: make object! [customer: "Ada" parts: [chain tyre] total: $60.00]
== make object! [
    customer: "Ada"
    parts: [chain tyre]
    total: $60.00
]
```

## Where a word finds its value

A place where words have values is a **context**. Each object is one, each call of a function has one, and the
words you type in the console live in one of their own. Here there are two `total`s, each in its own context:

```trebol-console
>> total
== $10.00
>> order/total
== $60.00
```

A word does not look for its value when it is used. It already knows the context it belongs to: it was linked
to one when it was read. That link is the word's **binding**. Inside a block the words are only data until the
block is evaluated, but they are bound all the same — to the console's context, since that is where you typed
them:

```trebol-console
>> rule: [total > $50.00]
== [total > $50.00]
>> do rule
== false
```

The `total` in `rule` is the console's `total`, `$10.00`.

The words Trebol itself gives, `print`, `form` or `append`, live in a context of their own, **lib**, and the
program's context starts with them. A program may set one of them to something else: it changes for the
program, not for Trebol. The forms, the screens and every function Trebol brings still find the `form` they
were written with.

## bind

`bind` links the words of a block to another context. Bound to `order`, the same rule asks about the order's
total:

```trebol-console
>> do bind/copy rule order
== true
>> do rule
== false
```

With `/copy`, `bind` binds a copy and leaves the block as it was. Without it, it changes the block itself: from
then on, its words belong to the order wherever the block goes:

```trebol-console
>> bind rule order
== [total > $50.00]
>> do rule
== true
```

Only the words the context has are bound. `>` is not a field of the order, so it keeps its own meaning.

## Rules as data

That is enough for the shop to keep its discounts as a block — a test and a rate for each one — and write them as
plainly as it says them: over $50 is 10% off, any tyre is 5% off. Nothing in the rules says which order they are
about:

```trebol-console
>> discounts: [[total > $50.00] 10% [find parts 'tyre] 5%]
== [[total > $50.00] 10% [find parts 'tyre] 5%]
```

A function binds each test to the order it is given, and gives the best rate whose test is true:

```trebol
discount: function [order [object!]] [
    best: 0%
    foreach [test rate] discounts [
        if do bind/copy test order [best: max best rate]
    ]
    best
]
```

```trebol-console
>> discount order
== 10%
>> discount make order [parts: [bell] total: $5.00]
== 0%
```

The rules can come from a file, or be changed while the program runs, and `discount` does not change. A block of
words, bound to the right context when it is time to evaluate it: this is how dialects are made, and how
Trebol's user interface reads the blocks that describe a screen.

## A word in a context

`in` gives the word of an object, bound to it. `get` and `set` read and change a value through such a word, and
`context?` tells you which context a word belongs to:

```trebol-console
>> word: in order 'total
== total
>> get word
== $60.00
>> set word $70.00
== $70.00
>> order/total
== $70.00
>> same? order context? word
== true
```

## Functions have contexts too

The arguments and local words of a function live in a context of the function's own, made new for each call. A
word in a function's body means what it meant where the function was written — not what it means wherever the
function is called from:

```trebol-console
>> rate: 0%
== 0%
>> price-now: func [price] [price - (price * rate)]
== func [price] [price - (price * rate)]
>> sale: func [rate] [price-now $50.00]
== func [rate] [price-now $50.00]
>> sale 20%
== $50.00
```

The `rate` that `sale` takes is `sale`'s own, and `price-now` never sees it: its `rate` is the console's, `0%`.

Since each call has its own context, a function made inside another one keeps the values of the call that made
it. A function that makes discount functions:

```trebol-console
>> discounter: func [rate] [func [price] [price - (price * rate)]]
== func [rate] [func [price] [price - (price * rate)]]
>> ten-off: discounter 10%
== func [price] [price - (price * rate)]
>> half-off: discounter 50%
== func [price] [price - (price * rate)]
>> ten-off $50.00
== $45.00
>> half-off $50.00
== $25.00
```

Each one remembers its own `rate`.

## Words for a moment

`use` gives words that exist only inside its block, when you need a name for a moment and want to leave the
console's words alone:

```trebol-console
>> use [count] [count: length? order/parts  count * 2]
== 4
>> value? 'count
== false
```

## self

Inside an object, the word `self` means the object itself — for a function that hands its object on, say to
another function. An order that knows its own discount:

```trebol-console
>> order: make object! [parts: [tyre] total: $20.00 deal: does [discount self]]
== make object! [
    parts: [tyre]
    total: $20.00
    deal: func [] [discount self]
]
>> order/deal
== 5%
```

## What's next

You have now seen every piece Trebol is made of: values, words and their contexts, blocks that are data until
you evaluate them. The next step puts them together in `parse`, Trebol's own way to read text and blocks — the
order lines typed at the counter, read the way the shop writes them.
