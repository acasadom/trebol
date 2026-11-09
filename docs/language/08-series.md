# 8. Series

The shop's price list is a block. So is the queue of bikes waiting for repair, and the parts of an order. A
customer's note is a string. Blocks and strings are both **series** — values in a row — and the same functions
find, change, sort and walk through all of them. This page is about those functions, and about the one idea
that makes them simple: a series value is a series *and a position in it*.

```trebol-console
>> prices: [chain $12.50 tyre $22.00 brake-pads $9.90 bell $5.00]
== [chain $12.50 tyre $22.00 brake-pads $9.90 bell $5.00]
```

## A series and a position

Three bikes are waiting, in the order they came in:

```trebol-console
>> queue: [ada lin sam]
== [ada lin sam]
>> next queue
== [lin sam]
```

`next` does not make a new block. It gives the same block, one position further on, and the console shows it
from there. Keep that position in a word and you can move around from it:

```trebol-console
>> second-in-line: next queue
== [lin sam]
>> first second-in-line
== lin
>> index? second-in-line
== 2
>> head second-in-line
== [ada lin sam]
```

`head` goes back to the start, `tail` to just past the end, `back` one step back and `skip` any number of steps.
`at` goes to a position counted from 1, as `index?` counts them. At the tail there is nothing left to see:

```trebol-console
>> tail queue
== []
>> tail? tail queue
== true
>> at queue 3
== [sam]
```

Because every position shares the same series, a change made through one is seen through all of them. That is
not a surprise to work around; it is how you point at the place to change, as you will see next.

## Finding

`find` looks for a value and gives the position where it is, or `none` when it is not there — so it works as a
condition too:

```trebol-console
>> find queue 'lin
== [lin sam]
>> find queue 'tom
== none
>> if find queue 'sam [print "Sam's bike is in the shop"]
Sam's bike is in the shop
```

In the price list, the price of a part is the value right after its name. `select` gives it, as you saw in an
earlier step; `find` gives the place, which you can then change. The tyre supplier has put their prices up:

```trebol-console
>> tyre: find prices 'tyre
== [tyre $22.00 brake-pads $9.90 bell $5.00]
>> change next tyre $24.00
== [brake-pads $9.90 bell $5.00]
>> prices
== [chain $12.50 tyre $24.00 brake-pads $9.90 bell $5.00]
```

`change` writes over the value at a position and gives the position after it. The change is in `prices` itself,
because `tyre` was a position in it, not a copy.

`find` takes any value that is equal to the one it is given. In a block of maps, two bookings with the same
fields are equal; `find/same` looks for the very map you hold, as `same?` does:

```trebol-console
>> ada: #(customer: "Ada")
== #(customer: "Ada")
>> bookings: reduce [#(customer: "Ada") ada]
== [#(customer: "Ada") #(customer: "Ada")]
>> index? find bookings ada
== 1
>> index? find/same bookings ada
== 2
```

## Changing a series

The queue grows at the end and is served from the front. `append` adds at the tail, and `take` removes the first
value and gives it back:

```trebol-console
>> append queue 'tom
== [ada lin sam tom]
>> take queue
== ada
>> queue
== [lin sam tom]
```

`insert` puts values at a position — at the head, if that is where the series is. An urgent repair jumps the
queue:

```trebol-console
>> insert queue 'kim
== [lin sam tom]
>> queue
== [kim lin sam tom]
```

`insert` gives the position just after what it inserted, which is ready for the next insert. `remove` takes out
the value at a position, and with `/part` more than one; `take/last` takes from the tail; `clear` removes
everything from a position to the end:

```trebol-console
>> remove find queue 'sam
== [tom]
>> queue
== [kim lin tom]
>> take/last queue
== tom
>> clear next queue
== []
>> queue
== [kim]
```

## Copying

Setting a word to a series does not copy it. Both words then name the same series, and a change through one is
seen through the other:

```trebol-console
>> today: [chain tyre]
== [chain tyre]
>> order: today
== [chain tyre]
>> append order 'bell
== [chain tyre bell]
>> today
== [chain tyre bell]
```

When you want a series of your own, `copy` it. `copy/part` copies only so many values:

```trebol-console
>> order: copy today
== [chain tyre bell]
>> append order 'pump
== [chain tyre bell pump]
>> today
== [chain tyre bell]
>> copy/part today 2
== [chain tyre]
```

`copy` copies the series, not the series inside it. If a block holds other blocks and you want those copied too,
use `copy/deep`.

## Sorting

`sort` puts a series in order — in place, changing the series itself. Sort a copy when you want to keep the
original:

```trebol-console
>> sort copy [tyre bell chain]
== [bell chain tyre]
>> sort/reverse copy [tyre bell chain]
== [tyre chain bell]
```

The price list is not a list of single values but of pairs: a name and a price. The shop has started selling
pumps and lights:

```trebol-console
>> append prices [pump $18.00 lights $3.50]
== [chain $12.50 tyre $24.00 brake-pads $9.90 bell $5.00 pump $18.00 lights $3.50]
```

`/skip 2` tells `sort` to keep each pair together, sorting by the first value of each — the name. With
`/compare 2` as well, it sorts by the second — the price:

```trebol-console
>> sort/skip copy prices 2
== [bell $5.00 brake-pads $9.90 chain $12.50 lights $3.50 pump $18.00 tyre $24.00]
>> sort/skip/compare copy prices 2 2
== [lights $3.50 bell $5.00 brake-pads $9.90 chain $12.50 pump $18.00 tyre $24.00]
>> sort/skip/compare/reverse copy prices 2 2
== [tyre $24.00 pump $18.00 chain $12.50 brake-pads $9.90 bell $5.00 lights $3.50]
```

`/compare` also takes a function of two values, which says whether the first goes before the second, for any
order you need.

## Walking through a series

`foreach` takes one value at a time — or, with a block of words, several at a time, which suits the pairs of the
price list:

```trebol-console
>> foreach [part price] prices [if price > $10.00 [print [part price]]]
chain $12.50
tyre $24.00
pump $18.00
== none
```

Like any loop, `foreach` gives the value of its block's last run: here, the `none` of an `if` whose condition
was false.

`remove-each` walks the same way and removes the values for which its block is true. The cheap parts, left out of
a copy:

```trebol-console
>> remove-each [part price] copy prices [price < $10.00]
== [chain $12.50 tyre $24.00 pump $18.00]
```

`forall` walks by moving a position: inside its block the word is the series at each position in turn, so you can
look at what comes next as well:

```trebol-console
>> route: [ada lin kim]
== [ada lin kim]
>> forall route [if not tail? next route [print [first route "then" second route]]]
ada then lin
lin then kim
== none
```

## Strings are series too

Everything on this page works on strings, whose values are characters:

```trebol-console
>> note: "Blue road bike"
== "Blue road bike"
>> find note "road"
== "road bike"
>> insert find note "bike" "racing "
== "bike"
>> note
== "Blue road racing bike"
>> copy/part note 4
== "Blue"
>> length? note
== 21
```

A single character is a `char!` value, written `#"B"`:

```trebol-console
>> first note
== #"B"
```

## What's next

The shop writes a lot of text: notes, receipts, messages to customers. The next step is about text — building it,
splitting it, cleaning it up and turning values into it.
