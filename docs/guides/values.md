# Values in memory

## What a value is

Every Trebol value is a **cell**: a small record with a fixed shape and a tag, `t`, that says its type. A
cell is never changed after it is made. What can change lives in two other kinds of record, shared by
reference: **series** (the contents of blocks, strings and binaries) and **contexts** (the words and values
of objects and functions).

```ts
{ t: K.Integer, v: 42 }                       // an integer
{ t: K.Money, v: { d: 1250n, e: 2 }, cur: '' } // $12.50
{ t: K.Block, s: series, i: 0 }               // a block: a series and a position
{ t: K.Word, sym: 17, bind: userCtx }         // a word, bound to a context
```

A block cell is a series plus an index. `next b` makes a new cell over the same series with the index one
further on, so it copies nothing, and an `append` through any cell is seen through all of them. That is
Rebol's model, and Trebol keeps it exactly.

## The types with care inside

**Integers are 64 bits, exact, or an error.** JavaScript numbers are exact only up to 2⁵³. An integer is
kept as a `number` while it fits in 53 bits, and as a `bigint` above that; `int64.ts` does the arithmetic and
answers `null` when the result does not fit 64 bits, which becomes a math error.

```trebol-console
>> 9007199254740993 + 1
== 9007199254740994
>> error? try [9223372036854775807 + 1]
== true
```

**Money is decimal, exact.** An amount is a `bigint` of digits and a count of decimal places (`dec.ts`),
plus an optional currency. Cents never drift, however many you add.

**Strings are arrays of code points.** JavaScript strings are UTF-16, where an emoji is two units. Trebol
keeps a string as an array of Unicode code points, so `length?`, `pick` and every index count characters
as a person does, and as a UTF-32 core would.

```trebol-console
>> length? "año"
== 3
>> length? "👍🏽"
== 2
```

The thumb and its skin tone are two code points, so the string has two characters, as in Rebol 3 and Red.

**Words are interned.** Each spelling is a symbol in one global table (`symbols.ts`). Words compare by
their lowercase symbol, so `Price` and `price` are the same word, but each keeps how it was written.

**Dates and times** are plain numbers inside: a `time!` is nanoseconds, and a `date!` is a year, month and
day, an optional time of day and an optional zone in minutes.

## What values cost in memory

Cells are small JavaScript objects and a series is a JavaScript array, so memory goes the way it goes in
JavaScript, not the way it would in a packed C or Zig core. Measured in Chrome (and, between brackets, in
Node, which does not compress pointers), keeping what was built and after collecting the garbage:

| What is kept                               | Per unit                          |
|--------------------------------------------|-----------------------------------|
| A string of a million characters           | about 6 bytes a character (8)     |
| A block of a million integers              | about 25 bytes an integer (50)    |
| What `load-json` makes of a JSON text      | about 9 times the text (16)       |

A character is one slot of an array of small integers. An integer in a block is its cell plus the slot
that points at it, and every string in a block adds its cell, its series and its array. While a value is
being built the peak is higher than what is kept: a JSON text is in memory three times over while it is
read (the text as it came, its code points and the values made from it), so 10 MB of JSON from the network
take well over 100 MB for a moment and settle near 90 MB once the text is let go. Nothing in Trebol limits the size of a series:
like Rebol 3, it is bounded only by the memory of the browser or of Node.

`test/memory.test.ts` keeps these numbers from growing, and checks that series of a million items go into
and out of every edit whole. Where a smaller cost matters more than code points with direct indexes, the
way out is the one the Zig core keeps open (below): the rule is only that indexes count code points.

## Loading and molding

`load` is a hand-written lexer in one pass, with no dependencies (`lexer.ts`). Its token classes are an
ordered table of regular expressions, so a Zig port can follow the same table. Every element of a loaded
block remembers its line and column, so an error can say `file:line:column`.

`mold` is its inverse, and `mold/all` writes values that have no literal form (`#[none]`, an object) in
construction syntax, so that `load mold/all x` gives `x` back exactly. A test checks that for thousands of
random values on every run.

## Why this way — and the alternatives

- **Use JavaScript values directly**: a JS number for an integer, a JS string for a string, a JS array for
  a block. It is the fastest start and it is what many small interpreters do. But a JS number is not a
  64-bit integer, a JS string counts UTF-16 units, and a JS array has no position, so `next` would have to
  copy. Each of these breaks something Rebol programs rely on.
- **Mutable cells.** Changing a cell in place saves an allocation now and then, but a cell can be in many
  places at once: in a block, in a frame waiting for a native, in a task that is paused. If cells never
  change, none of those can be surprised. Mutation happens only in series and contexts, where Rebol puts it
  too.
- **Floating point for money.** Every language that does it has a story about a missing cent. A decimal
  type costs a little speed and nothing else.
- **UTF-8 strings with an index.** They take less memory, and a Zig core may use them. But then `pick s 1000`
  has to walk the string or keep an index of positions. Code points keep indexes trivial, and the rule in the
  core is only that indexes count code points, however they are stored.
