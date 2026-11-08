# 5. Functions

The shop now repeats itself: look up a price, add the tax, round to the cent. This page wraps those steps
into functions of its own, with names, arguments and options — and shows that a function is a value like
any other, which you can store, pass around and read.

The price list again:

```trebol-console
>> prices: [chain $12.50 tyre $22.00 brake-pads $9.90 bell $5.00]
== [chain $12.50 tyre $22.00 brake-pads $9.90 bell $5.00]
```

## func

`func` makes a function from two blocks: the names of its arguments, and the code to run.

```trebol-console
>> price-of: func [part] [select prices part]
== func [part] [select prices part]
>> price-of 'tyre
== $22.00
>> price-of 'saddle
== none
```

The console shows the function as the code that makes it: like everything else, a function is a value,
and `price-of:` named it. A function gives back the value of the last expression in its body.

You call a function by writing its name and then its arguments, with no parentheses and no commas. Trebol
knows how many arguments each function takes, so it knows where each call ends. There is one thing to
watch: an operator such as `+` takes the value just before it first, before any function does. So this
tries to add `'chain` to a price:

```trebol-console
>> price-of 'chain + price-of 'bell
** Script error: + does not allow word! for its a argument
** Where: +
** Near: ['chain + price-of 'bell]
** At: 1:10
```

Parentheses say what you mean:

```trebol-console
>> (price-of 'chain) + price-of 'bell
== $17.50
```

## Saying what an argument must be

A block after an argument lists the types it accepts. Trebol checks them on every call:

```trebol-console
>> with-tax: func [amount [money!]] [round/to amount * 121% $0.01]
== func [amount [money!]] [round/to amount * 121% $0.01]
>> with-tax $12.50
== $15.13
>> with-tax "12.50"
** Script error: with-tax does not allow string! for its amount argument
** Where: with-tax
** Near: [with-tax "12.50"]
** At: 1:1
```

## Help, from the function itself

Strings in the spec describe the function and its arguments, and `return:` says what it gives back. Nothing
else reads them but people — and `help`:

```trebol-console
>> with-tax: func [
[        "Adds the 21% tax, rounded to the cent."
[        amount [money!] "Price before tax"
[        return: [money!]
[    ] [round/to amount * 121% $0.01]
== func [
    "Adds the 21% tax, rounded to the cent."
    amount [money!] "Price before tax"
    return: [money!]
] [round/to amount * 121% $0.01]
>> help with-tax
USAGE:
    WITH-TAX amount

DESCRIPTION:
    Adds the 21% tax, rounded to the cent.
    WITH-TAX is a function! value.

ARGUMENTS:
    amount -- Price before tax (money!)

RETURNS:
    money!
```

`help` works on every function, Trebol's own included — try `help round` or `help append`. It is the first
thing to type when you meet a function you do not know. `?` is a short name for it.

## Local words

Here is a function that adds up an order. It has a trap in it:

```trebol-console
>> total: func [order] [
[        sum: $0.00
[        foreach part order [sum: sum + price-of part]
[        sum
[    ]
== func [order] [
    sum: $0.00
    foreach part order [sum: sum + price-of part]
    sum
]
>> total [chain tyre]
== $34.50
>> sum
== $34.50
```

The function works, but `sum` is still there after it returned: `func` does not make the words you set
inside it local, so `total` just changed a word called `sum` for everybody. List the local words after
`/local` in the spec, or — easier — make the function with `function`, which finds every word the body sets
and makes it local for you:

```trebol-console
>> sum: 0
== 0
>> total: function [order] [
[        sum: $0.00
[        foreach part order [sum: sum + price-of part]
[        sum
[    ]
== func [order /local sum] [
    sum: $0.00
    foreach part order [sum: sum + price-of part]
    sum
]
>> total [chain tyre]
== $34.50
>> sum
== 0
```

The console shows what `function` did: it wrote `/local sum` into the spec. From now on, use `function`
when a body sets words of its own, and `func` when it does not.

## Options: refinements

A rush job costs $10 more. Rather than a second function, `total` can take an option. A word with a slash
in the spec is a **refinement**: inside the body it is `true` when the caller used it, and `none` when not.

```trebol-console
>> total: function [order /rush] [
[        sum: $0.00
[        foreach part order [sum: sum + price-of part]
[        if rush [sum: sum + $10.00]
[        sum
[    ]
== func [order /rush /local sum] [
    sum: $0.00
    foreach part order [sum: sum + price-of part]
    if rush [sum: sum + $10.00]
    sum
]
>> total [chain tyre]
== $34.50
>> total/rush [chain tyre]
== $44.50
```

A refinement can bring arguments of its own. A discount is 10% unless the caller says otherwise:

```trebol-console
>> discount: func [amount /by pct [percent!]] [amount - (amount * either by [pct] [10%])]
== func [amount /by pct [percent!]] [amount - (amount * either by [pct] [10%])]
>> discount $100
== $90.00
>> discount/by $100 25%
== $75.00
```

This is the `/to` of `round/to` and the `/even` of `round/even`: Trebol's functions take their options the
same way yours do.

## Leaving early

`return` gives back a value straight away, without running the rest of the body:

```trebol-console
>> in-stock: func [part] [
[        if not find prices part [return "we don't sell that"]
[        "in stock"
[    ]
== func [part] [
    if not find prices part [return "we don't sell that"]
    "in stock"
]
>> in-stock 'saddle
== "we don't sell that"
>> in-stock 'bell
== "in stock"
```

## A function with no arguments

`does` makes a function from a body alone:

```trebol-console
>> greet: does [print "Welcome to Cog & Chain"]
== func [] [print "Welcome to Cog & Chain"]
>> greet
Welcome to Cog & Chain
```

## Functions are values

Writing a function's name calls it. To get the function itself, without calling it, put a colon in front of
the name — a *get-word*:

```trebol-console
>> type? :with-tax
== function!
>> tax: :with-tax
== func [
    "Adds the 21% tax, rounded to the cent."
    amount [money!] "Price before tax"
    return: [money!]
] [round/to amount * 121% $0.01]
>> tax $10.00
== $12.10
```

So a function can take another function as an argument. Here is one that applies any function to every
amount in a block:

```trebol-console
>> each-amount: function [fn amounts] [collect [foreach a amounts [keep fn a]]]
== func [fn amounts] [collect [foreach a amounts [keep fn a]]]
>> each-amount :with-tax [$10.00 $20.00]
== [$12.10 $24.20]
>> each-amount :discount [$10.00 $20.00]
== [$9.00 $18.00]
```

## Your own control functions

The last page ended with a promise: `if` and `foreach` are functions that take blocks, so you can write
your own. A function that takes a block can run it as many times as it likes:

```trebol-console
>> twice: func [code [block!]] [do code do code]
== func [code [block!]] [do code do code]
>> twice [print "ding"]
ding
ding
```

Nothing tells `twice` apart from `loop`: both are functions, both take a block and decide when to run it.
That is how Trebol grows — with functions that read like part of the language, because the language is
made of them.

## What's next

The shop has a price list in a block and functions to work on it. A repair order, though, is more than a
list: it has a customer, a bike, a due date, a set of parts. [The next step](06-objects-and-maps) gives
each order a shape of its own, with objects.
