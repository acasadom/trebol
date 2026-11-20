# 15. Machines

A bike that comes into the shop goes through stages: it is received, someone looks at it, it waits for parts or
it does not, it is repaired, it is ready, and one day its owner takes it home. At each stage only some things can
happen next: nobody collects a bike that is still in pieces. Code that keeps track of that with flags, `waiting?`
here and `ready?` there, soon has a bike that is both. A **machine** says the stages and the ways between them
once, in a block, and then keeps the bike in exactly one of them.

## States and events

The stages are **states**, and what makes the bike move from one to another is an **event**. A machine starts
in its `initial` state; each `from ... to ... on ...` is a way out of a state, taken when its event comes:

```trebol
repair: machine [
    initial received
    state received []
    state repairing []
    state ready []
    from received to repairing on start
    from repairing to ready on fixed
    from ready to received on again
]
```

`send` gives the machine an event, and answers with the state it is in afterwards:

```trebol-console
>> repair/state
== received
>> send repair 'start
== repairing
>> send repair 'fixed
== ready
```

An event that has no way out of the current state changes nothing. The bike that is ready is not started again:

```trebol-console
>> send repair 'start
== ready
```

An event that no way of the machine names at all is another thing: most likely a slip of the keyboard, so `send`
says so instead of losing it:

```trebol-console
>> error? e: try [send repair 'strat]
== true
>> e/message
== "send: the machine has no way on strat; did you mean start?"
```

A machine with `ttl`, or a state with `on-activity`, takes any event, since an event there counts even when no
way names it.

`in?` says whether the machine is in a state, and `can?` whether it has a way out on an event from where it is:

```trebol-console
>> in? repair 'ready
== true
>> can? repair 'again
== true
>> can? repair 'start
== false
```

## What a state does

A state can run code when the machine comes into it, `on-enter`, and when it leaves, `on-exit`:

```trebol
repair: machine [
    initial received
    state received [on-exit [print "Into the workshop"]]
    state repairing [on-enter [print "Tools out"]]
    from received to repairing on start
]
```

```trebol-console
>> send repair 'start
Into the workshop
Tools out
== repairing
```

## Data

A machine keeps its own data, in an object whose fields are given after `data`. Code inside the machine reads it
as `data/field`, and the fields an event brings as `event/field`. An event with fields is a block: its name, then
the fields as in an object. After the event, `where` gives a condition for taking a way out, and `set` gives the
fields of the data to change when it is taken:

```trebol
repair: machine [
    data [bike: none  parts: 0]
    initial received
    state received []
    state repairing [on-enter [print ["Repairing" data/bike]]]
    from received to repairing on start where [event/bike <> ""] set [bike: event/bike]
]
```

```trebol-console
>> send repair [start bike: ""]
== received
>> send repair [start bike: "Ada's road bike"]
Repairing Ada's road bike
== repairing
>> repair/data/bike
== "Ada's road bike"
```

A condition that cannot be worked out does not hold: an event with no `bike` field leaves the bike where it was.
The values after `set` are all worked out before anything changes, so `set [a: data/b  b: data/a]` swaps them.

The machine knows its data's fields, so a misspelt one is a mistake as soon as the machine is made, not when that
line runs:

```trebol-console
>> error? e: try [machine [data [bike: none] initial a  state a [on-enter [print data/bkie]]]]
== true
>> e/message
== "machine: data has no bkie; did you mean bike?"
```

Other mistakes show when the machine is made too: a state or a word misspelt (with the one it may have meant), a
state no way leads to, and a `choose` with no event and no `else` out of a state with no other way out, which
would keep the machine there for good when no `when` holds. `trebol check` finds them all without running the
program.

## States inside states

Repairing is really several stages: first someone finds out what is wrong, then the bike may wait for parts,
then it is worked on. A state can hold states of its own, with its own `initial` and its own ways between them.
The machine is then in both, the outer state and one inside it, and `state` is a path:

