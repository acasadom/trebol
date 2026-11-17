<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Series

A series is a sequence of values with a position: blocks, strings, binaries, paths and the like. These
functions move a series' position, read and change what it holds, search it and sort it. A position is part of the
value: `next` gives the same series one place further, and changing it changes it for every value that refers to
it. See [series](../language/08-series.md).

(fn-length-3f)=
## length?

The number of values from the series' position to its tail.

```text
length? series
```

- `series` (`series!` `map!` `object!`)

(fn-empty-3f)=
## empty?

True if the series has nothing from its position on, or the map nothing at all.

```text
empty? series
```

- `series` (`series!` `map!`)

(fn-first)=
## first

The first value of a series.

```text
first series
```

- `series` (any value)

(fn-second)=
## second

The second value of a series.

```text
second series
```

- `series` (any value)

(fn-third)=
## third

The third value of a series.

```text
third series
```

- `series` (any value)

(fn-fourth)=
## fourth

The fourth value of a series.

```text
fourth series
```

- `series` (any value)

(fn-fifth)=
## fifth

The fifth value of a series.

```text
fifth series
```

- `series` (any value)

(fn-last)=
## last

The last value of a series.

```text
last series
```

- `series` (`series!`)

(fn-pick)=
## pick

The value at a position or key.

```text
pick series index
```

- `series` (`any-value!`)
- `index` (`any-value!`)

(fn-poke)=
## poke

Sets the value at a position or key; gives the value.

```text
poke series index value
```

- `series` (`any-value!`)
- `index` (`any-value!`)
- `value` (`any-value!`)

(fn-put)=
## put

Sets the value of a key; gives the value.

```text
put series key value
```

- `series` (`map!` `object!` `block!`)
- `key` (`any-value!`)
- `value` (`any-value!`)

(fn-next)=
## next

The series one position on.

```text
next series
```

- `series` (`series!`)

(fn-back)=
## back

The series one position back.

```text
back series
```

- `series` (`series!`)

(fn-head)=
## head

The series at its first position.

```text
head series
```

- `series` (`series!`)

(fn-tail)=
## tail

The series just past its last value.

```text
tail series
```

- `series` (`series!`)

(fn-skip)=
## skip

The series moved on, or back, by an offset.

```text
skip series offset
```

- `series` (`series!`)
- `offset` (`integer!`)

(fn-at)=
## at

The series at a position, counted from where it is.

```text
at series index
```

- `series` (`series!`)
- `index` (`integer!`)

(fn-index-3f)=
## index?

The position of the series, from 1.

```text
index? series
```

- `series` (`series!`)

(fn-head-3f)=
## head?

True if the series is at its head.

```text
head? series
```

- `series` (`series!`)

(fn-tail-3f)=
## tail?

True if the series is at its tail.

```text
tail? series
```

- `series` (`series!`)

(fn-last-3f)=
## last?

True if the series has one value left.

```text
last? series
```

- `series` (`series!`)

(fn-single-3f)=
## single?

True if the series has one value left.

```text
single? series
```

- `series` (`series!`)

(fn-append)=
## append

Puts a value at the tail of a series; gives the series at its head.

```text
append series value
```

- `series` (`series!`)
- `value` (`any-value!`)
- `/part range` (`integer!` `series!`): Put in only part of the value
- `/only`: A block goes in as one value
- `/dup count` (`integer!`): Put it in several times

(fn-insert)=
## insert

Puts a value where the series is; gives the series just after it.

```text
insert series value
```

- `series` (`series!`)
- `value` (`any-value!`)
- `/part range` (`integer!` `series!`): Put in only part of the value
- `/only`: A block goes in as one value
- `/dup count` (`integer!`): Put it in several times

(fn-change)=
## change

Puts a value over what the series holds where it is; gives the series just after it.

```text
change series value
```

- `series` (`series!`)
- `value` (`any-value!`)
- `/part range` (`integer!` `series!`): Change this much of the series
- `/only`: A block goes in as one value
- `/dup count` (`integer!`): Put the value in several times

(fn-remove)=
## remove

Removes what the series holds where it is; gives the series.

```text
remove series
```

- `series` (`series!`)
- `/part range` (`integer!` `series!`): Remove this much

(fn-clear)=
## clear

Removes everything from the series' position to its tail.

```text
clear series
```

- `series` (`series!` `map!`)

(fn-copy)=
## copy

A copy of the series, map, object or bitset.

```text
copy value
```

- `value` (`series!` `map!` `object!` `bitset!`)
- `/part length` (`integer!` `series!`)
- `/deep`

(fn-take)=
## take

Removes the value at the head of a series and returns it; none if there is none.

```text
take series
```

