# 1. Getting started

Over this tutorial we write the back office of **Cog & Chain**, a small bicycle repair shop: what its
parts cost, what a repair comes to, when each bike is due back. There is no screen yet — only the
language, one idea per page. The second tutorial gives the shop its windows.

This first page gets Trebol running, opens its console and runs a first script.

## What you need

Trebol runs on [Node.js](https://nodejs.org) 22.18 or later; there is nothing to compile. Make a folder for
the shop and install Trebol in it:

```sh
mkdir cog-and-chain
cd cog-and-chain
npm install trebol
```

That puts Trebol in the folder's `node_modules`, and `npx trebol` runs it from there.

## The console

The console is where you try things. Open it:

```sh
npx trebol
```

It greets you and waits at a `>>` prompt. Type an expression and press Enter; Trebol shows its value after
`==`:

```trebol-console
>> 1 + 2
== 3
>> print "Hello, Cog & Chain"
Hello, Cog & Chain
```

`print` writes a line and has no value of its own to show, so no `==` follows it. Type `q` to leave the
console.

## Left to right

The first surprise is arithmetic. Trebol has no operator precedence: it evaluates from left to right, one
operator at a time.

```trebol-console
>> 2 + 3 * 4
== 20
>> 2 + (3 * 4)
== 14
```

`2 + 3 * 4` is `(2 + 3) * 4`. Parentheses group, as everywhere. The rule is short to learn and never
changes, whatever the operators — a price list, a date, a percentage all follow it.

## Mistakes are fine

When something goes wrong, Trebol says what and where, and the console carries on:

```trebol-console
>> 10 / 0
** Math error: attempt to divide by zero
** Where: /
** Near: [10 / 0]
** At: 1:1
>> 10 / 4
== 2.5
```

## A first script

A script is a text file whose first word is `Trebol` and a block, its *header*, describing it. Save this as
`shop.trb`:

```trebol
Trebol [title: "Cog & Chain"]

; A semicolon starts a comment: Trebol skips the rest of the line.
print "Cog & Chain, bicycle repairs"
print 12 * 3
```

and run it:

```sh
npx trebol shop.trb
```

```text
Cog & Chain, bicycle repairs
36
```

The header can hold more than a title, as you will see later, but `Trebol []` is enough.

## The trebol command

`npx trebol` does one of these things, by what follows it:

```sh
npx trebol                         # the console
npx trebol shop.trb                # runs a script
npx trebol dev [folder]            # serves an app (the second tutorial)
npx trebol check [app.trb ...]     # the mistakes in an app's views, without running it
npx trebol supplier                # the parts supplier of page 12, on port 8089
```

In the console, a line that leaves a block, a paren or a string open is not run yet: the prompt turns into
`[` and waits for the rest, so a function can be typed over several lines.

```text
>> double: func [n] [
[      n * 2
[  ]
>> double 21
== 42
```

Ctrl+C drops what is being typed; on an empty prompt it leaves, as do `q` and Ctrl+D. With no terminal, the
console runs what it is given instead, so a script can come through a pipe: `echo "print 1 + 2" | npx trebol`.

`dev` serves the folder (the current one by default) at <http://localhost:5173/>; `--port 8080` picks another
port, and `--api api.ts` lets a module of yours answer requests before the files are served: its
`handleApi(req, res, url)` answers the ones it knows and gives `false` for the rest, so an app can bring a
small server of its own while it is being written.

## Colors in the editor

Trebol comes with an extension for [Visual Studio Code](https://code.visualstudio.com) that colors `.trb`
files: comments, strings, numbers, money and dates, words being set, datatypes and the words that decide and
repeat each get a color of their own, and `;` comments a line out (Ctrl+/ or Cmd+/). Copy it into VS Code's
extensions folder and restart VS Code:

```sh
cp -R node_modules/trebol/editors/vscode ~/.vscode/extensions/trebol
```

On Windows the folder is `%USERPROFILE%\.vscode\extensions`. The extension holds a TextMate grammar
(`syntaxes/trebol.tmLanguage.json`), the format most editors read, so others can use it too.

GitHub has no colors of its own for Trebol yet. A line in a `.gitattributes` file at the top of your
repository has it color `.trb` files as Rebol, which reads them well:

```text
*.trb linguist-language=Rebol
```

## What's next

So far the shop has a name and some numbers. In [the next step](02-values) it gets prices, a tax rate
and due dates — and you will see that Trebol knows the difference between them.