```trebol
repair: machine [
    data [parts: 0]
    initial received
    state received []
    state work [
        initial checking
        state checking []
        state waiting [on-enter [print [data/parts "parts ordered"]]]
        state fixing []
        from checking to waiting on need-parts set [parts: event/count]
        from checking to fixing on fixable
        from waiting to fixing on arrived
        from fixing to ready on fixed
    ]
    state ready []
    state on-hold []
    state cancelled []
    from received to work on start
    from work to on-hold on hold
    from on-hold to work on resume
    from work to cancelled on cancel
]
```

```trebol-console
>> send repair 'start
== work/checking
>> send repair [need-parts count: 2]
2 parts ordered
== work/waiting
>> in? repair 'work
== true
```

`in?` tells whether the machine is in a state, by its name or by a path like `'work/waiting`.

A way out written at the top, `from work to cancelled on cancel`, leaves `work` from whichever state inside it the
machine is in. The ways inside a state are tried first, and the ones around it catch the events they do not take.
A target is looked for first among the states next to the way out, then further out: inside `work`, `to ready`
finds the `ready` at the top.

When the machine comes back into a state that holds others, it goes back to the one it was in when it left, and
that state's `on-enter` runs again:

```trebol-console
>> send repair 'hold
== on-hold
>> send repair 'resume
2 parts ordered
== work/waiting
```

That memory is the state's **history**. A state that should always start again from its `initial` says
`no history`.

## Things at once

A bike in for a service waits for two things that have nothing to do with each other: the parts to come, and the
customer to say yes to the price. A `parallel` state is in **all** of its states at once, each with its own
states inside, and each event goes to every one of them:

```trebol
service: machine [
    initial waiting
    parallel waiting [
        state parts [
            initial ordered
            state ordered []
            final arrived
            from ordered to arrived on delivered
        ]
        state customer [
            initial asked
            state asked []
            final agreed
            final declined
            from asked to agreed on yes
            from asked to declined on no
        ]
    ]
    state working []
    final returned
    from waiting choose [
        when [event/customer = 'declined] to returned
        when [all [event/parts = 'arrived  event/customer = 'agreed]] to working
    ]
]
```

```trebol-console
>> service/state
== [waiting/parts/ordered waiting/customer/asked]
>> send service 'yes
== waiting/parts/ordered
>> send service 'delivered
== working
```

When the machine is in several states, `state` is a block of paths, one for each. A state of a parallel that
has ended is no longer in it. The ways out of the parallel with no event see in `event` how each of its states
ended: its outcome, or the name of the final state it got to, and `none` while it goes on. A plain
`from waiting to working` is taken when all of them have ended; a `choose` is looked at each time one ends, so
the customer saying no sends the bike back at once, parts or no parts.

An event goes first to the states of the parallel; the ways out of the parallel itself take it only when none
of them does. Leaving the parallel leaves every state still on inside it. All of them share the machine's
`data`.

## Choosing

Sometimes the same event leads to different places, depending on the data. `choose` tries its `when` conditions
in order and takes the first that holds; `else` is where it goes when none does:

```trebol
quote: machine [
    data [total: $0]
    initial counting
    state counting []
    state small []
    state ask-the-owner []
    from counting choose on counted [
        when [data/total < $100] to small
        else to ask-the-owner
    ]
]
```

```trebol-console
>> quote/data/total: $250
== $250.00
>> send quote 'counted
== ask-the-owner
```

A `choose` with no `else`, when no condition holds, does not happen. A way out with no `on` is taken as soon as
the machine comes into its state; a `choose` with no `on` decides then where to go.

When the place depends on a value worked out once, not on a list of conditions, `select` runs its block and
takes the branch for the value it gives, as `switch` does. The block may ask the server first:

```trebol
order: machine [
    data [tries: 0]
    initial paying
    state paying []
    final paid
    final cancelled given-up
    from paying to paid on accepted
    from paying select [data/tries: data/tries + 1  either data/tries < 3 ['again] ['stop]] on declined [
        again to paying
        stop to cancelled
    ]
]
```

```trebol-console
>> send order 'declined
== paying
>> send order 'declined
== paying
>> send order 'declined
== cancelled
```

The block of a `select` runs once each time the event comes. A value with no branch, and no `else`, is a
mistake, and fails like one.