- `series` (`series!` `none!`)
- `/part length` (`integer!`): Takes that many values, as a series of the same type
- `/last`: Takes from the tail instead
- `/deep`: Copies the series inside what is taken

(fn-reverse)=
## reverse

Reverses the order of the values from the series' position.

```text
reverse series
```

- `series` (`series!`)
- `/part length` (`integer!` `series!`)

(fn-move)=
## move

Moves a value, or a span of values, within a series; gives the series after it.

```text
move source offset
```

- `source` (`series!`): Changed
- `offset` (`integer!`): How far to move it, or with /to where to
- `/part length` (`integer!`): Move this many values
- `/skip size` (`integer!`): The series is records of this size
- `/to`: Offset is a position from the head

(fn-swap)=
## swap

Swaps the first values of two series; gives the first series.

```text
swap a b
```

- `a` (`series!`)
- `b` (`series!`)

(fn-alter)=
## alter

Removes the value if the series has it, adds it if not; true if it was added.

```text
alter series value
```

- `series` (`series!`)
- `value` (any value)

(fn-pad)=
## pad

Pads a string with spaces on the right (with /left, on the left) up to a length. Modifies it.

```text
pad str n
```

- `str` (`string!`)
- `n` (`integer!`)
- `/left`: Pads on the left, which aligns to the right
- `/with c` (`char!`): Pads with another character

(fn-array)=
## array

Makes a block of the size given, or of blocks for a block of sizes.

```text
array size
```

- `size` (`integer!` `block!`)
- `/initial value` (any value): Fill it with this; a series is copied, a function called

(fn-find)=
## find

Finds a value in a series; gives the series where it is, or none.

```text
find series value
```

- `series` (`series!` `none!` `typeset!` `bitset!`)
- `value` (`any-type!`)
- `/part length` (`integer!` `series!`): Look only this far
- `/only`: A block is one value
- `/case`: Capitals matter
- `/skip size` (`integer!`): Look only at every so many
- `/last`: Find the last one
- `/tail`: Give the series just after it
- `/match`: Only where the series is
- `/reverse`: Look back from where the series is
- `/any`: In a string, \* is any run of characters and ? any one
- `/same`: In a block, the very same value (same?), not an equal one

(fn-select)=
## select

The value after the one found, or none.

```text
select series value
```

- `series` (`series!` `map!` `object!` `none!`)
- `value` (`any-type!`)
- `/only`
- `/case`
- `/skip size` (`integer!`)
- `/last`

(fn-replace)=
## replace

Replaces the first (or with /all every) occurrence of a pattern in a series.

```text
replace target pattern value
```

- `target` (`series!`)
- `pattern` (any value)
- `value` (any value)
- `/all`

(fn-sort)=
## sort

Sorts the series in place.

```text
sort series
```

- `series` (`series!`)
- `/case`
- `/skip size` (`integer!`)
- `/compare comparator` (`any-function!` `integer!`)
- `/reverse`

(fn-extract)=
## extract

Takes every so many values of a series: the first of each record.

```text
extract series width
```

- `series` (`series!`)
- `width` (`integer!`): Size of each record
- `/index pos` (`integer!`): Take this position of each record instead

(fn-remove-each)=
## remove-each

Removes the values of a series for which the block gives true.

```text
remove-each 'word data body
```

- `'word` (`word!` `block!`)
- `data` (`series!`)
- `body` (`block!`)

(fn-map-each)=
## map-each

A block of what the block gives for each value of a series.

```text
map-each 'word data body
```

- `'word` (`word!` `block!`)
- `data` (`series!`)
- `body` (`block!`)

(fn-collect)=
## collect

Evaluates a block where keep adds values to a new block, and returns it.

```text
collect body
```

- `body` (`block!`)

(fn-join)=
## join

Joins a value with another value, or with a reduced block.

```text
join value rest
```

- `value` (any value)
- `rest` (any value)

(fn-unique)=
## unique

The values of the series, each once.

```text
unique set
```

- `set` (`series!`)
- `/case`

(fn-union)=
## union

The values that are in either series, each once.

```text
union a b
```

- `a` (`series!` `bitset!`)
- `b` (`series!` `bitset!`)
- `/case`

(fn-intersect)=
## intersect

The values that are in both series.

```text
intersect a b
```

- `a` (`series!` `bitset!`)
- `b` (`series!` `bitset!`)
- `/case`

(fn-difference)=
## difference

The values that are in one series but not the other; of two dates, the time between them.

```text
difference a b
```

- `a` (`series!` `date!` `bitset!`)
- `b` (`series!` `date!` `bitset!`)
- `/case`

(fn-exclude)=
## exclude

The values of the first series that are not in the second.

```text
exclude a b
```

- `a` (`series!` `bitset!`)
- `b` (`series!` `bitset!`)
- `/case`
