# An evaluator that can pause

## What it has to do

A browser has one thread. If Trebol waited for a server by blocking, the page would freeze. Yet in Trebol,
waiting is written as if it blocked:

```text
clients: fetch https://api.example.com/clients
print length? clients
```

`fetch` pauses the task that called it, and nothing else. Other tasks, timers and the page go on, and when
the answer comes the task continues on the next line. It can pause anywhere: inside a loop, inside a
function four calls deep, inside a `parse` action.

## How: a stack of frames

The evaluator never nests on the JavaScript stack. It is one loop over an explicit stack of **frames**,
records of plain data, in `eval.ts`:

| Frame | What it does |
| --- | --- |
| `Do` | evaluates the expressions of a block; the result is the last one |
| `Expr` | one expression: a value, then any infix operators after it |
| `Set` | evaluates the value of a set-word, then assigns it |
| `Args` | gathers the arguments of a call, as its spec says |
| `Native` | a native under way, with its phase and its own state |
| `Call` | a function's body; catches `return` and checks the type of the result |
| `Path` | walks a path step by step, and calls a function if it reaches one |

Frames pass values through one register, `task.v`. A frame that needs a value pushes a child and waits; when
the child is done it leaves its result in `task.v`, and the parent, back on top, takes it.

A **task** is a stack of frames and that register. `run(task, budget)` runs steps until the task is done,
fails, has to wait, or uses up its budget. Because everything the task is doing is in its stack, stopping
is just returning from `run`, and continuing is calling it again.

## Natives answer with a Step

A native is a TypeScript function that gets its arguments already evaluated and answers with a `Step`:

```ts
type Step =
  | { k: 'value'; v: Cell }                 // finished, with this result
  | { k: 'do'; s: Series<Cell>; i: number } // evaluate this block, then call me again
  | { k: 'expr'; feed: Feed }               // evaluate one expression, then call me again
  | { k: 'call'; fn: Cell; args: Cell[] }   // call this function, then call me again
  | { k: 'await'; p: Promise<Cell> }        // pause the task until this settles
  | { k: 'throw'; e: Thrown };              // an error, or break, return, throw
```

A native that has to evaluate code does not call the evaluator: it asks for it, and is called again with the
result. This is the whole of `if`:

```ts
native('if', '[condition [any-value!] body [block!]]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);       // called again: v is the block's value
  if (!truthy(f.args[0]!)) return value(NONE);
  f.phase = 1;
  return doBlock(f.args[1] as BlockCell);    // evaluate the body, then come back
});
```

A loop keeps its count in `f.data`, plain data in the frame, and asks for its body once per turn. So a
`fetch` inside the body pauses the task with the loop's state safe in the stack.

## Errors and jumps

Errors, `break`, `continue`, `return` and `throw` travel as one thing, a `Thrown`, that unwinds frames until
one takes it: a native whose `trap` mask includes it (`try` takes errors, loops take `break` and `continue`,
`catch` takes `throw`), or a `Call` frame for `return`. There are no JavaScript exceptions on the normal path.

As it unwinds, the evaluator fills in where the error happened: `near` (the innermost expression), `where`
(the function) and `at` (`file:line:column`). Code from Trebol's own library does not count, so an error
inside `fetch` says `fetch` and points at the line of your program that called it.

## Tasks and the scheduler

The host's scheduler (`scheduler.ts`) runs tasks cooperatively on the JavaScript event loop. Each ready
task runs a slice of 10,000 steps, then the scheduler gives the page a turn before going on, so even a long
computation without any waiting does not freeze it. A task that returned `await` is parked; when its
promise settles, the host puts the value in `task.v` and the task is ready again. The core never calls
`.then`: promises exist only on the host's side.

Every event handler, every `spawn`, every timer is a new task. A host object, such as a task, a socket or a
timer, is given to Trebol as a `handle!`: a kind and a number, with the object kept in a table in the host,
so no Trebol value holds a JavaScript object.

`parse` has its own stack of rule frames and the same register, so a rule action can `fetch` in the middle
of a parse. That was the gate of Trebol's second phase, and a test still checks it: a `parse` whose actions
fetch finishes while another task and a host timer keep running.

## Why this way — and the alternatives

- **A recursive evaluator with `async`/`await`.** Write `evaluate` as an `async` function that calls itself
  and `await`s natives. It is the shortest to write. But every step of every expression then goes through a
  promise, which is many times slower; JavaScript's stack overflows on deep Trebol recursion; and a Zig
  core could not copy it.
- **Generators** (`function*` and `yield`). They pause too, and are faster than promises. But a paused
  task is then hidden in the JavaScript engine: it cannot be inspected, and still nests on the JS stack.
  An explicit stack is data, and data is what a port can carry over.
- **Run Trebol in a Web Worker and block there** (with `Atomics.wait`). The worker can block, but it cannot
  touch the DOM, so every change to the screen becomes a message, and the page needs special headers to
  share memory.
- **Rebol's way**: Rebol 3 evaluates recursively in C, and waits with `wait`, which runs an event loop
  inside. It suits a desktop program. In a browser, nobody may run an event loop inside the page's one.
