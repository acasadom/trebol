# Trebol

*Rebol's language, in the browser, for beautiful interfaces with no HTML or CSS.*

## On the shoulders of giants

Trebol is not a new language. It is **Rebol**, the language **Carl Sassenrath** designed and released in
1997, implemented again so that it runs in a web browser. The ideas that make Trebol worth using — code
that is data, dialects, a whole user interface described in a few lines with VID — are his. What is ours
is the implementation, the parts a browser needs, and the mistakes.

We learned from the work of many people, and we are grateful to all of them:

- **Carl Sassenrath** and REBOL Technologies: Rebol 1 and 2, VID (the Visual Interface Dialect), and
  Rebol 3, whose source was opened under the Apache 2.0 license in 2012. The Rebol 3 GUI design notes
  shaped how Trebol's layouts keep their names to themselves.
- **Nenad Rakočević** and the Red team: [Red](https://www.red-lang.org), the living heir of Rebol, which
  we follow whenever Rebol 3 and Red differ — event names, `#(...)` maps, and much else.
- **Oldes** and the contributors to his [Rebol 3](https://github.com/Oldes/Rebol3), who kept Rebol 3 alive
  and growing.
- **Brian Dickens** and the [Ren-C](https://github.com/metaeducation/ren-c) project, whose deep study of
  binding helped us choose a simpler model knowing what it leaves out.
- **Rasmus Andersson**, for the [Inter](https://rsms.me/inter/) typeface the default theme is designed
  around.

Trebol tries never to be worse than Rebol 3 or Red at what they already do. Where it is, that is a bug.

## Why learn it

Rebol has never had the attention, or the admiration, it deserves. A Rebol program reads like a description of what it does,
and the same few rules carry you from a calculation to a network client to a full application window.
Its secret is that **code is data**: a block of words is something you can store, pass around, inspect
and change before you run it — or never run, and read as a little language of your own. Trebol uses
that to describe user interfaces as plain blocks:

```text
view [
    title "New repair"
    form [
        field customer "Customer" required
        money price "Price" EUR min 0
        submit "Save" [save values]
    ]
]
```

That is a complete, accessible form, in light and dark, on a phone or a desktop, with no HTML and no CSS.

## Learn the language

This first tutorial teaches the language on its own, in the console, with no windows at all. Over its
pages you write the back office of **Cog & Chain**, a small bicycle repair shop: its prices, its repair
orders and their due dates. Every console session and every script on every page is run by Trebol's test
suite, so what you read is what Trebol does.

```{toctree}
:maxdepth: 1
:caption: Learn the language

language/01-getting-started
language/02-values
language/03-words-and-blocks
language/04-deciding-and-repeating
language/05-functions
language/06-objects-and-maps
language/07-errors
language/08-series
language/09-text
```

The second tutorial gives the shop its screens; the reference and the technical guides follow it.
