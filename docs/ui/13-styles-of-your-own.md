# 13. Styles of your own

Every style Trebol has is defined the way a program defines one: it is made from another style, starts with
some fields, and says what may be written after it. `stylize` gives you the same means, so a style of your
own takes words, values and blocks of its own, and `trebol check`, the reference and a designer know them as
they know Trebol's. Nothing in Trebol itself changes.

## A style from another

The simplest style of your own is one that starts with other fields. `stylize` takes a name, the style it is
made from, and a block of fields:

```trebol-ui
stylize [
    big: button [size: 'large]
    note: text [role: 'muted]
]
view [
    note "Saved two minutes ago"
    big "Book in"
]
```

`big` is a button in every other way: it takes a text, an icon, `primary`, a block to run. It takes what
`button` takes, because it is made from it.

## Words of its own

A style says what may follow it in `takes:`, a block of entries among its fields. Each entry names the field it
fills, then how it is written. Here a badge takes `tone` and one of two words:

```trebol-ui
stylize [
    badge: text [
        role: 'accent
        takes: [
            role: 'tone one-of [calm alert] :tone-role "how loud it is"
        ]
    ]
]
tone-role: func [w] [select [calm muted alert danger] w]
view [
    badge "3 new"
    badge "Overdue" tone alert
]
```

`role: 'tone one-of [calm alert] :tone-role` reads: the word `tone`, then one of `calm` or `alert`, turned by
the function `tone-role`, fills the field `role`. The string at the end says what the entry is, for the
reference and a designer. A function can say no: when it gives none, the entry did not take the value, and the
next one may.

What the style does not take is a problem of the layout, the same as for Trebol's styles. With these lines in
the view, `trebol check` says:

```text
    badge "Overdue" tone loud
    badge "Soon" tine calm
```

```text
app.trb:13:21  tone takes one of calm or alert
app.trb:14:18  tine is not a word of badge; did you mean tone?
```

## Every way an entry is written

| Entry | Written in a layout |
| --- | --- |
| `stars: 'stars [integer!]` | the word, then a value of one of the types: `stars 5` |
| `half: 'half` | the word alone, a flag: the field becomes true |
| `tint: [tuple!]` | a value of the type, with no word: `255.200.0` |
| `kind: one-of [bar line]` | one of the words: `bar` |
| `items: block :items-of` | a block, in its turn among the blocks after the face |
| `min: rule 'min [number!]` | adds the rule `[min 5]` to the face's rules |
| `name: first name` | right after the style, a word that names the field |
| `props/zoom: 'zoom [integer!]` | fills a field of an object the face holds |

An entry may take several values (`length: rule 'length [integer!] [integer!]`, `length 2 40`); its function
then gets them as a block. Types are datatypes, `text` for a string, a text per language or a quoted word of the
dictionary, or `one-of` and a list. `first` before an entry means it is read only right after the style.

Three entries are not fields. `on: [on-rate]` says which events the style fires, so a layout may handle them and
check finds a mistyped one; `done: :fill-it` names a function run once a face of the style is read, to check
it or fill it in; `written: false` says another face makes it and a layout does not write it.

A function of an entry, or of `done`, takes the value (or the face, for `done`), and may also take the face and
the place it was written, to say what is wrong with `ui-problem`.

## A field of its own

A field the style adds is one of its fields, given a start in its block. A star rating made from `number`, with
how many stars it shows:

```trebol-ui
stylize [
    stars: number [
        most: 5
        takes: [
            most: 'of [integer!] "how many stars it shows"
            done: :stars-ready
        ]
    ]
]
stars-ready: func [f] [add-rule f reduce ['min 0]  add-rule f reduce ['max f/most]]
view [
    form [
        stars rating "How was it?" of 10 required
        submit "Send" [print values]
    ]
]
```

It takes what `number` takes too: a name right after the style, `required`, a check. A style made from `stars`
would take all of that, and more.

## A style made of others

A style made from a container (`column`, `row`, `panel`) may say in `layout:` the faces each face of it holds.
Inside that block, `it` is the face written in the layout, so `is [it/value]` follows its field as any reaction
follows a face's (`face` is still the face that reads it):

```trebol-ui
stylize [
    tally: column [
        takes: [value: [integer!] "how many"]
        layout: [
            text muted is [it/text]
            heading is [it/value]
            text muted is [it/hint]
        ]
    ]
]
view [
    row [
        tally "Bikes in" 12 "3 since this morning"
        tally "Waiting for parts" 4 "the oldest since Monday"
    ]
]
```

Each `tally` gets faces of its own, and the labels written in `layout:` belong to that face only: the layout
around it does not see them. `trebol check` reads the faces of `layout:` as it reads any others, so a mistake in
them is a problem of every layout that uses the style.

Where `layout:` says `slot`, go the faces written in a block after the style, read where they are written, so
they see that layout's labels:

```trebol-ui
stylize [
    section: panel [layout: [heading is [it/text]  slot]]
]
view [
    bike: field "Bike"
    section "Booking" [
        text is [join "For " any [bike/value "..."]]
        button "Book in"
    ]
]
```

A face of such a style shows only what its layout says: `section` is a panel, but its text is not drawn as the
panel's title, only where the layout puts it. A style whose layout has no `slot` takes no block: giving it one is a problem of the layout. A style made from
one with a `layout:` holds the same faces, unless it says a `layout:` of its own.

## Styles to make others from

Four styles are only made from, never written: `face`, where every style starts; `container`, a face that holds
others (`pad`, `gap`, its children); `input`, a face with a value in a form (a name, rules, `readonly`); and
`rows-face`, a face that shows rows (`columns`, `key`). A style of your own may start from any of them; as none
of them is shown, it says how it is shown with `style:` (one of the styles the host draws) or, for an element
of the page's own JavaScript, by being made from `widget`:

```text
stylize [
    geo-map: widget [
        tag: "geo-map"
        takes: [props/zoom: 'zoom [integer!] "how near it shows"]
    ]
]
view [geo-map place "Where" zoom 12]
```

## The view is a style too

`view` is a style made from `container`, and the words before its first face are read by what it takes. A
program or a package gives it words of its own as to any style, by making `view` from itself:

```text
stylize [view: view [caption: none  takes: [caption: 'caption text "what the window is called"]]]
view [caption "Bookings" text "Today"]
```

A screen's block is read the same way by the style `screen`.

## The last way out: with

When no word of a style sets a field, `with` runs a block bound to the face once the rest of it is read:

```trebol-ui
view [text "Closed" with [role: 'danger]]
```

Use it for the odd case. `trebol check` does not run it and a designer can only show it as code, so a field you
set this way often is better given a word in the style's `takes:`.

## Sharing styles

A style of your own lives in any file: import the file, or the package, and its styles are in the dialect, as
the rules of [a package](../language/13-modules.md) are. `trebol check` runs the imports at the top of a file
first, so it knows them. The [reference of the styles](../reference/styles.md) lists what each of Trebol's takes,
written from the same `takes:` blocks.
