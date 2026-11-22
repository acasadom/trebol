<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Network

Asking web servers, and talking with them over WebSocket and server-sent events. `fetch` reads JSON as Trebol
values. See [tasks and the network](../language/12-tasks-and-network.md) and
[talking to a server](../ui/09-server.md).

(fn-fetch)=
## fetch

Requests a URL. JSON answers come back as maps and blocks.

```text
fetch url
```

- `url` (`url!` `string!`)
- `/with options` (`block!` `object!`): method, headers, body, form, multipart, timeout, full

What comes back follows the type the server gives: JSON as Trebol values, text (`text/...`, XML such as
`application/xml` or `image/svg+xml`, JavaScript, form data) as a string, and any other file as `binary!`, an
Excel file among them although its type has `xml` in its name.

The options of `/with`, a block or an object:

| Option | What it does |
| --- | --- |
| `method` | the HTTP method, `'PUT`, `'DELETE`...; without it, `GET`, or `POST` when there is something to send |
| `query` | a map, object or block of names and values added to the URL after `?`, as `to-query` writes them |
| `headers` | a block or map of header names and values |
| `body` | what to send: a string or binary as it is, any other value as JSON |
| `form` | a block or map sent as a web form (`application/x-www-form-urlencoded`) |
| `multipart` | a block of names and values sent as `multipart/form-data`; a file from an upload field goes as a file |
| `cookies` | `yes` sends the browser's cookies to any server, as a login on another server needs; `no` sends none; without it, they go only to the page's own server |
| `progress` | an upload field or a `progress` face whose bar shows how far the request went, or a block run with `done` and `total` bytes as it goes |
| `timeout` | how long to wait for the answer, a `time!` or a number of seconds, before it is an error |
| `full` | when true, `fetch` gives an object with `status`, `headers` and `body`, and an HTTP error is not an error |

A network failure, a timeout and, without `full`, an answer with an HTTP error are access errors, which
`try` catches.

(fn-cached)=
## cached

The last answer to a GET of url, at once (none the first time), and asks again behind: a reaction (is, react) that reads it runs again when the answer comes.

```text
cached url
```

- `url` (`url!` `string!`)

For a face that shows what a server has, with `is` or `react`: `table is [cached "/api/bookings"] [...]`. The
first time it gives `none`, the face shows what it shows empty, and the answer fills it when it comes; after
that it gives the answer it has at once, and asks again behind, and the face changes only if the answer did.

It asks again for a url when a screen is entered and reads it, when the page comes back into view (the
reader went to another tab and came back), after a `fetch` with `method` `'POST`, `'PUT`, `'PATCH` or
`'DELETE` to the same path or one above or under it (`/api/bookings/7` for `/api/bookings`), and on `refresh`.
A request that fails keeps the last answer, says why in the console, and is asked again the next time.

A reaction whose url is written out, `cached "/api/bookings"`, runs again when that url's answer comes; one
whose url is computed runs again when any answer comes.

```trebol-ui
view [
    title "Workshop"
    table is [cached "/api/bookings"] [customer "Customer" bike "Bike"]
    text is [either b: cached "/api/bookings" [rejoin [length? b " bookings"]] ["Loading…"]]
]
```

(fn-refresh)=
## refresh

Asks again for an answer kept by cached, now; reactions that read it run again when it comes.

```text
refresh url
```

- `url` (`url!` `string!`)

Asks again, now, for a url that `cached` keeps, and gives nothing back; when the answer comes, the reactions
that read `cached` of that url run again, and a face that shows it changes if the answer did. A program calls
it when it knows the server has something new, as when a stream of events says so (see `open-events`):

```
on-message news [refresh "/api/status"]
```

(fn-show-progress)=
## show-progress

Shows how far a request went on a face: a progress bar's value, or the bar of an upload or a photo.

```text
show-progress face done total
```

- `face` (`object!`)
- `done` (`integer!` `none!`): Bytes done; none once the request is over
- `total` (`integer!` `none!`): Bytes in all, when known

What `fetch/with [progress: face]` calls as the request goes; a program does not need to. A `progress` face
gets the part done as its `value`, from 0 to 1, or `none` while the total is unknown; an upload gets it as its
`sent`, which shows a bar under its files, and `none` once the request is over, which hides it.

(fn-http-request)=
## http-request

Sends an HTTP request; used by fetch.

```text
http-request url options
```

- `url` (`url!` `string!`)
- `options` (`object!` `none!`)

What `fetch` calls with its options as an object, or `none`; a program calls `fetch`.

(fn-open-socket)=
## open-socket

Opens a WebSocket; gives a handle once it is open.

```text
open-socket url
```

- `url` (`url!` `string!`)

Opens a WebSocket to a `ws://` or `wss://` url and waits until it is open; a url that cannot be opened is an
access error. The handle it gives takes `on-message`, `on-close` and `on-error`, `send` sends on it, and
`close-stream` (or `close`) hangs up. A text message comes to `on-message` in `value`, loaded as JSON when it
is a JSON object or array; a binary message comes as `binary!`. `send` sends a string or binary as it is and
any other value as JSON. `on-close` gets the close code in `value`. A socket that drops is not opened again.

```
desk: open-socket ws://localhost:8089/desk
on-message desk [print value/stock]
send desk #(ask: "bell")
```

(fn-open-events)=
## open-events

Opens a stream of server-sent events; gives a handle. It opens again by itself when it fails or the server ends it.

