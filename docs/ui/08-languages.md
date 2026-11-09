# 8. Languages

The shop has customers who speak English and customers who speak Spanish. This page gives its screens both
languages: the texts, the messages Trebol writes by itself, and the way dates and amounts are shown and typed.
The people using the app switch from one language to the other while it runs, and nothing they typed is lost.

## A text in each language

Wherever a screen takes a text, it also takes a **text per language**: a map from each language to its text.
`set-language` changes the active language, and every text on the screen changes with it:

```trebol-ui
view [
    row [
        title #(en: "Book a repair" es: "Reservar una reparación")
        button #globe #(en: "Language" es: "Idioma") menu [
            "English" en "Español" es
        ] on-menu [set-language event/picked]
    ]
    form [
        field customer #(en: "Customer" es: "Cliente") required
        field phone #(en: "Phone" es: "Teléfono")
        submit #(en: "Book in" es: "Reservar") [
            toast/role #(en: "Booked in." es: "Reservado.") 'success
        ]
    ]
]
```

Try it: leave the customer empty, press the button, then switch to Spanish. The message under the field
changes language too. Trebol's own texts, like that message, come in English and Spanish already, and they
name the field in the active language.

A face keeps its text as it was written, the map with both languages, and shows the one that is active. When
the active language has no text, it shows the text in the **main** language, `i18n/main`, and failing that
any text the map has. Trebol starts with English as both the active and the main language.

## A dictionary

Writing both languages at every place soon gets long, and the same words come back on many screens. The
app's **dictionary**, `i18n/texts`, holds a text per language for each word; a word of the dictionary, quoted,
stands for its text:

```trebol-ui
i18n/texts: make map! [
    book-repair #(en: "Book a repair" es: "Reservar una reparación")
    customer #(en: "Customer" es: "Cliente")
    bike #(en: "Bike" es: "Bici")
    due #(en: "Due back" es: "Para el día")
    price #(en: "Price" es: "Precio")
    book-in #(en: "Book in" es: "Reservar")
    booked #(en: "Booked in." es: "Reservado.")
    language #(en: "Language" es: "Idioma")
]

view [
    row [
        title 'book-repair
        button #globe 'language menu ["English" en "Español" es] on-menu [set-language event/picked]
    ]
    form [
        field customer 'customer required
        date due 'due
        money price 'price EUR
        submit 'book-in [toast/role 'booked 'success]
    ]
    global table board [customer 'customer due 'due price 'price]
]

board/data: [
    #(customer: "Ada Lovelace" due: 11-Nov-2026 price: EUR$1250.00)
    #(customer: "Grace Hopper" due: 2-Dec-2026 price: EUR$48.50)
]
```

Table headers, menu items, tabs and the titles of screens take a word of the dictionary just the same. A word
the dictionary does not have shows as it is written, so a missing text is easy to spot on the screen.

## Dates and amounts

The table above shows the same values in both languages, but not the same way. In English the first booking
is due on 11/11/2026 and costs €1,250.00; in Spanish it is due on 11/11/2026 too, but it costs 1250,00 €, and
the second one is due on 2/12/2026, not 12/2/2026. Dates, times, numbers, percents and amounts are shown in
the format of the active language, in tables, lists, texts and titles alike.

The fields read them that way as well. In Spanish, a date is typed day first, `2/12/2026`; in English, month
first, `12/2/2026`; and `2026-12-02` is understood in both. An amount is edited without thousands, with the
decimal separator of the language, `48,50` in Spanish; while it is not being edited, it shows formatted. What
the program receives is the same in any language: a `date!` and a `money!`, never the text that was typed.

In code, `localize` gives a value as the active language shows it, as a string:

```trebol-ui
view [
    button #globe "Language" menu ["English" en "Español" es] on-menu [set-language event/picked]
    button "Price" [toast localize EUR$12500]
    button "Due back" [toast localize 2-Dec-2026]
]
```

In Spanish that price is `12.500,00 €`, while the `1250,00 €` of the table has no thousands separator: the
rules of the language leave it out of numbers of four digits. When a screen needs another format, it shows a
string made in code instead.

## Choices

An option of a `choice` or a `radio` written as a string is both what the program receives and what the
person reads, so it does not change with the language. When it should, the option is a map with the `value`
the program receives and the `text` to show, which can be a text per language:

```trebol-ui
view [
    button #globe "Language" menu ["English" en "Español" es] on-menu [set-language event/picked]
    form [
        choice bike #(en: "Bike" es: "Bici") [
            #(value: road text: #(en: "Road" es: "Carretera"))
            #(value: mountain text: #(en: "Mountain" es: "Montaña"))
            #(value: city text: #(en: "City" es: "Paseo"))
        ] required
        submit #(en: "Book in" es: "Reservar") [toast form values/bike]
    ]
]
```

Whatever language was used to choose, `bike` is `road`, `mountain` or `city`.

## Texts made in code

Code that makes a text to show uses `tr`, which gives a text per language, or a word of the dictionary, in the
active language:

```trebol-ui
i18n/texts/today: #(en: "Today" es: "Hoy")

view [
    button #globe "Language" menu ["English" en "Español" es] on-menu [set-language event/picked]
    button 'today [toast rejoin [tr 'today ", " localize now/date]]
]
```

`tr` gives the text of the moment: a string made with it stays in the language it was made in. A text that
must follow the language is given to the face as it is, the word or the map, and the face translates it.

## Trebol's own texts

What Trebol writes by itself, the messages of the rules and the texts of its components (Close, Back, Choose
file, Nothing to show yet...), is in a dictionary of its own, `i18n/ui`, apart from the app's so that no word
of the app changes one of Trebol's. An app changes one of them, or adds a language to it. Here the message of `required` is the app's own, and
it speaks French as well:

```trebol-ui
i18n/ui/required: #(en: "Please fill this in" es: "Rellena este campo")
i18n/ui/required/fr: "Ce champ est obligatoire"

view [
    button #globe "Language" menu ["English" en "Español" es "Français" fr] on-menu [set-language event/picked]
    form [
        field customer #(en: "Customer" es: "Cliente" fr: "Client") required
        submit #(en: "Book in" es: "Reservar" fr: "Réserver") [toast/role "OK" 'success]
    ]
]
```

In the messages of the rules, `#1` and `#2` stand for the values of the rule: `i18n/ui/min` is
`#(en: "Must be at least #1" ...)`.

## An app written in Spanish

Trebol starts in English. An app whose plain strings are Spanish says so, and starts in Spanish:

```trebol-ui
i18n/main: 'es
set-language 'es

view [
    title "Reservar una reparación"
    form [
        field customer "Cliente" required
        money price "Precio" EUR min 10
        submit "Reservar" [toast/role "Reservado." 'success]
    ]
]
```

`i18n/main` says what language the app's plain strings are in, and so what shows when a text per language
lacks the active one. `i18n/language` is the active language; it is read, but changed with `set-language`,
which also shows every face again in it and tells the browser what language the page is in, for screen readers
and spelling. A language is a tag like `en`, `es`, or `en-GB` for British dates; texts that have no `en-GB`
fall back to the main language.

## What's next

The bookings so far live and die with the page. The next page keeps them on a server: it fetches the board,
sends the new bookings, and shows what the server says when something goes wrong.
