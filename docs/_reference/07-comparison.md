# Comparison

Comparing values, as functions and as operators. `=` and `equal?` compare loosely: `"abc" = "ABC"` is true and
so is `1 = 1.0`. `==` and `strict-equal?` compare the case and the datatype too, and `same?` asks whether two
values are one and the same.

A decimal is equal to another number at most 10 representable decimals away from it, so `0.1 + 0.2 = 0.3`. An
integer beyond 2^53, which no decimal holds exactly, is compared exactly, as `<` and `>` compare it:
`9007199254740993 = 9007199254740992.0` is false.

A date without time is that day at midnight, and two dates in different zones are equal when they are the same
moment: `1-Jan-2020 = 1-Jan-2020/0:00` and `1-Jan-2020/0:00 = 1-Jan-2020/1:00+1:00`. A tuple counts the parts it
lacks as 0, so `1.2.3 = 1.2.3.0`. Two blocks are equal when their values are, pair by pair, but there two values of
different datatypes are equal only when both are numbers or both are words: `[1] = [1.0]` and `[a] = [a:]`, yet
`"ab" = <ab>` while `["ab"] <> [<ab>]`.

## equal?

## not-equal?

## strict-equal?

## strict-not-equal?

## same?

## lesser?

## greater?

## lesser-or-equal?

## greater-or-equal?

## =

## <>

## ==

## !==

## <

## >

## <=

## >=