## Time

Some ways out are taken by the clock, not by an event. A state with `timeout` starts a timer when the machine
comes into it and stops it when the machine leaves; when the time is up, the machine sends itself the event
`timeout`, taken like any other:

```trebol
booking: machine [
    initial held
    state held [timeout 0:15]
    state paid []
    final released
    from held to paid on pay
    from held to released on timeout
]
```

```trebol-console
>> send booking 'pay
== paid
```

A customer who pays within fifteen minutes keeps the bike; one who does not loses it. The time is in seconds,
a `time!` such as `0:15`, or `data/field`, read as the state is entered. The `timeout` is taken from its own
state first, then from the ones around it, so a state with states inside can give the whole of them a time.

A machine may also have a time for silence: with `ttl` at the top, it **expires** when nobody sends it an event
for that long. Each event sent starts the time again, and its own timeouts do not count. When the time is up the
machine takes `on expired`, which goes to a `final` state; with none, it just ends, with the outcome `expired`.
Here the time is a tenth of a second, to see it happen:

```trebol
session: machine [
    ttl 0.1
    initial open
    state open []
    final closed timed-out
    from open to open on click
    from open to closed on expired
]
```

```trebol-console
>> wait 0.2
== none
>> session/state
== closed
>> session/outcome
== timed-out
```

## Work that takes a while

A state may have work to do while the machine is in it: ask the supplier for a price, load the list of repairs.
`run` starts its block as a [task](12-tasks-and-network.md) when the machine comes into the state, and stops it
if the machine leaves first. When the block ends, the machine sends itself `done`, with the value the block gave
in `event/value`; when it fails, `error`, taken by `on error` as any failure:

```trebol
prices: machine [
    data [price: none]
    initial asking
    state asking [run [wait 0.05  $120]]
    state shown []
    state failed []
    from asking to shown on done set [price: event/value]
    from asking to failed on error
]
```

```trebol-console
>> prices/state
== asking
>> wait 0.1
== none
>> prices/state
== shown
>> prices/data/price
== $120.00
```

A real one would `fetch` from the server in that block; the rest of the program goes on meanwhile.

A state may also be a whole machine of its own: `invoke` makes the machine of a block when the state is
entered and starts it, with `with` giving fields of its data. When it is done, the outer machine gets `done`, with
`event/outcome` and `event/data` of the inner one. The inner machine is a black box: it takes no events from
outside, so it runs on its own, by its own ways with no event, its timeouts and its `run`:

```trebol
payment: [
    data [amount: $0]
    initial deciding
    state deciding []
    final ok authorized
    final no declined
    from deciding choose [when [data/amount <= $100] to ok  else to no]
]
order: machine [
    data [amount: $80]
    initial charging
    state charging [invoke payment with [amount: data/amount]]
    final paid
    final refused
    from charging choose on done [when [event/outcome = 'authorized] to paid  else to refused]
]
```

```trebol-console
>> order/state
== paid
```

When the same work is done once for each thing in a list, `invoke ... for` makes one machine of the block for each
value of a block of the data. Inside `with`, the word after `for` is that value, so each machine gets its own. They
run side by side, each a black box, and the outer machine gets `done` when all of them are: `event/outcomes` and
`event/data` are blocks, in the order of the list. With an empty list, `done` comes at once:

```trebol
ship: [
    data [parcel: none]
    initial shipping
    state shipping []
    final shipped success
    final lost failed
    from shipping choose [when [data/parcel <> "C"] to shipped  else to lost]
]
delivery: machine [
    data [parcels: ["A" "B" "C"]  outcomes: none]
    initial dispatching
    state dispatching [invoke ship for parcel in data/parcels with [parcel: parcel]]
    final delivered
    final stuck
    from dispatching choose on done [
        when [parse event/outcomes [any 'success]] to delivered
        else to stuck set [outcomes: event/outcomes]
    ]
]
```

```trebol-console
>> delivery/state
== stuck
>> delivery/data/outcomes
== [success success failed]
```

Leaving the state stops every machine it started.

## Events that come early

