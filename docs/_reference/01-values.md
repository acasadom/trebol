# Values and types

Every value has a datatype, and these functions make values, convert them from one datatype to another, and
ask what a value is. `type?` names a value's datatype; each datatype also has a test that ends in `?`, and most
have a conversion that starts with `to-`, a shorter way of writing `to`. See
[values](../language/02-values.md).

## make

`make string! 100`, and the same for any series, makes an empty one with room for that many items; a size below
zero, or past 32 bits, is an `out-of-range` error, as in R3.

`make object! [...]` copies its block deep before it binds and runs it, so two objects made from the same
block never share a series. An object written inside another one is copied again by each `make` around it,
so text that nests objects thousands of levels deep takes time and memory that grow with the square of its
depth: a chain of 1000 loads and runs at once, one of 10000 can run out of memory. Rebol 3 binds the block in
place instead, and its `mold` and `do` fail on such a chain sooner.

## to

A block gives a pair, a tuple or a time from its parts, as in R3: `to pair! [3 4]` is `3x4`, `to time! [9 30]`
is `9:30`, and `to time! [9 30 15.5]` is `9:30:15.5`; minutes and seconds over 59 carry over, and `make time!`
takes the same block.

## as-pair

## construct

## type?

For example `type? 3` gives the datatype `integer!`; `type?/word 3` gives the word `integer!`, to keep in a
block or to compare with one.

## value?

## quote

## any-type?

## any-value?

## number?

## scalar?

## any-string?

## any-word?

## any-block?

## any-path?

## any-object?

## any-function?

## none?

## logic?

## integer?

## decimal?

## percent?

## money?

## pair?

## tuple?

## date?

## time?

## char?

## string?

## file?

## email?

## url?

## tag?

## binary?

## bitset?

## word?

## set-word?

## get-word?

## lit-word?

## refinement?

## issue?

## block?

## paren?

## path?

After its first word, a path's parts are words, numbers, parens, or any other plain value written in place, as
in Rebol: a decimal, a percent, money, a pair, a tuple, a char, an issue, a tag, a time, a date, a binary or an
email. Such a value finds itself in a block, and a decimal or percent picks by position, cut toward zero:

```trebol-console
>> codes: [#a 10 <b> 20 #"c" 30]
== [#a 10 <b> 20 #"c" 30]
>> codes/<b>
== 20
>> codes/#"c"
== 30
>> codes/2.9
== 10
```

A file or a url takes the rest of the path, so `x/%a/b` has two parts, the second `%a/b`; write `x/%"a"/b`
for a file part followed by another, which is how `mold` writes it. A string or a block is not a path part,
and a path that sets ends with a word, an integer or a paren.

## set-path?

A path with a colon at its end sets what it names, and its last part may be a paren worked out first:

```trebol-console
>> sizes: [5 6] n: 2 sizes/(n): 7 sizes
== [5 7]
```

## get-path?

## lit-path?

## map?

## object?

## error?

## function?

## native?

## op?

## datatype?

## typeset?

## handle?

## unset?

## series?

## to-logic

## to-integer

## to-decimal

## to-percent

## to-money

## to-char

## to-pair

## to-tuple

## to-date

## to-time

## to-string

## to-file

## to-email

## to-url

## to-tag

## to-binary

## to-bitset

## to-word

## to-set-word

## to-get-word

## to-lit-word

## to-refinement

## to-issue

## to-block

## to-paren

## to-path

## to-set-path

## to-get-path

## to-lit-path

## to-map
