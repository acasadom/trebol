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

The options of `/with`, a block or an object:

| Option | What it does |
| --- | --- |
| `method` | the HTTP method, `'PUT`, `'DELETE`...; without it, `GET`, or `POST` when there is something to send |
| `headers` | a block or map of header names and values |
| `body` | what to send: a string or binary as it is, any other value as JSON |
| `form` | a block or map sent as a web form (`application/x-www-form-urlencoded`) |
| `multipart` | a block of names and values sent as `multipart/form-data`; a file from an upload field goes as a file |
| `timeout` | how long to wait for the answer, a `time!` or a number of seconds, before it is an error |
| `full` | when true, `fetch` gives an object with `status`, `headers` and `body`, and an HTTP error is not an error |

A network failure, a timeout and, without `full`, an answer with an HTTP error are access errors, which
`try` catches.

(fn-http-request)=
## http-request

Sends an HTTP request; used by fetch.

```text
http-request url options
```

- `url` (`url!` `string!`)
- `options` (`object!` `none!`)

(fn-open-socket)=
## open-socket

Opens a WebSocket; gives a handle once it is open.

```text
open-socket url
```

- `url` (`url!` `string!`)

(fn-open-events)=
## open-events

Opens a stream of server-sent events; gives a handle.

```text
open-events url
```

- `url` (`url!` `string!`)

(fn-on-message)=
## on-message

Runs a block for each message that comes on a stream.

```text
on-message stream body
```

- `stream` (`handle!`)
- `body` (`block!`)

(fn-on-close)=
## on-close

Runs a block when a stream closes.

```text
on-close stream body
```

- `stream` (`handle!`)
- `body` (`block!`)

(fn-on-error)=
## on-error

Runs a block when a stream fails.

```text
on-error stream body
```

- `stream` (`handle!`)
- `body` (`block!`)

(fn-send)=
## send

Sends a value on a socket.

```text
send stream data
```

- `stream` (`handle!`)
- `data` (`any-value!`)

(fn-close-stream)=
## close-stream

Closes a socket or a stream of events.

```text
close-stream stream
```

- `stream` (`handle!`)

(fn-read-file)=
## read-file

The bytes of a file the user chose.

```text
read-file file
```

- `file` (`handle!`)
