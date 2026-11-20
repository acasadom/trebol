<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Values and types

Every value has a datatype, and these functions make values, convert them from one datatype to another, and
ask what a value is. `type?` names a value's datatype; each datatype also has a test that ends in `?`, and most
have a conversion that starts with `to-`, a shorter way of writing `to`. See
[values](../language/02-values.md).

(fn-make)=
## make

Makes a new value of a type, or from a prototype object.

```text
make type spec
```

- `type` (`any-value!`)
- `spec` (`any-value!`)

(fn-to)=
## to

Converts a value to another type.

```text
to type value
```

- `type` (`datatype!` `any-value!`)
- `value` (`any-type!`)

(fn-as-pair)=
## as-pair

Makes a pair of two numbers: as-pair 3 4 is 3x4.

```text
as-pair x y
```

- `x` (`number!`)
- `y` (`number!`)

(fn-construct)=
## construct

Makes an object from a block without evaluating its values.

```text
construct block
```

- `block` (`block!`)

(fn-type-3f)=
## type?

The datatype of a value.

```text
type? value
```

- `value` (`any-type!`)
- `/word`: Its name as a word, integer! for 3

For example `type? 3` gives the datatype `integer!`; `type?/word 3` gives the word `integer!`, to keep in a
block or to compare with one.

(fn-value-3f)=
## value?

True if the word has a value.

```text
value? word
```

- `word` (`any-word!`)

(fn-quote)=
## quote

The value as it is, not evaluated.

```text
quote :value
```

- `:value` (`any-type!`)

(fn-any-type-3f)=
## any-type?

True if the value is any-type!

```text
any-type? value
```

- `value` (`any-type!`)

(fn-any-value-3f)=
## any-value?

True if the value is any-value!

```text
any-value? value
```

- `value` (`any-type!`)

(fn-number-3f)=
## number?

True if the value is number!

```text
number? value
```

- `value` (`any-type!`)

(fn-scalar-3f)=
## scalar?

True if the value is scalar!

```text
scalar? value
```

- `value` (`any-type!`)

(fn-any-string-3f)=
## any-string?

True if the value is any-string!

```text
any-string? value
```

- `value` (`any-type!`)

(fn-any-word-3f)=
## any-word?

True if the value is any-word!

```text
any-word? value
```

- `value` (`any-type!`)

(fn-any-block-3f)=
## any-block?

True if the value is any-block!

```text
any-block? value
```

- `value` (`any-type!`)

(fn-any-path-3f)=
## any-path?

True if the value is any-path!

```text
any-path? value
```

- `value` (`any-type!`)

(fn-any-object-3f)=
## any-object?

True if the value is any-object!

```text
any-object? value
```

- `value` (`any-type!`)

(fn-any-function-3f)=
## any-function?

True if the value is any-function!

```text
any-function? value
```

- `value` (`any-type!`)

(fn-none-3f)=
## none?

True if the value is none!

```text
none? value
```

- `value` (`any-type!`)

(fn-logic-3f)=
## logic?

True if the value is logic!

```text
logic? value
```

- `value` (`any-type!`)

(fn-integer-3f)=
## integer?

True if the value is integer!

```text
integer? value
```

- `value` (`any-type!`)

(fn-decimal-3f)=
## decimal?

True if the value is decimal!

```text
decimal? value
```

- `value` (`any-type!`)

(fn-percent-3f)=
## percent?

True if the value is percent!

```text
percent? value
```

- `value` (`any-type!`)

(fn-money-3f)=
## money?

True if the value is money!

```text
money? value
```

- `value` (`any-type!`)

(fn-pair-3f)=
## pair?

True if the value is pair!

```text
pair? value
```

- `value` (`any-type!`)

(fn-tuple-3f)=
## tuple?

True if the value is tuple!

```text
tuple? value
```

- `value` (`any-type!`)

(fn-date-3f)=
## date?

True if the value is date!

```text
date? value
```

- `value` (`any-type!`)

(fn-time-3f)=
## time?

True if the value is time!

```text
time? value
```

- `value` (`any-type!`)

(fn-char-3f)=
## char?

True if the value is char!

```text
char? value
```

- `value` (`any-type!`)

(fn-string-3f)=
## string?

True if the value is string!

```text
string? value
```

- `value` (`any-type!`)

(fn-file-3f)=
## file?

True if the value is file!

```text
file? value
```

- `value` (`any-type!`)

(fn-email-3f)=
## email?

True if the value is email!

```text
email? value
```

- `value` (`any-type!`)

(fn-url-3f)=
## url?

True if the value is url!

```text
url? value
```

- `value` (`any-type!`)

(fn-tag-3f)=
## tag?

True if the value is tag!

```text
tag? value
```

- `value` (`any-type!`)

(fn-binary-3f)=
## binary?

True if the value is binary!

```text
binary? value
```

- `value` (`any-type!`)

(fn-bitset-3f)=
## bitset?

True if the value is bitset!

```text
bitset? value
```

- `value` (`any-type!`)

(fn-word-3f)=
## word?

True if the value is word!

```text
word? value
```

- `value` (`any-type!`)

(fn-set-word-3f)=
## set-word?

True if the value is set-word!

```text
set-word? value
```

- `value` (`any-type!`)

(fn-get-word-3f)=
## get-word?

True if the value is get-word!

```text
get-word? value
```

- `value` (`any-type!`)

(fn-lit-word-3f)=
## lit-word?

True if the value is lit-word!

```text
lit-word? value
```

- `value` (`any-type!`)

(fn-refinement-3f)=
## refinement?

True if the value is refinement!

```text
refinement? value
```

- `value` (`any-type!`)

(fn-issue-3f)=
## issue?

