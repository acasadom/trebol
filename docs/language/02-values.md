# 2. Values that know what they are

Most languages give you numbers and strings, and leave the rest to you: a price is a number you must
remember to round, a date is a string you must remember to parse. Trebol has a type for each of the
things the shop deals with, and writes each one the way people do. This page meets them.

## Numbers

Whole numbers are `integer!`; numbers with a point are `decimal!`. A division that comes out whole stays
whole:

```trebol-console
>> 6 / 2
== 3
>> 5 / 2
== 2.5
>> 7 // 2
== 1
```

`//` is the remainder. `type?` tells you what any value is:

```trebol-console
>> type? 6 / 2
== integer!
>> type? 5 / 2
== decimal!
```

## Money

A chain costs $12.50. In Trebol that is not a number with a dollar sign in front: it is a value of type
`money!`, and it is exact.

```trebol-console
>> 0.1 + 0.2
== 0.3
>> mold/all 0.1 + 0.2
== "0.30000000000000004"
>> $0.10 + $0.20
== $0.30
>> mold/all $0.10 + $0.20
== "$0.30"
```

Decimals are binary fractions, like in every language, and `0.1` cannot be stored exactly. The console shows
a decimal with 15 digits, which hides the error; `mold/all` shows what is really stored. Money is kept in
decimal digits, so cents never drift, however many orders you add. The `$` is only the notation: an
amount has no currency unless you give it one (`EUR$12.50`).

Arithmetic keeps the type, and a division keeps every digit:

```trebol-console
>> $12.50 * 2
== $25.00
>> $10 / 3
== $3.333333333333333333
```

so you say when to round, and to what. `round/to` takes the step to round to:

```trebol-console
>> round/to $10 / 3 $0.01
== $3.33
>> round/to $2.625 $0.01
== $2.63
```

A half goes away from zero; `round` has refinements for the other rules, such as `round/even` or
`round/floor`. Refinements — the `/to` and `/even` after a function's name — are how Trebol functions
take options; you will write your own in a later step.

## Percentages

The shop charges 21% tax. A `percent!` is written as people write it, and it means what it says:

```trebol-console
>> 21% * $100
== $21.00
>> type? 21%
== percent!
```

## Dates and times

A bike that comes in on 8 November is due back in six days. Dates are written day, month, year, and
adding a number adds days:

```trebol-console
>> 8-Nov-2026 + 6
== 14-Nov-2026
>> 14-Nov-2026 - 8-Nov-2026
== 6
```

A time is hours and minutes; a repair that takes an hour and a half and another that takes 45 minutes add
up as you expect:

```trebol-console
>> 1:30 + 0:45
== 2:15
```

A date can carry a time after a slash, and a value with parts lets you pick them with a path — the value,
a slash, and the part's name:

```trebol-console
>> due: 14-Nov-2026/10:30
== 14-Nov-2026/10:30
>> due/weekday
== 6
>> due/date
== 14-Nov-2026
>> due/hour
== 10
```

Weekdays count from Monday, so 6 is a Saturday. A path with a colon sets a part, and the name then holds
the new value; a day past the end of its month goes on into the next:

```trebol-console
>> due/hour: 16
== 16
>> due
== 14-Nov-2026/16:30
>> due/day: 31
== 31
>> due
== 1-Dec-2026/16:30
```

Pairs (`390x844`) and tuples (`1.2.3`) set their parts the same way: `size/x: 400`. `due:` gave the date a
name; the next page is about names.

## Text

Text goes between double quotes. It is a `string!`, and a single character is a `char!`:

```trebol-console
>> "Cog & Chain"
== "Cog & Chain"
>> length? "Cog & Chain"
== 11
>> uppercase "chain"
== "CHAIN"
>> first "chain"
== #"c"
```

`rejoin` joins anything into a string, turning each value into its text:

```trebol-console
>> rejoin ["Order " 42 " is due on " 14-Nov-2026]
== "Order 42 is due on 14-Nov-2026"
```

## Values with a shape

The shop's email address, its website and its files are values too, and Trebol recognises them by how
they look:

```trebol-console
>> type? ada@cogandchain.example
== email!
>> type? https://cogandchain.example
== url!
>> type? %orders.trb
== file!
```

A file name starts with `%`. There are more: `255.128.0` is a `tuple!` (handy for colours and versions),
`26x2` is a `pair!` (a width and a height, or a tyre size).

## Yes, no and nothing

`true` and `false` are `logic!` values; `yes`, `on`, `no` and `off` are other names for them. `none` is the
value that means "nothing here":

```trebol-console
>> not true
== false
>> type? none
== none!
```

## Turning one value into another

`to` converts a value into another type — usually from text, as when the shop reads a price someone
typed:

```trebol-console
>> to money! "12.50"
== $12.50
>> to date! "14-Nov-2026"
== 14-Nov-2026
>> to integer! "42"
== 42
```

## What's next

You have met the values a repair shop needs. [Next](03-words-and-blocks), you give them names, gather them
into lists, and discover the one idea all of Trebol stands on.
