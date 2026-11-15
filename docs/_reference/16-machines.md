# Machines

A machine keeps something in exactly one of its states and moves it between them when events come. See
[machines](../language/15-machines.md).

## machine

The block says the states and the ways between them:

| Word | What it says |
| --- | --- |
| `data [...]` | the machine's own fields, as in an object; code inside reads them as `data/field` (at the top only) |
| `initial name` | the state the machine, or the state this is in, starts in |
| `state name [...]` | a state; the block holds its hooks, and states of its own with their `initial` |
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
| `defer event` | an event with no way out waits for a state that has one; `defer [e f]` for several |

A state with `timeout` needs a way out `on timeout` from it or from a state around it, and `on timeout` needs
a `timeout` in its state or inside it. `on expired` needs `ttl` and goes to a `final` state; with no `on expired`
the machine ends where it is, with the outcome `expired`. `error`, `timeout` and `expired` are the machine's own
events: `send` does not take them, nor `defer`.

Code in a machine reads `data/field` and `event/field`. A condition that fails while it is worked out does not
hold. A target is a name, or a path from the state the way is in, `outer/inner`; it is looked for among the
states next to the way, then in each level further out.

Each event is finished before the next one starts: one sent by the machine's own code waits its turn.

The machine is an object with `state` (a word, or a path when it is in a state inside another), `data`, `done`,
`outcome` and `error`, the last error taken by `on error`.

## send

For example `send repair 'start` or `send repair [start bike: "Road"]`. On a socket a string goes as text, a
binary as it is and any other value as JSON; see [the network](network.md).

## in?

## restart