An event the state has no way out for is lost. Sometimes it only came early: the bank says the payment went
through before the shop has said the order is ready. `defer` holds such events until the machine is in a state
that takes them, in the order they came:

```trebol
payment: machine [
    defer confirmed
    initial charging
    state charging []
    state waiting []
    final done
    from charging to waiting on sent
    from waiting to done on confirmed
]
```

```trebol-console
>> send payment 'confirmed
== charging
>> send payment 'sent
== done
```

A `defer` at the top holds the event in every state; inside a state, only while the machine is in it. An event
held keeps its fields, and a machine that is done drops the ones still held.

## The end

A state with no way out ends the stage it is in. Inside another state, the machine is then in that outer state,
and its own ways out apply, the one with no event at once. At the top, the machine is done. A `final` state
says so on purpose, and may give the **outcome**, a word for how it ended:

```trebol
sale: machine [
    initial open
    state open []
    final paid sold
    final gone lost
    from open to paid on pay
    from open to gone on walk-away
]
```

```trebol-console
>> send sale 'pay
== paid
>> sale/done
== true
>> sale/outcome
== sold
>> send sale 'walk-away
== paid
```

A machine that is done takes no more events. `restart` starts it again from its `initial` state, with its data
as it was when it was made.

## When something fails

Code in a state can fail: a request to the server that does not answer, a division by zero. Without anything
said, the error reaches whoever sent the event, as any error does. With `on error`, the machine takes a way out
instead, and the error is the event, so `event/message` says what happened:

```trebol
call: machine [
    initial asking
    state asking [on-enter [1 / 0]]
    state failed [on-enter [print ["Failed:" event/message]]]
    from asking to failed on error
]
```

```trebol-console
>> call/state
== failed
```

The `Failed:` line printed when the machine was made, since it starts in `asking`. A `where` after `on error` can
pick by the error, `where [event/id = 'zero-divide]`. Code that fails in an `on-exit` is not taken out this way:
the machine was already leaving, and the error reaches the sender.

Events sent while the machine is still busy with one, from its own code for instance, wait their turn: each event
is finished, states left and entered, before the next one starts.

## Pieces used again

Some shapes come back in machine after machine: try something, look at how it went, try again if it failed. A
**fragment** is such a piece written once, with blanks. `use` puts its states and ways in a state, the blanks
filled with what that place needs: the code to try, how to judge it, where to go next:

```trebol
retry: fragment [work [block!] check [block!]] [
    initial attempt
    state attempt [on-enter work]
    state waiting []
    state done []
    from attempt select check on result [
        ok to done
        fail to waiting
    ]
    from waiting to attempt on again
]
calls: 0
order: machine [
    data [answer: 'fail]
    initial charging
    state charging [use retry with [work: [calls: calls + 1]  check: [data/answer]]]
    final paid
    from charging to paid
]
```

`charging` is now a state with `attempt`, `waiting` and `done` inside it. When the card is declined the machine
waits; `again` tries once more. `done` has no way out, so when it is reached the stage ends and the way out of
`charging` with no event is taken:

```trebol-console
>> order/state
== charging/attempt
>> send order 'result
== charging/waiting
>> order/data/answer: 'ok
== ok
>> send order 'again
== charging/attempt
>> send order 'result
== paid
>> calls
== 2
```

The spec of a fragment names its blanks, each with the types it takes, as a function's does. A blank is a word
of the body, and wherever it stands its value takes its place: code, as here, but also the name of a state of the
machine to go to, the name of an event, or a number for a timeout or a guard. Each `use` is a copy of its own, so
the same fragment serves charging a card, calling the supplier and booking a slot, side by side. A fragment may
`use` another one and pass its own blanks on.

Unlike `invoke`, a fragment is not a machine of its own: its states are the machine's, share its data and take its
events. A blank that is not given, or given a value of a type it does not take, is a mistake when the machine is
made:

```trebol-console
>> machine [initial a  state a [use retry with [work: [1]]]]
** User error: machine: use retry needs check
** Where: machine
** Near: [use retry with [work: [1]]]
** At: 1:30
```

## Keeping a machine