```text
open-events url
```

- `url` (`url!` `string!`)
- `/with options` (`block!` `object!`): headers, query, cookies, reconnect, last-id

Opens a stream of server-sent events (`text/event-stream`) and gives a handle at once; the stream opens behind.
Each event comes to `on-message` with three words:

| Word | What it has |
| --- | --- |
| `value` | the event's data: a JSON object or array as a map or block, anything else as a string |
| `event` | the event's `event:` field as a word, `'message` when it has none |
| `id` | the last `id:` the server sent, as a string, or `none` when it sent none |

A stream that fails or that the server ends opens again by itself on the same handle, so the handlers set on
it go on working, as a browser's `EventSource` does. Before each new attempt it waits: the `retry:` the server
sent, in milliseconds, or else one second that doubles up to 30 seconds, and goes back to one after a stream
that delivered an event. The browser coming back online ends the wait at once. Each new request sends the
last id in a `Last-Event-ID` header, for the server to send what came after it.

- `on-open` runs each time the stream is open, with `reconnected` false the first time and true after.
- `on-error` runs for each attempt that fails, with the error in `value`, `attempt` (1 for the first that
  failed since the last event) and the HTTP `status`, or `none` when the network failed; it is not the end.
- An answer of 204, or of 4xx such as 401 when the user is no longer signed in, stops the stream: the server
  does not want it. A 4xx runs `on-error` first; then `on-close` runs, with the status in `value`.
- `on-close` runs, too, when the program calls `close-stream`, and, with `reconnect: no`, when the server ends
  the stream (`value` is `none` for both).

The options of `/with`, a block or an object, are those of `fetch` that apply, and two of its own:

| Option | What it does |
| --- | --- |
| `headers` | a block or map of header names and values, as an `Authorization` header for a server without cookies |
| `query` | a map, object or block of names and values added to the URL after `?` |
| `cookies` | `yes` sends the browser's cookies to any server; `no` sends none; without it, they go only to the page's own server |
| `reconnect` | `no` opens the stream once: when it fails `on-error` runs, when the server ends it `on-close` runs |
| `last-id` | an event id to send as `Last-Event-ID` on the first request, to go on from it |

```
news: open-events/with "/api/events" [headers: [Authorization "Bearer 5f2a"]]
on-open news [if reconnected [refresh "/api/status"]]
on-message news [if event = 'window [refresh "/api/status"]]
on-error news [print ["stream down, attempt" attempt]]
```

A stream the server refused stays closed: to go on, the program signs in again and opens a new one, which
is a new handle, so it sets its handlers again. A function that opens the stream and, on a 401 or 403, calls
itself does both; keeping the last `id` and giving it as `last-id` lets the server send what was missed.
When signing in again fails too, the program should not open the stream again, or it asks forever.

```
last-seen: none
listen: does [
    news: open-events/with "/api/events" [last-id: last-seen]
    on-message news [last-seen: any [id last-seen]  refresh "/api/status"]
    on-close news [
        if find [401 403] value [
            if renew-token [listen]     ; renew-token: the app's own, true when signed in again
        ]
    ]
]
listen
```

(fn-events-request)=
## events-request

Opens a stream of server-sent events; used by open-events.

```text
events-request url options
```

- `url` (`url!` `string!`)
- `options` (`object!` `none!`)

What `open-events` calls with its options as an object, or `none`; a program calls `open-events`.

(fn-on-message)=
## on-message

Runs a block for each message that comes on a stream.

```text
on-message stream body
```

- `stream` (`handle!`)
- `body` (`block!`)

Sets a block to run for each message of a socket or stream of events, as a task of its own; the message is in
`value`, and for a stream of events its `event` and `id` too (see `open-events`). A stream may have more than
one; messages that came before the first was set run it when it is set. Gives the handle.

(fn-on-open)=
## on-open

Runs a block when a stream of events is open, the first time and after each reconnection (reconnected).

```text
on-open stream body
```

- `stream` (`handle!`)
- `body` (`block!`)

Sets a block to run each time a stream of events is open: the first time, with `reconnected` false, and after
each time it opened again, with `reconnected` true, when a program asks again for what it may have missed.

(fn-on-close)=
## on-close

Runs a block when a stream closes.

```text
on-close stream body
```

- `stream` (`handle!`)
- `body` (`block!`)

Sets a block to run when a socket or stream closes. For a socket, `value` is the close code. A stream of
events closes only when the program calls `close-stream`, when the server refuses it (204 or 4xx, `value` is
the status) or, with `reconnect: no`, when the server ends it.

(fn-on-error)=
## on-error

Runs a block when a stream fails; a stream of events tries again, with attempt and status.

```text
on-error stream body
```

- `stream` (`handle!`)
- `body` (`block!`)

Sets a block to run when a socket or stream fails, with the error in `value`. A stream of events goes on
trying: the block runs for each attempt that fails, with `attempt`, the count, and `status`, the HTTP status or
`none`.

(fn-close-stream)=
## close-stream

Closes a socket or a stream of events.

```text
close-stream stream
```

- `stream` (`handle!`)

Closes a socket or a stream of events for good: a stream of events is not opened again, and its `on-close`
runs. `close` does the same with a handle (and hides a dialog); a socket takes `send` to send a value on it, as
`open-socket` says.

(fn-read-file)=
## read-file

The bytes of a file the user chose.

```text
read-file file
```

- `file` (`handle!`)
