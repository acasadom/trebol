# Data formats

Reading values from text, and writing and reading them in other formats: JSON, CSV, XML, the query of a URL,
base 64 and hexadecimal, checksums and compressed bytes.

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

## load-xml

XML loads in the shape of Red's community codec: every node is three values, its **name**, its
**content** and its **attributes**. An element's content is a block of nodes, empty for `<linea/>`; its
attributes are a map, or `none` when it has none. A text is `none`, the text and `none`, so
`foreach [name content atts] content [...]` walks any content:

```trebol-console
>> load-xml {<factura id="7"><cliente nif="B123">Ana &amp; Co</cliente><linea/></factura>}
== [factura [cliente [none "Ana & Co" none] #(nif: "B123") linea [] none] #(id: "7")]
```

Names are words when they read as one, as the keys of `load-json`, and strings otherwise: `"fe:Facturae"`,
`"xmlns:fe"`. Entities (`&amp;`, `&#233;`) and CDATA sections load as text; an entity XML does not define
stays as written. Comments, processing instructions, the `<?xml ...?>` line, the DOCTYPE and the spaces only
between tags are left out. A tag that is never closed, or closed by another, is a syntax error that says
on which line.

In a block written in code, `none` is a word, not the `none` value that `load-xml` puts there: both mold
the same, but they are not equal. Compare loaded XML with `none? name`.

## to-xml

Writes the nodes as `load-xml` gives them, so `to-xml load-xml text` is the same XML without the parts it
leaves out. Text is escaped (`&amp;`, `&lt;`, `&gt;`, and `&quot;` in attributes); an element with no content
is written `<linea/>`. In code, the word `none` counts as the `none` value, the attributes can be a map, an
object or a block of names and values, and the content can be a single value instead of a block, which is
its text:

```trebol-console
>> to-xml [total 1250.5 [currency "EUR"]  due 11-Nov-2026 none]
== {<total currency="EUR">1250.5</total><due>2026-11-11</due>}
```

Values are written as `to-csv` writes them: dates in ISO 8601, amounts as plain numbers. An attribute whose
value is `none` is left out. `/declaration` starts with `<?xml version="1.0" encoding="UTF-8"?>`, which a
whole document needs; without it the text can also go inside other XML.

## to-query

Writes each name and value as `name=value`, joined by `&`, with what a URL cannot hold as `%xx` escapes. A block
value gives the name once for each of its values, and a `none` value is left out. Values are written as `to-csv`
writes them: dates in ISO 8601, amounts as plain numbers.

```trebol-console
>> to-query #(q: "café" tags: ["a" "b"] page: 2)
== "q=caf%C3%A9&tags=a&tags=b&page=2"
```

`fetch/with url [query: #(...)]` adds the same text to the URL it requests.

## load-query

Takes the text after `?`, or a whole URL, and gives a map. Names that read as words are words, the rest stay
strings; every value is a `string!`, as in `load-csv`. A name given more than once holds a block of its values, a
name with no `=` holds `""`, and `+` is a space, as forms send it.

```trebol-console
>> load-query http://shop.example/search?q=caf%C3%A9+con+leche&tag=a&tag=b
== #(q: "café con leche" tag: ["a" "b"])
```

## enbase

## debase

## to-hex

## enhex

What stays as it is depends on the value, as in R3: in a `url!` or a `file!`, every character a URL may hold
(`/ ? : @ & = + $ , ; #` among them); in other text, only letters, digits and `- _ . ! ~ * ' ( )`, so the text can
go inside one part of a URL. `/uri` writes spaces as `+`.

## dehex

## checksum

## compress

The methods are R3's and Red's: `gzip` (the `.gz` file format), `zlib` (what HTTP calls `deflate`) and
`deflate` (the bare stream, as inside a ZIP file). What one writes, the others read: R3 decompresses what Trebol
compresses, and the other way round, although the bytes need not be the same. The browser does the work, so a
program waits for it as it does for `fetch`.

```trebol-console
>> to string! decompress compress "a long text, a long text, a long text" 'gzip 'gzip
== "a long text, a long text, a long text"
```

## decompress

Bytes that are not compressed with that method are a `script/bad-compression` error.
