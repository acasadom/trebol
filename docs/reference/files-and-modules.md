<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Files and modules

Reading files and web addresses, running scripts and importing modules, giving the user files to save,
keeping small values in the browser, opening other addresses and using the clipboard. See [modules](../language/13-modules.md).

(fn-suffix-3f)=
## suffix?

The suffix of a file name or URL, as %.txt; none when it has none.

```text
suffix? path
```

- `path` (`file!` `url!` `string!`)

As in R3: the part from the last dot, as a `file!`, when no `/` follows it; in a URL, the query after `?` and the
part after `#` do not count.

(fn-read)=
## read

The text of a file or a web address.

```text
read source
```

- `source` (`file!` `url!`)

(fn-do-file)=
## do-file

Runs the script in a file, as do does; a module is imported.

```text
do-file file
```

- `file` (`file!` `url!`)

(fn-import)=
## import

Runs a module and gives its exports.

```text
import source
```

- `source` (`file!` `url!` `string!`)

(fn-download)=
## download

Gives the user a file to save: text (as UTF-8), bytes, or the answer of fetch/with \[full: true\], under the name the server gives.

```text
download name data
```

- `name` (`file!` `string!`)
- `data` (`string!` `binary!` `object!`)

The browser saves the file with its usual dialog, or into the Downloads folder: only the name of the file is
used, not its folder. The type comes from the extension (`.csv`, `.json`, `.txt`, `.png`, `.pdf`...). Text is
written as UTF-8; a `.csv` starts with a byte order mark, so spreadsheets read its accents right. On a host
with no browser it is an access error.

The data can also be the answer of `fetch/with [... full: true]`, for a file the server makes, like a report
as a PDF: its body is saved, with the type the server says. When the answer has a name in
`content-disposition` (`filename*=UTF-8''...` carries accents, and wins over `filename=`), that name is used
and returned; otherwise the one given. An answer with a status of 400 or more is an `access/http` error, and
nothing is saved.

(fn-save-local)=
## save-local

Keeps a value in the browser, under a key.

```text
save-local key value
```

- `key` (`string!` `word!`)
- `value` (`any-value!`)

(fn-load-local)=
## load-local

The value kept in the browser under a key, or none.

```text
load-local key
```

- `key` (`string!` `word!`)

(fn-remove-local)=
## remove-local

Forgets the value kept in the browser under a key.

```text
remove-local key
```

- `key` (`string!` `word!`)

(fn-browse)=
## browse

Opens a web address in a new tab.

```text
browse url
```

- `url` (`url!` `file!`)

In the browser the address opens in a new tab, which cannot reach back to the page; a `file!` is taken from the
page's own address. In the console it opens in the system's browser, as R3 does. Browsers open new tabs only
when the user has just done something, so call it from a button or a link, not from a timer.

(fn-write-clipboard)=
## write-clipboard

Puts text on the clipboard; true when it is there.

```text
write-clipboard data
```

- `data` (`string!`)

The names are Red's. Browsers let a page write to the clipboard when the user has just done something, such as
clicking a *Copy* button; `false` says the browser refused.

(fn-read-clipboard)=
## read-clipboard

The text on the clipboard, or none; the browser may ask the user first.

```text
read-clipboard
```

The browser asks the user the first time a page reads the clipboard, and gives `none` when the user says no.
