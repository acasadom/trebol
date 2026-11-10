<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Data formats

Reading values from text, and writing and reading them in other formats: JSON, CSV, base 64 and hexadecimal,
and checksums.

(fn-load)=
## load

Reads Trebol source text, or a file of it, into values: the value itself, or a block when there are several.

```text
load source
```

- `source` (`string!` `file!` `url!`)
- `/all`: Gives a block even for one value

(fn-to-json)=
## to-json

Writes a value as JSON text.

```text
to-json value
```

- `value` (`any-type!`)

(fn-load-json)=
## load-json

Reads JSON text into Trebol values: objects as maps, lists as blocks.

```text
load-json source
```

- `source` (`string!` `binary!`)

(fn-load-csv)=
## load-csv

Reads CSV text into a block of rows, each a block of strings.

```text
load-csv data
```

- `data` (`string!` `binary!`)
- `/with delimiter` (`char!` `string!`): Another delimiter than a comma
- `/header`: The first line names the columns; gives columns unless /as-records
- `/as-columns`: A map of columns: name and block of values
- `/as-records`: A block of maps, one per row; implies /header
- `/flat`: One block with every field
- `/trim`: Leave out spaces around fields
- `/quote qt-char` (`char!`): Another quote character than a double quote

Every field is a `string!`, as in Red: `"01001"` stays a postal code, and the program turns what it means as
numbers or dates with `to`. Rows end at CRLF, LF or CR; a field in double quotes can hold the delimiter, line
breaks and quotes written twice (`""`). Empty lines and a byte order mark at the start are left out. A quote
that never closes is a syntax error.

| Refinement | What it gives |
| --- | --- |
| none | a block of rows, each a block of strings |
| `/header` | the first line names the columns: a map of columns, or records with `/as-records` |
| `/as-columns` | a map of each column's name and a block of its values; without `/header` the names are `"A"`, `"B"` ... as in a spreadsheet |
| `/as-records` | a block of maps, one per row, keyed by the first line; a missing field is `none` |
| `/flat` | one block with every field |
| `/with` | another delimiter: a char such as `#";"` or a string |
| `/trim` | leaves out the spaces around fields |
| `/quote` | another quote character |

Column names are string keys, as in Red: `select row "Name"`, or `row/("Name")`; a table finds them by its
column words. A name that repeats gets `" 2"`, `" 3"` after it.

(fn-to-csv)=
## to-csv

Writes CSV text from rows: a block of blocks, of maps or objects (a header from their keys), a flat block with /skip, or a map of columns.

```text
to-csv data
```

- `data` (`block!` `map!` `object!`)
- `/with delimiter` (`char!` `string!`): Another delimiter than a comma
- `/skip size` (`integer!`): A flat block, so many fields to a row
- `/quote qt-char` (`char!`): Another quote character than a double quote

What it takes: a block of blocks (each a row); a block of maps or objects, with a header line from their
keys in the order first seen; a flat block with `/skip size`; or a map of columns, each key with a block of
values. A block of plain values is one row. `none` is an empty field; other values are written as `form`
writes them. A field is put in quotes when it holds the delimiter, a quote or a line break, or starts or
ends with a space. Every row ends with a new line. `/with` and `/quote` work as in `load-csv`.

(fn-enbase)=
## enbase

Writes bytes as text in base 64, or another base.

```text
enbase value
```

- `value` (`binary!` `any-string!`)
- `/base base-value` (`integer!`): 2, 16 or 64

(fn-debase)=
## debase

Reads bytes written as text in base 64, or another base.

```text
debase value
```

- `value` (`any-string!` `binary!`)
- `/base base-value` (`integer!`): 2, 16 or 64

(fn-to-hex)=
## to-hex

The value in hexadecimal, as an issue.

```text
to-hex value
```

- `value` (`integer!` `tuple!`)
- `/size len` (`integer!`): Use this many digits

(fn-dehex)=
## dehex

Turns %xx escapes in a string or URL back into characters.

```text
dehex value
```

- `value` (`any-string!`)

(fn-checksum)=
## checksum

A checksum or hash of the bytes: md5 sha1 sha256 give a binary, crc32 adler32 an integer.

```text
checksum data method
```

- `data` (`binary!` `any-string!`)
- `method` (`word!`)
