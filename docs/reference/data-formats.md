<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Data formats

Reading values from text, and writing and reading them in other formats: JSON, base 64 and hexadecimal, and
checksums.

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
