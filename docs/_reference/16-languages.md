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

## time-ago

```trebol-console
>> time-ago now - 0:05
== "5 minutes ago"
```

## set-language
