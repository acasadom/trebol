# Trebol

*Rebol's language, in the browser, for beautiful interfaces with no HTML or CSS.*

Trebol is [Rebol](http://www.rebol.com), the language Carl Sassenrath designed, implemented again in
TypeScript so that it runs in a web browser. On top of it is a user interface dialect in the spirit of
Rebol's VID: you describe what a screen is for, and Trebol draws it, accessible, in light and dark, on a
phone or a desktop.

```rebol
view [
    title "New repair"
    form [
        field customer "Customer" required
        money price "Price" EUR min 0
        submit "Save" [save values]
    ]
]
```

![A sign-up form in the light theme](docs/screenshots/signup-light.png)

Code is data: a screen is a block, so it can be built, stored, checked and changed with the language itself,
like any other value.

## What is in it

- **The language**: Rebol 3's values and evaluation, with exact 64-bit integers, exact money, dates, `parse`,
  objects, maps, errors as values and JSON built in. Where Rebol 3 and Red differ, Trebol usually takes Red's
  way.
- **Tasks that never block**: `fetch`, `wait` and the rest pause only the task that asked, anywhere, even in
  the middle of a `parse`. HTTP, WebSocket and server-sent events are built in.
- **The UI dialect**: forms with validation, tables, lists, dialogs, toasts, tabs, menus, trees, screens with
  their own links, languages, drawings with Red's draw dialect, charts, images behind the screen, photos,
  video and sound, in nine looks and five skins, all from a theme of a few parameters. No CSS.
- **A console** like Rebol's, and a development server that reloads on save.

## Getting started

A page needs two lines, one that brings Trebol and one that runs the app:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/trebol@0.1/dist/trebol.js"></script>
<script type="text/trebol" src="app.trb"></script>
```

Any server of plain files will do. To write apps with the console and a development server that reloads the
page on save, install it with Node.js 22.18 or later:

```sh
npm install trebol
npx trebol                # the console: >> 1 + 2 * 3  == 9
npx trebol dev my-app     # serves the folder my-app, with its app.trb, at http://localhost:5173/
npx trebol check my-app/app.trb   # the mistakes in its views, without running it
```

`node_modules/trebol/editors/vscode` is an extension that colors `.trb` files in Visual Studio Code: copy it
into `~/.vscode/extensions/trebol` and restart VS Code.

A JavaScript program can run Trebol too, through `trebol/host` and `trebol/core`; see
[using Trebol from JavaScript](https://acasadom.github.io/trebol/guides/architecture.html#using-trebol-from-javascript).

## Working on Trebol

There is no build step while working on Trebol: Node runs the TypeScript directly.

```sh
npm install
npm run check        # type check and every test
npm run trb          # the console
npm run dev          # the examples, at http://localhost:5173/examples/signup/
npm run build        # dist/trebol.js and dist/cli.js, what the npm package runs
npm run grammar      # the editor grammar, editors/vscode/syntaxes/trebol.tmLanguage.json
```

A release is a tag: `npm version minor` (or `patch`) and `git push --follow-tags`. The `release` workflow checks
the tagged commit and stages it on npm, where a maintainer approves it with `npm stage approve`.

## Documentation

The documentation is at <https://acasadom.github.io/trebol/>. It has two tutorials,
one for the language and one for the screens, where every example is run by the test suite and every UI
example is the real app running under its code; a reference of every function; a guide for people who know
Rebol; and guides to how Trebol is built.

`npm run docs:serve` builds it from `docs/` and serves it at http://localhost:8000/.

## Layout

| Folder | What is there |
| --- | --- |
| `src/core` | the language: values, `load` and `mold`, binding, the evaluator, natives, `parse` |
| `src/host` | the world: tasks, network, files, the console, the DOM and the theme |
| `src/ui` | the UI dialect, written in Trebol |
| `test` | tests in TypeScript, and the language suites in Trebol (`test/trebol`) |
| `examples` | sample apps: `signup`, `clients`, `gallery`, `live`, `designer` |
| `docs` | the documentation site |
| `tools` | the `trebol` command, the console, the documentation builders |
| `editors` | the Visual Studio Code extension and its TextMate grammar |

## Thanks

Trebol stands on the work of Carl Sassenrath and REBOL Technologies, Nenad Rakočević and the Red team,
Oldes and the contributors to his Rebol 3, Brian Dickens and the Ren-C project, and Rasmus Andersson's
Inter typeface. The first page of the documentation says what each of them gave.

## License

Apache License 2.0. See [LICENSE](LICENSE).
