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
- `/from saved` (`block!`): Resumes it where a snapshot of it left it, instead; saved: What snapshot gave

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
| `on-save [...]` | at the top: code run after each event, `snapshot` inside it being the machine's snapshot then; also when a machine it invoked moves on its own |
| `shared name` | at the top: every tab of the site that makes a machine with this name has the same one; see below |
| `use name with [blank: value ...]` | in a state: the words of the [fragment](#fn-fragment) `name` are put there, each blank's word replaced by its value; `with` may be left out when it has no blanks |
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

`machine` gives the machine in its initial states at once, but their `on-enter`, timeouts, `run`, `invoke` and
ways with no event happen once the expression that called `machine` is done, so the word it is set to already has
it: `m: machine [... on-enter [send m 'go] ...]` works. An event sent in that same expression waits behind them, and
a failure among them is a failure of that expression. `restart` and `machine/from` start at once.

A `parallel` has no `initial` and no ways between its states: all of them start when it is entered, and it ends
when all of them have. A way out of it with no event sees in `event/name` how its state `name` ended (the outcome
of its final state, or the name of that state; `none` while it goes on); a `to` is taken once all have ended, a
`choose` is looked at each time one ends. Its states take an event first; its own ways out only when none does.

The machine is an object with `state` (a word, or a path when it is in a state inside another; a block of them
when it is in a parallel), `data`, `done`,
`outcome`, `error`, the last error taken by `on error`, and `owner`, `false` on the copy of a `shared` machine.

A `shared` machine is run by one tab, the first that made it, which holds a lock named after it: only there do
hooks, timeouts, `run`, `invoke` and `on-save` happen. The other tabs and windows of the same browser and site get
a copy whose `state` and `data` follow it after each event (`owner` is `false` on it); `send` and `restart` on a
copy go to the tab that runs it and wait until they are done there. When that tab closes, another one goes on
from the last snapshot it was told. Data and event fields travel as `mold/all` gives them. With no browser to
share it with, it runs on its own, as any machine.

`machine/from spec saved` makes the machine of `spec` where the [snapshot](#fn-snapshot) `saved` left it,
instead of starting it: no `on-enter` runs again, each timeout and the ttl go off when they were going to (at once
if that time has passed), a `run` starts over and a machine invoked goes on from its own snapshot. A state or a
field of the data the snapshot has and `spec` does not is an error.

(fn-fragment)=
## fragment

Makes a piece of machine with blanks, which use puts in a state of a machine with the blanks filled.

```text
fragment spec body
```

- `spec` (`block!`): Its blanks: words, each with an optional block of the types it takes and a string
- `body` (`block!`): The words of a machine for one level: states, ways, hooks, initial

A piece of machine written once and put in states of machines by `use`, each time with its blanks filled:

```trebol
retry: fragment [work [block!] check [block!]] [
    initial attempt
    state attempt [on-enter work]
    state waiting []
    state done []
    from attempt select check on result [ok to done  fail to waiting]
    from waiting to attempt on again
]
order: machine [
    data [verdict: 'fail]
    initial charging
    state charging [use retry with [work: [print "charging"]  check: [data/verdict]]]
    final paid
    from charging to paid
]
```

The spec names the blanks, each with a block of the types it takes, any value when it has none, and a string if
wanted. A blank is a word of the body: wherever that word stands, in a block or deeper, its value takes its place,
as a block of code, a state, an event, a number. Set-words, lit-words and paths are left as they are. Each `use`
is a copy of its own. A blank not given, one the fragment has not, or a value of a type it does not take is a
mistake when the machine is made. A fragment may `use` another and pass on its own blanks; one that uses itself is
a mistake. Unlike `invoke`, the states of a fragment are the machine's own: they share its data and take its
events.

(fn-fragment-3f)=
## fragment?

Whether a value is a fragment of machine.

```text
fragment? value
```

- `value` (`any-value!`)

For example `fragment? retry`.

(fn-send)=
## send

Sends an event to a machine and gives the state it is in then, or sends a value on a socket.

```text
send m event
```

- `m` (`object!` `handle!`): A machine, or a socket
- `event` (`any-value!`): The event: a word, or a block with the word and its fields; for a socket, the value

For example `send repair 'start` or `send repair [start bike: "Road"]`. An event that no way or `defer` of the
machine names is an error, with the one it may have meant, unless the machine has `ttl` or a state with
`on-activity`. On a socket a string goes as text, a
binary as it is and any other value as JSON; see [the network](network.md).

(fn-in-3f)=
## in?

Whether a machine is in a state now: its name, or a path of names from the top.

```text
in? m name
```

- `m` (`object!`)
- `name` (`word!` `path!`)

(fn-graph-of)=
## graph-of

The states of a machine and the ways between them, as plain data; of a block, the machine it would make, run not.

```text
graph-of machine
```

- `machine` (`object!` `block!`): A machine, or the block of one

For example `graph-of repair`, or `graph-of [initial a  state a []]` to read a block without making it run. The
block is `[state ... data [fields] ttl ... shared ... done ... states [name [kind ... initial ... on ...] ...]
ways [[from a to b on [events] where [...] set [...]] ...]]`; see [the machine as data](../language/15-machines.md).

(fn-can-3f)=
## can?

Whether a machine has a way out on an event from where it is now; what where would say is not asked.

```text
can? m event
```

- `m` (`object!`)
- `event` (`word!`)

For example `can? signup 'next`. A way whose `where` is false still counts: the block of `where` reads the
event, which is not there yet. A form in steps led by a machine shows *Next* while this is true.

(fn-restart)=
## restart

Starts a machine again from its initial state, with its data as it was made.

```text
restart m
```

- `m` (`object!`)

(fn-snapshot)=
## snapshot

The state of a machine as a block of plain data, which machine/from resumes.

```text
snapshot m
```

- `m` (`object!`)

The block is plain data: `mold/all` and `load` keep it, so it can be saved with `save-local` or sent to a server
and given to `machine/from` later. It holds the states the machine is in, its data, history, the events held by
`defer`, when each timer goes off and the snapshots of the machines it invoked.
