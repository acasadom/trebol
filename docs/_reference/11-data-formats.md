# Data formats

Reading values from text, and writing and reading them in other formats: JSON, CSV, base 64 and hexadecimal,
and checksums.

## load

## to-json

## load-json

## load-csv

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

## to-csv

What it takes: a block of blocks (each a row); a block of maps or objects, with a header line from their
keys in the order first seen; a flat block with `/skip size`; or a map of columns, each key with a block of
values. A block of plain values is one row. `none` is an empty field. Dates are written in ISO 8601, as
`2026-11-10` or `2026-11-10 09:30:00`, and amounts as plain numbers, `1250.50`, as `to-json` writes them:
every program and spreadsheet reads them. Other values are written as `form` writes them. A field is put in quotes when it holds the delimiter, a quote or a line break, or starts or
ends with a space. Every row ends with a new line. `/with` and `/quote` work as in `load-csv`.

`/language 'es` writes dates, times, decimals, percents and amounts as that language does, as
`format-local` does (`11/11/2026`, `1250,50 €`, `1,5`), for a person who opens the file in a spreadsheet
in that language. Integers stay as they are, so an id gains no thousands separator. Where the language
writes decimals with a comma, the delimiter is a semicolon, which is what spreadsheets in that language
expect; `/with` still chooses another.

## enbase

## debase

## to-hex

## dehex

## checksum
