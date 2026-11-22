# How Trebol is tested

`npm run check` runs the type checker and every test. A change is not done until it is green.

## The suites

- **The language suite, in Trebol.** `test/trebol/*.trb` holds hundreds of tests written in Trebol itself: a
  string names a group, and each block after it is one test that must give `true`.

  ```text
  "arithmetic"
  [1 + 2 * 3 = 9]
  [$0.10 + $0.20 == $0.30]
  [error? try [9223372036854775807 + 1]]
  ```

  Being Trebol, the same files will check a Zig core, or any other.
- **Tests in TypeScript** (`test/*.test.ts`, run by Node's own test runner) for what the suites in Trebol
  cannot see: the lexer's positions, the scheduler, the network natives against a real server, the UI
  dialect without a browser (its faces, validation and events, with `show` captured), the theme's
  contrast, the tools.
- **Screen tests, in Trebol.** `trebol test` runs an app's `app.test.trb` without a browser: each test starts
  the app anew and clicks, types, chooses, presses keys, picks from menus, drags, attaches files, answers
  questions and checks the screen as a person would, with the server's answers written in the test (the
  [last page of the UI tutorial](../ui/11-testing.md)). Trebol uses it on `examples/clients` and on fixtures
  in `test/fixtures/screens` that cover every word and how each failure is told; the words are in
  `src/ui/test.trb` and their host, which keeps the view, the notices and the history, in `tools/test.ts`.
- **A round trip on random values.** `test/roundtrip-fuzz.test.ts` makes thousands of random values, nested
  blocks, maps, objects, dates, money, odd strings, and checks that `load mold/all x` gives `x` back. It is
  seeded, so a failure can be repeated. Every change to the lexer or to `mold` has to keep it green.
- **The documentation is a test.** `test/docs.test.ts` runs every example on every page of this site: each
  console session is compared with what Trebol prints, each script must run, each live UI example must draw
  its view. A page that says something Trebol does not do fails the build. The reference is checked the same
  way: it must list every function a program can call, and be what its generator would write.

## Checked against Rebol 3

Trebol tries never to be worse than Rebol 3 or Red. `npm run r3check` runs the Trebol suites in Rebol 3 (the
Oldes build) and lists every test whose result differs. Each accepted difference is written in
`test/r3-differences.json` with the reason for it; a new difference fails the check until someone decides,
and a listed one that now agrees is reported too, so the list never goes stale. [](../from-rebol.md) is that
list, put in order for people. Every push and pull request runs it in CI against a fixed R3 release, so a
difference cannot slip in unseen.

## Why this way — and the alternatives

- **Tests only in TypeScript.** They are easier to write at first, and they would be thrown away with the
  TypeScript core. Tests in Trebol are part of the language, and they read as examples of it.
- **Comparing with Rebol 3 by hand**, when a question comes up. It finds the differences someone thought
  to ask about. Running the whole suite in R3 finds the ones nobody thought of.
- **Screen tests in a browser** (Playwright, Selenium). They see the real page, CSS and all, but need a
  browser installed, take seconds per test and break on timing. The dialect's logic is Trebol, so the same
  calls the browser makes (`ui-click`, `ui-input`) run it without one; what only a browser shows is checked
  in Chrome by hand.
- **Examples in the documentation that are not run.** They go wrong silently as the language changes, and
  a reader trusts them. Running them costs a few seconds per build.
