# Evaluation and control

Evaluating blocks, choosing between them and repeating them. A block is data until something evaluates it,
and each of these functions decides when and how often. See
[deciding and repeating](../language/04-deciding-and-repeating.md).

## do

## reduce

## compose

## comment

## at-end

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

## also

## if

## unless

## either

## case

## switch

## not

## all

## any

## loop

## repeat

## foreach

## forall

## forskip

## while

## until

## forever

## break

## continue
