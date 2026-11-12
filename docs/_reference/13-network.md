# Network

Asking web servers, and talking with them over WebSocket and server-sent events. `fetch` reads JSON as Trebol
values. See [tasks and the network](../language/12-tasks-and-network.md) and
[talking to a server](../ui/09-server.md).

## fetch

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
| `timeout` | how long to wait for the answer, a `time!` or a number of seconds, before it is an error |
| `full` | when true, `fetch` gives an object with `status`, `headers` and `body`, and an HTTP error is not an error |

A network failure, a timeout and, without `full`, an answer with an HTTP error are access errors, which
`try` catches.

## http-request

## open-socket

## open-events

## on-message

## on-close

## on-error

## send

## close-stream

## read-file
