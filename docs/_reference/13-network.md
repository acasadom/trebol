# Network

Asking web servers, and talking with them over WebSocket and server-sent events. `fetch` reads JSON as Trebol
values. See [tasks and the network](../language/12-tasks-and-network.md) and
[talking to a server](../ui/09-server.md).

## fetch

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

## cached

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

## refresh

## show-progress

What `fetch/with [progress: face]` calls as the request goes; a program does not need to. A `progress` face
gets the part done as its `value`, from 0 to 1, or `none` while the total is unknown; an upload gets it as its
`sent`, which shows a bar under its files, and `none` once the request is over, which hides it.

## http-request

## open-socket

## open-events

## on-message

## on-close

## on-error

## send

## close-stream

## read-file
