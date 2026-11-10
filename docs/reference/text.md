<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Text

Making text from values, and changing text. `form` gives text for people to read, `mold` text that `load`
reads back as the same value. Strings are series too, so every series function works on them. See
[text](../language/09-text.md).

(fn-form)=
## form

The value as text for people to read.

```text
form value
```

- `value` (`any-type!`)

(fn-mold)=
## mold

The value as Trebol source text, the way you would type it.

```text
mold value
```

- `value` (`any-type!`)
- `/only`
- `/all`

(fn-reform)=
## reform

Reduces a block and forms it: the values with spaces between. Any other value is formed.

```text
reform value
```

- `value` (any value)

(fn-rejoin)=
## rejoin

Reduces a block and joins the values into one series, of the type of the first.

```text
rejoin block
```

- `block` (`block!`)

(fn-ajoin)=
## ajoin

Reduces a block and joins the values into a string, with no spaces.

```text
ajoin block
```

- `block` (`block!`)

(fn-reword)=
## reword

Makes a copy of a template with each keyword, marked by an escape ($ by default), replaced by its value.

```text
reword source values
```

- `source` (`any-string!`)
- `values` (`block!` `map!` `object!`): Keywords and their values; a function value is called with the keyword
- `/case`: Keywords are case-sensitive
- `/only`: Uses the values of a block as they are, without reducing it
- `/escape char` (`char!` `any-string!` `block!` `none!`): Marks keywords another way; char: A prefix, a \[prefix suffix\] block, or none for no mark

(fn-uppercase)=
## uppercase

Changes the text to capitals.

```text
uppercase string
```

- `string` (`any-string!` `char!`)
- `/part length` (`integer!`)

(fn-lowercase)=
## lowercase

Changes the text to small letters.

```text
lowercase string
```

- `string` (`any-string!` `char!`)
- `/part length` (`integer!`)

(fn-trim)=
## trim

Removes spaces at both ends, or with refinements other spaces too.

```text
trim series
```

- `series` (`any-string!` `block!`)
- `/head`
- `/tail`
- `/lines`
- `/all`

(fn-split)=
## split

Splits a series at a delimiter, or into pieces of a size.

```text
split series dlm
```

- `series` (`any-string!` `block!`)
- `dlm` (`any-string!` `char!` `integer!`)
