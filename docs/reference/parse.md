<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Parse

`parse` reads a series with a block of rules, a dialect of its own for matching text and blocks. See
[parse](../language/11-parse.md).

(fn-parse)=
## parse

Checks the input against a block of rules; true if they match all of it.

```text
parse input rules
```

- `input` (`series!`)
- `rules` (`block!`)
- `/case`

The rules are a block. In it, a value matches itself in the input, and a word matches what it names: a
string, a character, a bitset made with `charset`, another block of rules. In a block, a datatype such as
`integer!` matches any value of it. Rules written one after another match one after another; `|` separates
alternatives, tried in order. These words do the rest:

| Rule | Matches |
| --- | --- |
| `opt rule` | the rule, or nothing |
| `some rule` | the rule once or more, as many times as it can |
| `any rule` | the rule as many times as it can, none included |
| `while rule` | like `any`, but goes on even when a turn matches without moving, so the rule must stop it |
| `3 rule`, `2 4 rule` | the rule exactly 3 times, from 2 to 4 times |
| `skip` | any one value |
| `to rule`, `thru rule` | everything up to the rule; up to and including it |
| `end` | the end of the input |
| `quote value` | the value itself, even when it is a word or an integer |
| `not rule` | nothing, when the rule does not match here |
| `ahead rule` | nothing, when the rule does match here |
| `into rule` | a block (or string) in the input, matched inside by the rule |
| `none` | nothing, always |
| `fail` | never |
| `if (code)` | nothing, when the code gives a true value |
| `break`, `accept` | nothing: leave the rule block as a match (and end a repetition it is in) |
| `reject` | leave the rule block as a failure |
| `return rule` | stop `parse`, which gives what the rule matched |

These keep or change what was matched:

| Rule | Does |
| --- | --- |
| `(code)` | runs the code, where it is in the rules |
| `word:`, `:word` | sets the word to the input at this position; moves the input to where the word says |
| `set word rule` | sets the word to the first value the rule matched |
| `copy word rule` | sets the word to a copy of all the rule matched |
| `collect [rules]`, `keep rule` | `parse` gives a block of what each `keep` matched (`keep (code)`: what the code gives) |
| `collect set word [rules]` | the same block, set to the word; `parse` gives true or false as usual |
| `remove rule` | removes what the rule matched from the input |
| `insert value` | puts the value into the input here (`insert only` puts a block as one value) |
| `change rule value` | changes what the rule matched for the value |

Without `/case`, text matches whatever its case: `"Chain"` matches `"chain"`.

(fn-charset)=
## charset

Makes a bitset of characters, for parse.

```text
charset spec
```

- `spec` (`char!` `integer!` `any-string!` `binary!` `block!`)

(fn-complement)=
## complement

The opposite: a bitset of everything else, a logic negated, an integer with its bits flipped.

```text
complement value
```

- `value` (`bitset!` `logic!` `integer!`)
