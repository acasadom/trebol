# Series

A series is a sequence of values with a position: blocks, strings, binaries, paths and the like. These
functions move a series' position, read and change what it holds, search it and sort it. A position is part of the
value: `next` gives the same series one place further, and changing it changes it for every value that refers to
it. See [series](../language/08-series.md).

## length?

## empty?

## first

## second

## third

## fourth

## fifth

## last

## pick

## poke

## put

## next

## back

## head

## tail

## skip

## at

## index?

## head?

## tail?

## last?

## single?

## append

## insert

## change

## remove

## clear

## copy

## take

## reverse

## move

## swap

## alter

## pad

## array

## find

## select

## replace

## sort

The sort is stable: values that compare equal keep their order, with `/reverse` too. The comparator of `/compare`
gives true when its first value goes first, or an integer, negative when the first goes first, positive when the
second does and 0 when they are equal. A true or false cannot say two are equal, so with `/reverse` it turns ties
round; an integer keeps them. With `/skip`, the series must hold whole records: a last one cut short is an
error.

## extract

## remove-each

## map-each

## collect

## join

## unique

## union

## intersect

## difference

## exclude
