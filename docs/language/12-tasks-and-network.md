# 12. Tasks and the network

The shop does not keep every part in a drawer. When a customer wants a tyre, the counter asks the parts supplier
what it costs and whether there is one in stock — over the network, and the supplier takes a moment to answer.
This page asks the supplier questions, sends it an order, and then does what a busy counter does: asks several
questions at once, and keeps working while the answers come.

The supplier is a small program that comes with Trebol and answers in JSON, as most services on the web do.
Start it in a second terminal, in the shop's folder, and leave it running:

```sh
npx trebol supplier
```

## Asking

`fetch` reads what a web address answers. JSON comes back as Trebol values: an object is a map, a list is a
block:

```trebol-console
>> fetch http://localhost:8089/parts/chain
== #(part: "chain" price: 11.5 stock: 40)
```

The supplier sends its prices as plain numbers, which are not exact. The shop turns them into money as soon as
they arrive:

```trebol-console
>> chain: fetch http://localhost:8089/parts/chain
== #(part: "chain" price: 11.5 stock: 40)
>> to money! chain/price
== $11.50
>> chain/stock > 0
== true
```

While `fetch` waits for the answer, the line you typed seems to stop, as if Trebol were stuck. It is not: only
that line waits. Below you will see what goes on meanwhile.

## When the answer is no

The supplier does not sell saddles, and says so with an HTTP error. For `fetch` that is an error like any other
(page 7), so `try` catches it:

```trebol-console
>> error? answer: try [fetch http://localhost:8089/parts/saddle]
== true
>> answer/id
== http
>> answer/message
== "HTTP 404 Not Found for http://localhost:8089/parts/saddle"
```

A network has more ways to fail than a supplier saying no: the supplier may be down, or slow. All of them are
errors of the `access` type, so one `try` covers them. A function that answers `false` for anything that cannot
be had, whatever the reason:

```trebol
supplier: http://localhost:8089/parts/

in-stock?: function [part [word!]] [
    answer: try [fetch join supplier part]
    either error? answer [false] [answer/stock > 0]
]
```

```trebol-console
>> in-stock? 'chain
== true
>> in-stock? 'tyre
== false
>> in-stock? 'saddle
== false
```

`join` puts the part after the address, and the result is still an address.

## Sending

`fetch/with` takes a block of options. With a `body`, it sends the body to the address instead of only asking: a
map or a block goes as JSON. The supplier takes orders that way, and answers in how many days they arrive:

```trebol-console
>> fetch/with http://localhost:8089/orders [body: #(parts: [tyre tyre])]
== #(accepted: true lines: 2 days: 2)
```

Another option, `timeout`, says how long to wait for an answer before giving up. Each answer of the supplier
takes about a third of a second, so a tenth is too short:

```trebol-console
>> error? answer: try [fetch/with supplier [timeout: 0.1]]
== true
>> answer/message
== "request to http://localhost:8089/parts/ timed out"
```

## Several things at once

The counter needs the price of three parts. Asked one after another, that is three waits in a row. A **task**
is a block that runs on its own: `spawn` starts one and gives back a handle for it at once, without waiting for
it to finish. `wait` takes the handle, waits for the task, and gives its value:

```trebol-console
>> task: spawn [fetch http://localhost:8089/parts/bell]
== #[handle!]
>> print "the counter goes on"
the counter goes on
>> wait task
== #(part: "bell" price: 3.25 stock: 12)
```

`wait` also takes a block of tasks, and gives a block of their values once all of them are done. So the three
questions can be asked at the same time, and the three waits overlap:

```trebol
price-list: function [parts [block!]] [
    tasks: collect [
        foreach part parts [keep spawn compose [fetch join supplier (to-string part)]]
    ]
    wait tasks
]
```

```trebol-console
>> foreach p price-list [chain bell brake-pad] [print [p/part to money! p/price]]
chain $11.50
bell $3.25
brake-pad $6.80
```

Each task runs a moment later, when `foreach` has already moved on to the next part — so a task that read the
word `part` would find the last part, not its own. `compose` puts each part into its task's block while the
loop is still on it: the task gets `"chain"`, not the word.

Tasks take turns: while one waits for the network, the others run. That is how the counter keeps working while an
answer is on its way, and how a screen stays alive while it loads its data — the second tutorial depends on it.

## Later, and every so often

`delay` runs a block once, after a while; `every` runs it again and again. The time is in seconds, or a
`time!` such as `0:05`, five minutes. Both give a handle, and `cancel` stops it. `wait` with a number waits that many
seconds, and lets the other tasks run meanwhile:

```trebol-console
>> reminder: delay 0.2 [print "Ada's bike is ready"]
== #[handle!]
>> wait 0.5
Ada's bike is ready
== none
```

A shop that checks the supplier's stock every so often, three times here, and then stops:

```trebol-console
>> checks: 0
== 0
>> ticker: every 0.1 [checks: checks + 1  print ["check" checks]  if checks = 3 [cancel ticker]]
== #[handle!]
>> wait 1
check 1
check 2
check 3
== none
```

## When the server speaks first

With `fetch`, the counter asks and the supplier answers, once. Some news comes without asking: the day's
delivery is packed, then on the road, then at the door. `open-events` opens a stream of **server-sent events**,
news that only the server sends, and `on-message` runs a block for each piece, with the news in `value`. A JSON
piece comes as a map, as with `fetch`. A stream that fails or ends opens again by itself, the way a browser
keeps one; today's news is over when the delivery is at the door, so the counter asks with `reconnect: no`,
and `on-close` runs when the supplier ends the stream:

```trebol-console
>> news: open-events/with http://localhost:8089/deliveries [reconnect: no]
== #[handle!]
>> on-message news [print ["the delivery is" value/step]]
== #[handle!]
>> on-close news [print "no more news today"]
== #[handle!]
>> wait 1
the delivery is packed
the delivery is on the road
the delivery is delivered
no more news today
== none
```

Without `reconnect: no` the stream waits a second and opens again on the same handle, so its handlers go on
working; the wait doubles each time it fails, up to 30 seconds. `on-open` runs each time it is open, with
`reconnected` true after the first, for a program to ask again for what it may have missed. `on-error` runs
for each attempt that fails, and the stream goes on trying, unless the server answers that it does not want
it (a 204, or a 4xx such as 401 when the user is no longer signed in): then it stops, and `on-close` runs.
`close-stream` ends it for good.

A **WebSocket** goes both ways, and stays open: the shop can ask the supplier's order desk again and again
without a new request each time. `open-socket` waits until it is open; `send` sends a value (a map or a block
goes as JSON), and the desk's answers come to `on-message` like the news did. `close-stream` hangs up:

```trebol-console
>> desk: open-socket ws://localhost:8089/desk
== #[handle!]
>> on-message desk [print [value/part "in stock:" value/stock]]
== #[handle!]
>> send desk #(ask: "bell")
== #[handle!]
>> send desk #(ask: "chain")
== #[handle!]
>> wait 1
bell in stock: 12
chain in stock: 40
== none
>> close-stream desk
== #[handle!]
```

The handlers are tasks too: they run while the program goes on, the same as `spawn`'s. `examples/live` in
Trebol's source puts both on a screen: a chat over a WebSocket, and who is in it over server-sent events.

## What's next

Every example so far was typed into the console, or kept in one file. The next step splits a program into
modules: the shop's prices in one file, its rules in another, each saying what it gives the rest.
