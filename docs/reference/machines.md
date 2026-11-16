<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Machines

A machine keeps something in exactly one of its states and moves it between them when events come. See
[machines](../language/15-machines.md).

(fn-machine)=
## machine

Makes a state machine from a block and starts it in its initial state.

```text
machine spec
```

- `spec` (`block!`)

The block says the states and the ways between them:

| Word | What it says |
| --- | --- |
| `data [...]` | the machine's own fields, as in an object; code inside reads them as `data/field` (at the top only) |
| `initial name` | the state the machine, or the state this is in, starts in |
| `state name [...]` | a state; the block holds its hooks, and states of its own with their `initial` |
| `parallel name [...]` | a state that is in all the states of its block at once; an event goes to each of them |
| `final name outcome [...]` | a state that ends the machine; the outcome word and the block may be left out |
| `on-enter [...]`, `on-exit [...]` | code run when the machine comes into the state and when it leaves it |
| `on-activity [...]` | code run when an event comes that has no way out of the state |
| `no history` | coming back, the state starts from its `initial`, not from where it was left |
| `from a to b on event` | a way out of `a`, a state next to it, taken when `event` comes; `on [e f]` for several |
| `where [...]` | after `on`: the way is taken only when the block gives a true value |
| `set [field: value ...]` | after the rest: the fields of the data changed when the way is taken |
| `from a to b` | with no `on`: taken as soon as the machine is in `a` |
| `from a choose on event [...]` | the block has `when [...] to b`, each with its own `set` if any, and `else to c` |
| `from a to b on error` | taken when code run on the way into a state fails; the event is the error |
| `from a select [...] on event [...]` | the block runs, and the branch `value to b` for the value it gives is taken; `else to c` for any other |
| `timeout 30` | in a state: when the machine has been in it that long, it sends itself `timeout`; seconds, a `time!` or `data/field` |
| `ttl 0:30` | at the top: when no event has been sent for that long, the machine sends itself `expired` |
| `run [...]` | in a state: the block runs as a task while the machine is in it; its end sends `done` with `event/value`, a failure `error` |
| `invoke spec with [field: value ...]` | in a state: the machine of the block `spec` (or of the word's value) runs while the machine is in it; when done, `done` with `event/outcome` and `event/data`; `with` may be left out |
| `invoke spec for item in data/field with [...]` | one machine of `spec` for each value of the block `data/field`, `item` being that value inside `with`; `done` comes when all of them are, with `event/outcomes` and `event/data` as blocks in the order of the values |
| `defer event` | an event with no way out waits for a state that has one; `defer [e f]` for several |

A state with `timeout` needs a way out `on timeout` from it or from a state around it, and `on timeout` needs
a `timeout` in its state or inside it. `on expired` needs `ttl` and goes to a `final` state; with no `on expired`
the machine ends where it is, with the outcome `expired`. `on done` needs a `run` or an `invoke` in its state or
inside it, and a state has one of them at most; leaving it stops the task or the machine invoked, which takes no
events from outside. `error`, `timeout`, `expired` and `done` are the machine's own events: `send` does not take
them, nor `defer`.

Code in a machine reads `data/field` and `event/field`. A condition that fails while it is worked out does not
hold. A target is a name, or a path from the state the way is in, `outer/inner`; it is looked for among the
states next to the way, then in each level further out.

Each event is finished before the next one starts: one sent by the machine's own code waits its turn.

A `parallel` has no `initial` and no ways between its states: all of them start when it is entered, and it ends
when all of them have. A way out of it with no event sees in `event/name` how its state `name` ended (the outcome
of its final state, or the name of that state; `none` while it goes on); a `to` is taken once all have ended, a
`choose` is looked at each time one ends. Its states take an event first; its own ways out only when none does.

The machine is an object with `state` (a word, or a path when it is in a state inside another; a block of them
when it is in a parallel), `data`, `done`,
`outcome` and `error`, the last error taken by `on error`.

(fn-send)=
## send

Sends an event to a machine and gives the state it is in then, or sends a value on a socket.

```text
send m event
```

- `m` (`object!` `handle!`): A machine, or a socket
- `event` (`any-value!`): The event: a word, or a block with the word and its fields; for a socket, the value

For example `send repair 'start` or `send repair [start bike: "Road"]`. On a socket a string goes as text, a
binary as it is and any other value as JSON; see [the network](network.md).

(fn-in-3f)=
## in?

Whether a machine is in a state now: its name, or a path of names from the top.

```text
in? m name
```

- `m` (`object!`)
- `name` (`word!` `path!`)

(fn-restart)=
## restart

Starts a machine again from its initial state, with its data as it was made.

```text
restart m
```

- `m` (`object!`)