True if the value is issue!

```text
issue? value
```

- `value` (`any-type!`)

(fn-block-3f)=
## block?

True if the value is block!

```text
block? value
```

- `value` (`any-type!`)

(fn-paren-3f)=
## paren?

True if the value is paren!

```text
paren? value
```

- `value` (`any-type!`)

(fn-path-3f)=
## path?

True if the value is path!

```text
path? value
```

- `value` (`any-type!`)

(fn-set-path-3f)=
## set-path?

True if the value is set-path!

```text
set-path? value
```

- `value` (`any-type!`)

(fn-get-path-3f)=
## get-path?

True if the value is get-path!

```text
get-path? value
```

- `value` (`any-type!`)

(fn-lit-path-3f)=
## lit-path?

True if the value is lit-path!

```text
lit-path? value
```

- `value` (`any-type!`)

(fn-map-3f)=
## map?

True if the value is map!

```text
map? value
```

- `value` (`any-type!`)

(fn-object-3f)=
## object?

True if the value is object!

```text
object? value
```

- `value` (`any-type!`)

(fn-error-3f)=
## error?

True if the value is error!

```text
error? value
```

- `value` (`any-type!`)

(fn-function-3f)=
## function?

True if the value is function!

```text
function? value
```

- `value` (`any-type!`)

(fn-native-3f)=
## native?

True if the value is native!

```text
native? value
```

- `value` (`any-type!`)

(fn-op-3f)=
## op?

True if the value is op!

```text
op? value
```

- `value` (`any-type!`)

(fn-datatype-3f)=
## datatype?

True if the value is datatype!

```text
datatype? value
```

- `value` (`any-type!`)

(fn-typeset-3f)=
## typeset?

True if the value is typeset!

```text
typeset? value
```

- `value` (`any-type!`)

(fn-handle-3f)=
## handle?

True if the value is handle!

```text
handle? value
```

- `value` (`any-type!`)

(fn-unset-3f)=
## unset?

True if the value is unset!

```text
unset? value
```

- `value` (`any-type!`)

(fn-series-3f)=
## series?

True if the value is series!

```text
series? value
```

- `value` (`any-type!`)

(fn-to-logic)=
## to-logic

Converts a value to logic!

```text
to-logic value
```

- `value` (any value)

(fn-to-integer)=
## to-integer

Converts a value to integer!

```text
to-integer value
```

- `value` (any value)

(fn-to-decimal)=
## to-decimal

Converts a value to decimal!

```text
to-decimal value
```

- `value` (any value)

(fn-to-percent)=
## to-percent

Converts a value to percent!

```text
to-percent value
```

- `value` (any value)

(fn-to-money)=
## to-money

Converts a value to money!

```text
to-money value
```

- `value` (any value)

(fn-to-char)=
## to-char

Converts a value to char!

```text
to-char value
```

- `value` (any value)

(fn-to-pair)=
## to-pair

Converts a value to pair!

```text
to-pair value
```

- `value` (any value)

(fn-to-tuple)=
## to-tuple

Converts a value to tuple!

```text
to-tuple value
```

- `value` (any value)

(fn-to-date)=
## to-date

Converts a value to date!

```text
to-date value
```

- `value` (any value)

(fn-to-time)=
## to-time

Converts a value to time!

```text
to-time value
```

- `value` (any value)

(fn-to-string)=
## to-string

Converts a value to string!

```text
to-string value
```

- `value` (any value)

(fn-to-file)=
## to-file

Converts a value to file!

```text
to-file value
```

- `value` (any value)

(fn-to-email)=
## to-email

Converts a value to email!

```text
to-email value
```

- `value` (any value)

(fn-to-url)=
## to-url

Converts a value to url!

```text
to-url value
```

- `value` (any value)

(fn-to-tag)=
## to-tag

Converts a value to tag!

```text
to-tag value
```

- `value` (any value)

(fn-to-binary)=
## to-binary

Converts a value to binary!

```text
to-binary value
```

- `value` (any value)

(fn-to-bitset)=
## to-bitset

Converts a value to bitset!

```text
to-bitset value
```

- `value` (any value)

(fn-to-word)=
## to-word

Converts a value to word!

```text
to-word value
```

- `value` (any value)

(fn-to-set-word)=
## to-set-word

Converts a value to set-word!

```text
to-set-word value
```

- `value` (any value)

(fn-to-get-word)=
## to-get-word

Converts a value to get-word!

```text
to-get-word value
```

- `value` (any value)

(fn-to-lit-word)=
## to-lit-word

Converts a value to lit-word!

```text
to-lit-word value
```

- `value` (any value)

(fn-to-refinement)=
## to-refinement

Converts a value to refinement!

```text
to-refinement value
```

- `value` (any value)

(fn-to-issue)=
## to-issue

Converts a value to issue!

```text
to-issue value
```

- `value` (any value)

(fn-to-block)=
## to-block

Converts a value to block!

```text
to-block value
```

- `value` (any value)

(fn-to-paren)=
## to-paren

Converts a value to paren!

```text
to-paren value
```

- `value` (any value)

(fn-to-path)=
## to-path

Converts a value to path!

```text
to-path value
```

- `value` (any value)

(fn-to-set-path)=
## to-set-path

Converts a value to set-path!

```text
to-set-path value
```

- `value` (any value)

(fn-to-get-path)=
## to-get-path

Converts a value to get-path!

```text
to-get-path value
```

- `value` (any value)

(fn-to-lit-path)=
## to-lit-path

Converts a value to lit-path!

```text
to-lit-path value
```

- `value` (any value)

(fn-to-map)=
## to-map

Converts a value to map!

```text
to-map value
```

- `value` (any value)
