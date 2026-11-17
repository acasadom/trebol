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

Runs a module and gives its exports; a word is a package by its name, from node\_modules.

```text
import source
```

- `source` (`file!` `url!` `string!` `word!`)

A module's header may list `parts: [%a.trb %b.trb]`: files of the same module, read from where it is, which run
in order before its own body and share its words. See [A module in several files](../language/13-modules.md#a-module-in-several-files).

`import 'trebol-es` imports a package: the file its `package.json` names as `"trebol"`, in the first
`node_modules/trebol-es/` going up from the importing file. See [A package](../language/13-modules.md#a-package).

A `.js` or `.mjs` file is a JavaScript module: the object has a function for each function it exports, with its
name in Trebol's way (`inchesToCm` is `inches-to-cm`) and its parameters as the spec, or the Trebol spec in its
`spec` property; its other exports are values. Arguments and results cross as JSON, a promise is waited for,
and an exception is a `script/js-error`. See [A module in JavaScript](../language/13-modules.md#a-module-in-javascript).

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

(fn-save)=
## save

Gives the user a file with a value written so load reads it back; .json, .csv and .xml are written as such.

```text
save where value
```

- `where` (`file!` `none!`): The name of the file, or none for the bytes
- `value` (`any-type!`)
- `/all`: Kept for R3 code: values are always written so load gives them back

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
