# Comparison

Comparing values, as functions and as operators. `=` and `equal?` compare loosely: `"abc" = "ABC"` is true and
so is `1 = 1.0`. `==` and `strict-equal?` compare the case and the datatype too, and `same?` asks whether two
values are one and the same.

A decimal is equal to another number at most 10 representable decimals away from it, so `0.1 + 0.2 = 0.3`. An
integer beyond 2^53, which no decimal holds exactly, is compared exactly, as `<` and `>` compare it:
`9007199254740993 = 9007199254740992.0` is false.

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
