<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Evaluation and control

Evaluating blocks, choosing between them and repeating them. A block is data until something evaluates it,
and each of these functions decides when and how often. See
[deciding and repeating](../language/04-deciding-and-repeating.md).

(fn-do)=
## do

Evaluates a block, source text or a script file; gives the last value.

```text
do value
```

- `value` (`any-type!`)
- `/next position` (`word!`): Evaluates only the first expression of a block; position: Set to the block after it

(fn-reduce)=
## reduce

Evaluates each expression of a block; gives a block of the values.

```text
reduce value
```

- `value` (`any-value!`)

(fn-compose)=
## compose

Evaluates the parens in a block and puts their values in a copy of it.

```text
compose value
```

- `value` (`any-value!`)
- `/deep`
- `/only`

(fn-comment)=
## comment

Ignores its argument.

```text
comment value
```

- `value` (`any-type!`)

(fn-at-end)=
## at-end

Evaluates a block once the expression that called the function running now is done; outside a function, once the code is done.

```text
at-end body
```

- `body` (`block!`)

The block is kept, not evaluated: it runs once the expression that called the function running `at-end` is done,
before the expression after it. Several run in the order they were kept, and the value of the code around them
stays its own. When that code is left early, by `return` or an error, they run after the code around it; outside a
function, at the end of the code. `machine` uses it to run the hooks of its initial states once the word it is set
to has the machine.

```trebol
f: function [] [at-end [print "after"]  print "in f"  1]
```

```trebol-console
>> x: f + 1  print "next"
in f
after
next
```

(fn-also)=
## also

Returns the first value, after evaluating the second.

```text
also a b
```

- `a` (`any-type!`)
- `b` (`any-type!`)

(fn-if)=
## if

Evaluates the block if the condition is true; gives its value, or none.

```text
if condition body
```

- `condition` (`any-value!`)
- `body` (`block!`)

(fn-unless)=
## unless

Evaluates the block if the condition is not true; gives its value, or none.

```text
unless condition body
```

- `condition` (`any-value!`)
- `body` (`block!`)

(fn-either)=
## either

Evaluates the first block if the condition is true, the second if not.

```text
either condition true-body false-body
```

- `condition` (`any-value!`)
- `true-body` (`block!`)
- `false-body` (`block!`)

(fn-case)=
## case

Evaluates the block after the first true condition.

```text
case cases
```

- `cases` (`block!`)
- `/all`

(fn-switch)=
## switch

Evaluates the block after the value that is equal to the one given.

```text
switch value cases
```

- `value` (`any-value!`)
- `cases` (`block!`)
- `/default case` (`block!`)

(fn-not)=
## not

True if the value is false or none, false otherwise.

```text
not value
```

- `value` (`any-value!`)

(fn-all)=
## all

Evaluates expressions while they are true; gives the last value, or none at the first false one.

```text
all block
```

- `block` (`block!`)

(fn-any)=
## any

Evaluates expressions until one is true; gives it, or none.

```text
any block
```

- `block` (`block!`)

(fn-loop)=
## loop

Evaluates a block a number of times.

```text
loop count body
```

- `count` (`integer!`)
- `body` (`block!`)

(fn-repeat)=
## repeat

Evaluates a block a number of times, with a word counting from 1.

```text
repeat 'word count body
```

- `'word` (`word!`)
- `count` (`integer!`)
- `body` (`block!`)

(fn-foreach)=
## foreach

Evaluates a block for each value of a series, with a word set to it; for a map, each key, or each key and value.

```text
foreach 'word data body
```

- `'word` (`word!` `block!`)
- `data` (`series!` `map!`)
- `body` (`block!`)

(fn-forall)=
## forall

Evaluates a block for each position of the series a word refers to.

```text
forall 'word body
```

- `'word` (`word!`)
- `body` (`block!`)

(fn-forskip)=
## forskip

Evaluates a block at every so many positions of the series a word refers to.

```text
forskip 'word size body
```

- `'word` (`word!`)
- `size` (`integer!`)
- `body` (`block!`)

(fn-while)=
## while

Evaluates the body as long as the condition block is true.

```text
while condition body
```

- `condition` (`block!`)
- `body` (`block!`)

(fn-until)=
## until

Evaluates the block until it gives true.

```text
until body
```

- `body` (`block!`)

(fn-forever)=
## forever

Evaluates a block again and again, until break or return.

```text
forever body
```

- `body` (`block!`)

(fn-break)=
## break

Leaves the loop it is in.

```text
break
```

- `/return value` (`any-value!`)

(fn-continue)=
## continue

Goes on with the next turn of the loop it is in.

```text
continue
```
