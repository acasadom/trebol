<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# The console

Printing, and the console's help: `help` (or `?`) explains a function, `??` shows a word and its value, and
`source` shows a function's code. See [getting started](../language/01-getting-started.md).

(fn-print)=
## print

Prints a value; a block is reduced first.

```text
print value
```

- `value` (`any-type!`)

(fn-write-line)=
## write-line

Writes a value and a new line to the output.

```text
write-line value
```

- `value` (`any-type!`)

(fn-probe)=
## probe

Prints a value as mold shows it; gives the value.

```text
probe value
```

- `value` (`any-type!`)

(fn-help)=
## help

Shows how to call a function, or what a word holds.

```text
help 'word
```

- `'word` (`any-type!`): The word to explain

(fn--3f)=
## ?

Shows how to call a function, or what a word holds.

```text
? 'word
```

- `'word` (`any-type!`): The word to explain

(fn--3f-3f)=
## ??

Prints a word and its value.

```text
?? 'word
```

- `'word` (`any-word!`)

(fn-source)=
## source

Prints the source of a function.

```text
source 'word
```

- `'word` (`any-word!`)
