# Files and modules

Reading files and web addresses, running scripts and importing modules, giving the user files to save,
keeping small values in the browser, opening other addresses and using the clipboard. See [modules](../language/13-modules.md).

## suffix?

As in R3: the part from the last dot, as a `file!`, when no `/` follows it; in a URL, the query after `?` and the
part after `#` do not count.

## read

## do-file

## import

## download

The browser saves the file with its usual dialog, or into the Downloads folder: only the name of the file is
used, not its folder. The type comes from the extension (`.csv`, `.json`, `.txt`, `.png`, `.pdf`...). Text is
written as UTF-8; a `.csv` starts with a byte order mark, so spreadsheets read its accents right. On a host
with no browser it is an access error.

The data can also be the answer of `fetch/with [... full: true]`, for a file the server makes, like a report
as a PDF: its body is saved, with the type the server says. When the answer has a name in
`content-disposition` (`filename*=UTF-8''...` carries accents, and wins over `filename=`), that name is used
and returned; otherwise the one given. An answer with a status of 400 or more is an `access/http` error, and
nothing is saved.

## save

R3's `save`, in a browser: the file goes to the user through `download`, so its name is all that counts. The
suffix chooses how the value is written, as in R3: `.json` with `to-json`, `.csv` with `to-csv`, `.xml` with
`to-xml`, and any other as Trebol source, in the form `mold/all` gives, so that `load` reads back the same
values; a block is written without its outer brackets. With `none` instead of a name, it gives those bytes as a
`binary!`, and `load` reads them too:

```trebol-console
>> load save none [order 7 #(bike: "Road") 12-Nov-2026]
== [order 7 #(bike: "Road") 12-Nov-2026]
```

A file the user chose comes back with `load read-file file`, from an upload field. `/all` is there for R3
code: every value is always written so that it loads back. A web address cannot be a target; `fetch` sends to
servers.

## save-local

## load-local

## remove-local

## browse

In the browser the address opens in a new tab, which cannot reach back to the page; a `file!` is taken from the
page's own address. In the console it opens in the system's browser, as R3 does. Browsers open new tabs only
when the user has just done something, so call it from a button or a link, not from a timer.

## write-clipboard

The names are Red's. Browsers let a page write to the clipboard when the user has just done something, such as
clicking a *Copy* button; `false` says the browser refused.

## read-clipboard

The browser asks the user the first time a page reads the clipboard, and gives `none` when the user says no.
