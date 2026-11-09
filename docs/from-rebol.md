# Coming from Rebol

Trebol is a descendant of Rebol, and most Rebol 3 or Red code reads the same in Trebol. This page lists
where Trebol is different, and why. None of it is an accident: Trebol's test suites are run in Rebol 3
(`npm run r3check`, with the Oldes build of R3 3.22), and every test whose result differs from R3's is on
a list with its reason. This page is that list, put in order.

Where Rebol 3 and Red disagree, Trebol usually takes Red's way. And "Rebol 3" is not one language any more:
the Oldes build changed some things from Carl Sassenrath's original, so a few differences below are with one
R3 and not the other.

## What Trebol is for

These are the differences that come from what Trebol has to do: run in a browser, build user interfaces,
talk to servers.

- **Every function is a closure.** A function keeps the words of the call that made it, so a function made
  inside another one remembers its arguments, and an event handler made in a loop remembers its own row. In
  R3 only `closure` does that; `func` forgets.
- **A literal block in a function is new on each call.** Every call works on its own copy of the body, so
  `b: [x y] append b 'z` gives `[x y z]` every time. In R3 the block keeps what earlier calls put in it (the
  `cache: []` trick); keep such state in an object or a word outside the function.
- **Waiting never blocks.** `fetch`, `wait` and the rest pause the task that asked, and other tasks go on;
  a `fetch` can even wait in the middle of a `parse`. Tasks come with `spawn`, `wait`, `delay`, `every` and
  `cancel`. R3 has no tasks.
- **JSON is built in**: `load-json` and `to-json`, with 64-bit integers kept exact.
- **Errors have a message, not a catalogue.** An `error!` has the fields `type id message near where at`.
  `cause-error` takes the message itself, and `where` names the one function the error came from, the one
  your program called: an error inside `fetch` says `fetch`, not the native `fetch` uses. R3 has `code` and
  `arg1` to `arg3` and builds the message from a catalogue, and lists the whole stack in `where`.
- **Integers are exact or an error.** Integer arithmetic that does not fit 64 bits is an overflow error,
  `power` included; R3's `power` always gives a decimal.

## Writing values

| | Trebol | Rebol 3 (Oldes) |
| --- | --- | --- |
| A map | `#(a: 1 b: 2)`, as Red | `#[a: 1 b: 2]` |
| `none`, `true` in `mold/all` | `#[none]`, `#[true]` | `#(none)`, `#(true)` |
| `mold` of a function | `func [a] [a + 1]`, as Red | `make function! [[a][a + 1]]` |
| `mold` of an object | quotes words and paths: `p: 'a/b` | quotes words only: `p: a/b` |

The console shows decimals with 15 digits, as R3 does (`0.1 + 0.2` shows `0.3`), and `mold/all` gives the
exact number. `=` takes decimals that close as equal, as R3 does; `==` does not.

## Functions that differ

| | Trebol | Rebol 3 |
| --- | --- | --- |
| `2 ** 10`, `power 2 10` | `1024`, an integer, as Red | `1024.0` |
| `//` | the remainder, as the original R3: `-7 // 2` is `-1` | integer division in Oldes R3 |
| `mod -7 3` | `2`: the sign of the divisor, as R3's `modulo` and Red's `mod` | `-1` |
| `shift 16 2` | `4`: right, `/left` for left, as Red; also `<<` `>>` `>>>` | `64`: left for a positive count |
| `arctangent2` | takes y and x, as Red | takes a pair |
| `enbase`, `debase` | base with `/base`, 64 if not given, as Red | base as a required argument |
| `find/match "abc" "ab"` | `"c"`, after the match, as Red | `"abc"`, where it starts |
| `to block! "a 1"` | `[a 1]`: the text is loaded, as Red | `["a 1"]` |
| `round/to $2.625 0.01` | `$2.63`: money stays money | `2.63`, the type of the scale |
| `reword` | takes the longest key that matches | takes the first |
| `read %file` | the text, a string, as Red | a binary |
| `context? 'n` in a function | the frame of that call, as an object | no frame as a value |

Trebol also has some of Red's functions that R3 lacks: `pad`, `shift-left`, `shift-right`,
`shift-logical`, and keeps R3's older `bound?` as another name for `context?`.

## Parse

`parse` works as in R3, `break`, `accept` and `reject` included, with three differences:

- `change only` (from Red) puts a block in as one value.
- A repetition stops when a turn matches without moving on. R3 goes round once more, so
  `[some [keep copy w to [" " | end] opt " "]]` keeps an extra empty string at the end.
- A rule that ends too early, such as `[some]`, is an error that says so; R3 answers `false`.
