<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Languages

Texts in several languages and values in the format of each. A text per language is a map,
`#(en: "Save" es: "Guardar")`. See [languages](../ui/08-languages.md).

(fn-translated)=
## translated

A text per language (a map) from a string in the main language or a block \[es ... en ...\].

```text
translated text
```

- `text` (`string!` `block!` `map!`)

(fn-tr)=
## tr

A text in the active language: from a string, a text per language, or a word of the dictionary.

```text
tr text
```

- `text` (`any-type!`)

(fn-localize)=
## localize

A value as a string in the format of the active language: dates, times, numbers, percents and money.

```text
localize value
```

- `value` (`any-type!`)

(fn-format-local)=
## format-local

The value as text in the way of a language: dates, numbers, money.

```text
format-local value language
```

- `value` (`any-type!`)
- `language` (`word!` `string!`)

(fn-set-language)=
## set-language

Changes the active language and shows every face again in it.

```text
set-language language
```

- `language` (`word!` `string!`)
