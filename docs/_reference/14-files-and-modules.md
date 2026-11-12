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
