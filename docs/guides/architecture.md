# How Trebol is built

This guide and the ones after it are for people who want to know how Trebol works inside: to change it,
to port it, or to judge whether to trust it. Each guide says what a part does, why it is that way, how it
is done, and which other ways there were.

## Four layers

```text
┌──────────────────────────────────────────────────────────────┐
│ Your app (.trb)      view [...], functions, data             │
├──────────────────────────────────────────────────────────────┤
│ UI dialect (Trebol)  layout: the dialect → a tree of faces   │  src/ui
│                      styles, validation, events, languages   │
├──────────────────────────────────────────────────────────────┤
│ Core (TypeScript)    load · mold · binding · evaluator ·     │  src/core
│                      natives · parse · JSON                  │
├─────────── await, show ↓            ↑ resume, events ────────┤
│ Host (TypeScript)    scheduler · DOM · fetch, WebSocket,     │  src/host
│                      SSE · theme to CSS · console · files    │
├──────────────────────────────────────────────────────────────┤
│ Browser or Node                                              │
└──────────────────────────────────────────────────────────────┘
```

- **The core** is the language and nothing else. It turns text into values (`load`), values back into text
  (`mold`), binds words, evaluates, and has the natives that need no outside world: series, math, text,
  `parse`, JSON. It never imports the DOM, `window` or a Node API.
- **The host** is everything that touches the world: the task scheduler, the network, the clock, local
  storage, the console, files, and in the browser the DOM and the theme's CSS. The same host code runs in
  Node, which is how `npm run trb` and the test suite run Trebol without a browser.
- **The UI dialect** is written in Trebol, in `src/ui/ui.trb`. It reads a `view [...]` block with `parse`,
  applies styles, and gives the host a tree of faces to draw. Validation, events and translations are
  Trebol code too.
- **Your app** is `.trb` files. A folder with an `app.trb` and nothing else is a complete app: `trebol dev`
  makes up the HTML page it needs.

The core talks to the host in two ways only. A native that has to wait, such as `fetch`, gives the
evaluator a promise to wait on (see [](evaluator.md)); and the UI calls `show` to have its faces drawn. The
host talks back by resuming a task that waited, or by starting a new task when an event arrives.

## Why this shape

**The core is meant to outlive TypeScript.** Trebol is written in TypeScript so that it runs in a browser
with nothing to install. One day the core may be rewritten in Zig, for a small native desktop runtime or
for speed. Everything that would make that port hard is kept out of `src/core`, by rules every change
follows:

| Rule in the TypeScript core | Why it helps a port |
| --- | --- |
| No DOM, no `window`, no Node API | a Zig core has no browser either |
| Values are fixed-shape records tagged by `t` | they become a tagged union of 16 bytes |
| No JavaScript closures stored in values | Zig has none; state must be explicit data |
| Natives return a `Step` and never call the evaluator | the evaluator without recursion copies over as it is |
| Errors are `Step`s, not exceptions | no `setjmp`/`longjmp` |
| Strings are arrays of code points | the same indexes in UTF-32 |
| Promises only at the host boundary | in Zig: an id of a pending operation the host resolves |
| As much as possible written in Trebol | Trebol code needs no port at all |
| The test suites are written in Trebol | the same suites check both cores |

**The UI is written in Trebol because Rebol's whole idea is dialects.** If Trebol could not write its own
UI dialect in itself, with `parse` and blocks, it would not be much of a Rebol. And every line of
`ui.trb` is a line that never needs porting.

**HTML and CSS are an implementation detail.** You describe intent, a form, a main action, a list, and the
host decides how that becomes DOM nodes and styles. This is what lets the same `view` block be a desktop
form, a phone form, light or dark, and in nine looks, without changing a word of it.

## Why this way — and the alternatives

- **Compile Trebol to JavaScript** instead of interpreting it. It would be faster, but Rebol code changes
  itself and builds code at run time (`do`, `compose`, `bind`), so a compiler would end up shipping an
  interpreter anyway, and pausing a task in the middle of anything would be much harder.
- **Write the core in Zig or Rust now, compiled to WebAssembly.** That would be the final shape sooner, but
  every call between the DOM and WebAssembly crosses a boundary, strings must be copied both ways, and the
  development loop is slower. TypeScript first, with rules that keep the port open, gets a working language
  now and keeps the option.
- **Write the UI layer in TypeScript.** It would be faster to write at the start, and every change to it
  would then be a change to the host. In Trebol, the dialect is data the language can read, and the UI is a
  proof that dialects work.
- **Use a JavaScript UI framework** (React, Vue, Svelte) under the dialect. The dialect maps one face to
  one DOM node and changes only what changed (see [](ui.md)), so a framework would add a second model of
  the screen to keep in step with the first, and a dependency that changes on its own timetable.

## Where things are

| Path | What is there |
| --- | --- |
| `src/core/` | `kinds.ts` type ids, `symbols.ts`, `values.ts` cells and series, `int64.ts`, `dec.ts`, `lexer.ts`, `mold.ts`, `ctx.ts` binding, `func.ts`, `eval.ts`, `errors.ts`, `natives/`, `mezz.ts` functions written in Trebol, `boot.ts` |
| `src/host/` | `index.ts` start-up, `scheduler.ts`, `net.ts`, `modules.ts`, `browser.ts` the DOM, `theme.ts`, `locale.ts`, `icons.ts` |
| `src/ui/` | `ui.trb` the dialect, `i18n.trb` languages |
| `test/` | tests in TypeScript, and `test/trebol/*.trb`, the language suites in Trebol |
| `tools/` | the console, `trebol dev`, the documentation builders, `r3check` |

There is no build step while working on Trebol. Node runs the TypeScript files directly (it strips the types
as it loads them), and `trebol dev` strips them on the fly for the browser.

The npm package is built once, when it is packed (`tools/build.ts`), because Node strips no types inside
`node_modules`:

| File | What it is |
| --- | --- |
| `dist/trebol.js` | the browser runtime in one module, with the UI dialect inside: what a page loads from a CDN |
| `dist/cli.js` | the `trebol` command |
| `dist/lib/` | `src/` as JavaScript with its type declarations, one file per module, behind `trebol/core`, `trebol/host` and `trebol/browser` |

## Using Trebol from JavaScript

A program can run Trebol itself. `trebol/host` starts a runtime and runs source in it; `trebol/core` has the
values and `mold`:

```js
import { startHost, runSource } from 'trebol/host';
import { mold } from 'trebol/core';

const host = startHost();
console.log(mold(await runSource(host, 'reduce [1 + 2 * 3 now/year > 2000]')));   // [9 true]
```

`startUi(host)` loads the UI dialect into it as well, so `layout` builds faces without a page. In a page
built with a bundler, `import 'trebol/browser'` does what the CDN script does: it runs the page's
`text/trebol` scripts.
