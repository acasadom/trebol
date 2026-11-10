# Words and binding

## What binding is

A word in Trebol does not look for its value by name when it runs. It already knows *where* its value is:
each word cell carries a reference to a **context**, set when the code is loaded or when a function or
object is made. That is Rebol's *definitional binding*, and Trebol keeps it.

A context is a list of keys and a list of values (`ctx.ts`):

```ts
interface Ctx { keys: Sym[]; vals: Cell[]; parent: Ctx | null }
```

Objects, function calls and the user context all use the same record. Keys are only ever added, never
removed, so a word that found its slot keeps finding it. From eight keys on, a lookup uses a hash index
that grows with the context.

## The user context and lib

All the natives, operators, datatypes and functions Trebol brings live in a context called `lib`. Your code
is loaded into another one, `user`, whose parent is `lib`. Reading a word looks in `user`, then in `lib`;
setting a word adds it to `user`. So a program can give its own meaning to `print` or `form` without
changing them for Trebol's own code, which keeps using `lib`'s. Only `user` has a parent.

## Functions

When a function is made, its body is copied and its arguments, refinements and locals are bound to a
template context. **Each call** makes a new context and a fresh copy of the body bound to it.

```trebol-console
>> make-counter: func [n] [does [n: n + 1]]
== func [n] [does [n: n + 1]]
>> c: make-counter 10
== func [] [n: n + 1]
>> c
== 11
>> c
== 12
```

The inner function keeps the `n` of the call that made it, because that call had its own context. In
Rebol 3 only `closure` does this; in Trebol every function does, and `func` and `closure` are the same.
It is what an event handler made in a loop needs to remember its own row, and what two tasks that call
the same function at the same time need not to share a frame.

## Objects

`make object! [a: 1 f: does [a]]` gathers the set-words, copies the block, binds the copy to a new context
and evaluates it. Making an object from another, `make proto [...]`, copies the prototype's fields and
binds the copied blocks and function bodies again to the new object, so its functions see its own fields.
Strings and binaries are copied too, so two objects made from the same prototype never share a series.

`self` is not a field. An object's context has a mark, and the word `self` bound to it means the object.
So `self` never shows in `mold`, `length?` or `to-json`.

## How the UI uses it

A handler such as `[save values]` in a form is bound to the form's context, where `values` and the labels
of the layout exist as words. Each `layout` makes its own context for its labels, so a `total:` in one
screen is not the `total` of another. Binding is the whole mechanism; there is no lookup by name at run
time and no registry of components.

## Why this way — and the alternatives

- **Rebol 3's model as it is**: a function's body is bound once, and each call reuses it with the frame's
  values swapped in. It copies less, and it is why R3 needs `closure` beside `func`, and why a literal
  block in a function keeps what earlier calls put in it. Trebol copies the body per call, which costs
  memory and time on every call, and gives one kind of function that behaves the same in every case,
  including two tasks running it at once.
- **Virtual binding, or specifiers**, as Ren-C does: a block is not copied but travels with a note of which
  context to look words up in. It avoids the copies and is the most powerful model there is. It is also
  much harder to reason about and to port, and a dialect author has to understand it to bind code safely.
  Trebol chose the simpler model knowing what it leaves out.
- **Lexical scope, as in most languages**: names are resolved by where they are written. It cannot express
  what Rebol does every day, binding a block written in one place to a context made somewhere else (`bind`,
  `use`, a form's handlers). Dialects need that.
- **Global layout labels**, as Rebol 2's VID and Red's VID do: a label in a `view` becomes a global word. It
  is simpler, and two screens with a `total` then fight over it. Trebol follows the Rebol 3 GUI notes,
  which asked for the labels of a layout to live in their own object.
