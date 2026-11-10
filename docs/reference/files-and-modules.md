<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Files and modules

Reading files and web addresses, running scripts and importing modules, giving the user files to save, and
keeping small values in the browser. See [modules](../language/13-modules.md).

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
