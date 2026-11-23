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

(fn-day-label)=
## day-label

The day of a date said in the active language, from today where the page is: Today, Yesterday, Tomorrow, or its weekday and date, with the year when it is another.

```text
day-label date
```

- `date` (`date!`)

```trebol-console
>> day-label now
== "Today"
>> day-label 1-Jan-2020
== "Wednesday, January 1, 2020"
```

(fn-local-date)=
## local-date

The moment a date names as the clock where the page is read it then, with no zone: in New York 1-Jul-2026/4:30+0:00 is 1-Jul-2026/0:30, and 1-Dec-2026/4:30+0:00 is 30-Nov-2026/23:30. A date with no time or no zone stays as it is.

```text
local-date date
```

- `date` (`date!`)

A date with a zone is a moment anywhere; `local-date` says it as the clock where the page is read it then,
in its summer time or its winter time. A page in New York:

```trebol
local-date 1-Jul-2026/4:30+0:00   ; 1-Jul-2026/0:30, summer time
local-date 1-Dec-2026/4:30+0:00   ; 30-Nov-2026/23:30, winter time
local-date 1-Dec-2026             ; 1-Dec-2026, no time: as it is
```

(fn-time-ago)=
## time-ago

How long ago a date was, or how long until it, in the active language: now, 5 minutes ago, 3 hours ago, in 2 days. A date with no time is said in days.

```text
time-ago date
```

- `date` (`date!`)

```trebol-console
>> time-ago now - 0:05
== "5 minutes ago"
```

(fn-set-language)=
## set-language

Changes the active language and shows every face again in it.

```text
set-language language
```

- `language` (`word!` `string!`)