A user who fills half a form and closes the page expects to find it where it was. `snapshot` gives the state of a
machine as a block of plain data: the states it is in, its data, where each state with history was left, the
events held by `defer`, when each timer goes off and the machines it invoked. `machine/from` makes the machine of
the same block again where the snapshot left it, instead of starting it:

```trebol
signup: [
    data [email: none]
    initial account
    state account []
    state profile [on-enter [print "Now the profile"]]
    final done success
    from account to profile on next set [email: event/email]
    from profile to done on finish
]
form-flow: machine signup
send form-flow [next email: "ana@example.com"]
kept: mold/all snapshot form-flow
again: machine/from signup load kept
```

```trebol-console
>> again/state
== profile
>> again/data/email
== "ana@example.com"
```

The text `kept` is what goes into the browser with `save-local`, or to the server. Coming back runs no `on-enter`
again: the machine was already in `profile`. A timeout goes off when it was going to, at once if that time has
passed while the page was closed, and a `run` starts over.

`on-save [...]` at the top of a machine runs after each event, with `snapshot` in it being the machine as it is
then, so the machine keeps itself:

```trebol
cart: machine [
    on-save [save-local 'cart snapshot]
    data [items: 0]
    initial shopping
    state shopping []
    from shopping to shopping on add set [items: data/items + 1]
]
send cart 'add
```

```trebol-console
>> second find load-local 'cart 'data
== [items: 1]
```

A machine resumed from a snapshot of another machine, with states or data its block does not have, is an error.

## One machine for every tab

A user may open the same app in two tabs or two windows of the browser. Each one makes its own machines, which
know nothing of each other: signing out in one leaves the other signed in. With `shared name` at the top, every
tab of the site that makes a machine with that name has the same one:

```trebol
session: machine [
    shared session
    data [user: none]
    initial out
    state out []
    state in []
    from out to in on sign-in set [user: event/user]
    from in to out on sign-out set [user: none]
]
send session [sign-in user: "ana"]
```

One tab runs the machine: the first one that made it. Only there do `on-enter`, `on-exit`, timeouts, `run`,
`invoke` and `on-save` happen, so a request is never made twice because the app is open twice. The other tabs
have a copy: its `state` and `data` follow the machine after each event, and `send` on it sends the event to the
tab that runs it and waits until it is done there, so the line after `send` already sees the new state. When the
tab that runs the machine is closed, another one goes on from where the machine was, as `machine/from` does: no
`on-enter` again, each timeout at its time, a `run` starting over.

The tabs share it through the browser (a lock and a channel named after the machine), so it reaches the tabs and
windows of the same browser for the same site, not other browsers or other computers. With `machine/from`, the
snapshot is taken only when no other tab runs the machine yet. The data and the fields of the events go from tab
to tab as `mold/all` gives them: plain values, no functions or handles. Where there is no browser, as in the
console, a shared machine is a machine like the others.

## The machine as data

`graph-of` gives the states of a machine and the ways between them as a block of plain data, for a tool that
draws it or checks it. It takes the machine, or the block of one, which it reads without running anything:

```trebol
g: graph-of [
    initial off
    state off []
    state on [timeout 60]
    from off to on on press
    from on to off on [press timeout]
]
```

```trebol-console
>> extract select g 'states 2
== [off on]
>> select select select g 'states 'on 'timeout
== 60
>> first select g 'ways
== [from off to on on [press] where none set none]
```

Each state has its `kind` (`state`, `parallel` or `final`), whether its level starts in it (`initial`),
whether the machine is in it now (`on`), its `timeout`, what it runs or invokes (an invoked machine written
in place comes as a graph of its own) and the events it holds with `defer`. A state inside another is named
by its path, `work/checking`, as `state` gives it; a path inside a block is found with `select/only`. Each way
has `from`, `to` (or `choose` and its `branches`), the events `on`, and its `where` and `set` blocks. `trebol
dev` draws the machines of a running app from it (see *When it goes wrong* in the UI tutorial).

## What's next

This was the last page about the language on its own. The block that `view` takes on the first page of this
guide is a dialect like the machine's, read by rules written in Trebol. The second tutorial uses it to give the
shop its screens.
