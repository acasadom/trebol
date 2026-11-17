# 11. Parse

At the counter, the shop types what a customer wants in a few words: `2 chain, 1 tyre`. That line has a shape —
an amount, a part, a comma, an amount, a part — and the shop wants to know whether a line has that shape, take
the amounts and parts out of it, and tidy up the way people really type it. `parse` does all three. You describe
the shape with a block of rules, and `parse` checks the text against it.

## Does it match?

`parse` takes the input and a block of rules, and answers `true` if the rules match all of the input:

```trebol-console
>> parse "chain" ["chain"]
== true
>> parse "chain" ["tyre"]
== false
>> parse "tyre" ["chain" | "tyre"]
== true
```

`|` means "or": the rules on its left are tried first, and if they fail, the ones on its right. Rules in a row
must match one after the other, and the whole input must be used up. Matching only the start is not enough:

```trebol-console
>> parse "1 tyre" ["1" " " "tyre"]
== true
>> parse "1 tyre, 1 bell" ["1" " " "tyre"]
== false
```

Like most of Trebol, `parse` does not mind capitals: `parse "Tyre" ["tyre"]` is `true`. `parse/case` minds them.

## Repeating

A rule after `some` matches once or more times, after `any` any number of times (none too), and after `opt`
once or not at all. A number in front of a rule asks for that many:

```trebol-console
>> parse "aaa" [some "a"]
== true
>> parse "" [any "a"]
== true
>> parse "tyres" ["tyre" opt "s"]
== true
>> parse "aaa" [2 "a"]
== false
```

Amounts are digits, and nobody wants to write ten alternatives. A **charset** is a set of characters that
matches any one of them; `#"a" - #"z"` in its block is every letter from a to z:

```trebol
digit: charset "0123456789"
letter: charset [#"a" - #"z"]
```

```trebol-console
>> parse "12" [some digit]
== true
>> parse "2 chain" [some digit " " some letter]
== true
```

Charsets go together like the sets of the series chapter: `union` gives the characters of either one,
`intersect` those of both, `exclude` those of the first that are not in the second, and `complement` every
character a charset does not have. `find` says whether a charset has a character, or every one of a text;
a letter counts in either case unless `/case`:

```trebol
code-char: union letter digit
```

```trebol-console
>> parse "b2b" [some code-char]
== true
>> find digit #"7"
== true
>> find letter "a1"
== false
```

## Rules with names

A rule can be a word whose value is a block of rules, so a long shape can be built from short pieces with
names, the way the shop would describe it: an order is a line, then more lines after a comma:

```trebol
amount: [some digit]
part: [some letter]
line: [amount " " part]
order: [line any [", " line]]
```

```trebol-console
>> parse "2 chain, 1 tyre" order
== true
>> parse "2 chain 1 tyre" order
== false
>> parse "two chains" order
== false
```

## Taking the pieces out

Knowing the line is good is half the work; the shop wants the amounts and parts. `copy` followed by a word sets
the word to the part of the input that the next rule matched. A paren in the rules is ordinary Trebol, evaluated
when `parse` gets to it — after the rules before it matched:

```trebol-console
>> parse "12 bell" [copy n amount " " copy p part]
== true
>> n
== "12"
>> p
== "bell"
>> parse "12 bell" [copy n amount (print ["amount:" n]) " " part]
amount: 12
== true
```

`collect` makes `parse` give a block instead of `true`, filled with what each `keep` keeps. `keep` keeps what its
rule matched, or the value of a paren. That is all the shop needs to turn a line into a block of amounts and
parts, ready to be priced:

```trebol
line: [copy n amount " " copy p part keep (to-integer n) keep (to-word p)]
order: [collect [line any [", " line]]]
```

```trebol-console
>> parse "2 chain, 1 tyre" order
== [2 chain 1 tyre]
```

## Parsing blocks

`parse` reads blocks too, and there a rule is a value: a datatype matches any value of that type, a lit-word
matches that word. This is how you check and read a dialect — a block of words and values with a meaning of your
own, like the order block above. `set` sets a word to the value the next rule matched:

```trebol-console
>> parse [2 chain 1 tyre] [some [integer! word!]]
== true
>> parse [2 chain tyre] [some [integer! word!]]
== false
>> parse [rush 2 chain] [opt 'rush some [integer! word!]]
== true
```

Pricing the order is now one rule. The words that `set` sets are not set-words, so `function` does not see them;
list them after `/local`:

```trebol
prices: #(chain: $12.50 tyre: $18.00 bell: $4.00)
total-of: function [order [block!] /local n p] [
    total: $0.00
    parse order [some [set n integer! set p word! (total: total + (n * prices/:p))]]
    total
]
```

```trebol-console
>> total-of parse "2 chain, 1 tyre" [collect [line any [", " line]]]
== $43.00
```

## Changing the input

People do not type as neatly as the rules: `2 chain ,1 tyre`, `2 chain,1 tyre`. Rather than make the rules
accept every way of typing a comma, the shop can tidy the line first. `change` replaces what its rule matched
with a value, `remove` takes it out, and `insert` puts a value in where `parse` is. All three change the input
itself, and `parse` goes on after what they put in:

```trebol
tidy: function [text [string!]] [
    parse text [any [change [any " " "," any " "] ", " | skip]]
    text
]
```

`skip` matches any one character, so the rule walks the whole line and changes each comma, with the spaces around
it, into `", "`:

```trebol-console
>> tidy copy "2 chain ,1 tyre"
== "2 chain, 1 tyre"
>> parse tidy copy "2 chain,1 tyre" order
== [2 chain 1 tyre]
```

A part with no amount means one of it. `ahead` checks that its rule matches without moving on, so the shop can
put `1 ` in front of a line that starts with a letter — at the start, and after each comma:

```trebol-console
>> one: [opt [ahead letter insert "1 "]]
== [opt [ahead letter insert "1 "]]
>> text: copy "bell, 2 tyre"
== "bell, 2 tyre"
>> parse text [one any [", " one | skip]]
== true
>> text
== "1 bell, 2 tyre"
```

The `1 ` goes in before the `b`, and `parse` goes on after it, at the `b`. Take care with a rule that inserts
without moving on: inside `any`, it would insert again and again at the same place. With `remove`, the rule takes
out the spaces people put before a line:

```trebol-console
>> text: copy "  2 chain"
== "  2 chain"
>> parse text [remove any " " to end]
== true
>> text
== "2 chain"
```

## What's next

Rules in a block, words that name them, values taken out on the way: `parse` is the tool Trebol reads its own
dialects with, the user interface among them, and on page 14 the shop writes one of its own. Before that, the
next step is about doing several things at once — waiting for a supplier's answer over the network while the
counter keeps working.
