# Languages

Texts in several languages and values in the format of each. A text per language is a map,
`#(en: "Save" es: "Guardar")`. See [languages](../ui/08-languages.md).

## translated

## tr

## localize

## format-local

## day-label

```trebol-console
>> day-label now
== "Today"
>> day-label 1-Jan-2020
== "Wednesday, January 1, 2020"
```

## local-date

A date with a zone is a moment anywhere; `local-date` says it as the clock where the page is read it then,
in its summer time or its winter time. A page in New York:

```trebol
local-date 1-Jul-2026/4:30+0:00   ; 1-Jul-2026/0:30, summer time
local-date 1-Dec-2026/4:30+0:00   ; 30-Nov-2026/23:30, winter time
local-date 1-Dec-2026             ; 1-Dec-2026, no time: as it is
```

## time-ago

```trebol-console
>> time-ago now - 0:05
== "5 minutes ago"
```

## set-language
