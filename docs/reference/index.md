<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Reference

Every function a Trebol program can call, with what it takes and what it gives. Each entry is read from the
function itself, as `help` shows it in the console, so it is always the function as it is.

An entry starts with what the function does and how it is called: its name, then its arguments in order.
**Takes** lists the kinds of value each argument accepts; a word ending in `!` is a datatype, such as
`integer!`, or a set of them, such as `series!`. **Refinements** are the words written after a slash,
`append/only`, that change what a function does; the arguments a refinement takes follow the call's own.
**Gives** is the kind of value it returns, when the function says so.

The functions are grouped by what they work on, and the last pages are the UI dialect's: its styles, its words
and the words of its theme. The tutorials show them at work: the
[language tutorial](../language/01-getting-started.md) and [building screens](../ui/01-first-screen.md).

```{toctree}
:maxdepth: 1

values
words-and-contexts
functions
evaluation-and-control
errors
math
comparison
series
text
parse
data-formats
tasks-and-time
network
files-and-modules
console
languages
screens
styles
dialect
theme
draw
```

## Every function

### Signs

[`-`](#fn--) · [`!==`](#fn--21-3d-3d) · [`?`](#fn--3f) · [`??`](#fn--3f-3f) · [`*`](#fn--2a) · [`**`](#fn--2a-2a) · [`/`](#fn--2f) · [`//`](#fn--2f-2f) · [`+`](#fn--2b) · [`<`](#fn--3c) · [`<<`](#fn--3c-3c) · [`<=`](#fn--3c-3d) · [`<>`](#fn--3c-3e) · [`=`](#fn--3d) · [`==`](#fn--3d-3d) · [`>`](#fn--3e) · [`>=`](#fn--3e-3d) · [`>>`](#fn--3e-3e) · [`>>>`](#fn--3e-3e-3e)

### A

[`abs`](#fn-abs) · [`add`](#fn-add) · [`ajoin`](#fn-ajoin) · [`all`](#fn-all) · [`also`](#fn-also) · [`alter`](#fn-alter) · [`and`](#fn-and) · [`and~`](#fn-and-7e) · [`any`](#fn-any) · [`any-block?`](#fn-any-block-3f) · [`any-function?`](#fn-any-function-3f) · [`any-object?`](#fn-any-object-3f) · [`any-path?`](#fn-any-path-3f) · [`any-string?`](#fn-any-string-3f) · [`any-type?`](#fn-any-type-3f) · [`any-value?`](#fn-any-value-3f) · [`any-word?`](#fn-any-word-3f) · [`append`](#fn-append) · [`apply`](#fn-apply) · [`arccosine`](#fn-arccosine) · [`arcsine`](#fn-arcsine) · [`arctangent`](#fn-arctangent) · [`arctangent2`](#fn-arctangent2) · [`array`](#fn-array) · [`as-pair`](#fn-as-pair) · [`at`](#fn-at) · [`attempt`](#fn-attempt)

### B

[`back`](#fn-back) · [`binary?`](#fn-binary-3f) · [`bind`](#fn-bind) · [`bitset?`](#fn-bitset-3f) · [`block?`](#fn-block-3f) · [`body-of`](#fn-body-of) · [`bound?`](#fn-bound-3f) · [`break`](#fn-break) · [`browse`](#fn-browse)

### C

[`can-go-back?`](#fn-can-go-back-3f) · [`can-go-forward?`](#fn-can-go-forward-3f) · [`cancel`](#fn-cancel) · [`case`](#fn-case) · [`catch`](#fn-catch) · [`cause-error`](#fn-cause-error) · [`change`](#fn-change) · [`char?`](#fn-char-3f) · [`charset`](#fn-charset) · [`checksum`](#fn-checksum) · [`clear`](#fn-clear) · [`close`](#fn-close) · [`close-stream`](#fn-close-stream) · [`closure`](#fn-closure) · [`collect`](#fn-collect) · [`collect-words`](#fn-collect-words) · [`comment`](#fn-comment) · [`complement`](#fn-complement) · [`compose`](#fn-compose) · [`compress`](#fn-compress) · [`confirm`](#fn-confirm) · [`construct`](#fn-construct) · [`context`](#fn-context) · [`context?`](#fn-context-3f) · [`continue`](#fn-continue) · [`copy`](#fn-copy) · [`cosine`](#fn-cosine)

### D

[`datatype?`](#fn-datatype-3f) · [`date?`](#fn-date-3f) · [`debase`](#fn-debase) · [`decimal?`](#fn-decimal-3f) · [`decompress`](#fn-decompress) · [`default`](#fn-default) · [`dehex`](#fn-dehex) · [`delay`](#fn-delay) · [`difference`](#fn-difference) · [`divide`](#fn-divide) · [`do`](#fn-do) · [`do-file`](#fn-do-file) · [`does`](#fn-does) · [`download`](#fn-download)

### E

[`either`](#fn-either) · [`email?`](#fn-email-3f) · [`empty?`](#fn-empty-3f) · [`enbase`](#fn-enbase) · [`enhex`](#fn-enhex) · [`equal?`](#fn-equal-3f) · [`error?`](#fn-error-3f) · [`even?`](#fn-even-3f) · [`every`](#fn-every) · [`exclude`](#fn-exclude) · [`exit`](#fn-exit) · [`exp`](#fn-exp) · [`extract`](#fn-extract)

### F

[`fetch`](#fn-fetch) · [`field-error`](#fn-field-error) · [`fifth`](#fn-fifth) · [`file?`](#fn-file-3f) · [`find`](#fn-find) · [`first`](#fn-first) · [`forall`](#fn-forall) · [`foreach`](#fn-foreach) · [`forever`](#fn-forever) · [`form`](#fn-form) · [`form-values`](#fn-form-values) · [`format-local`](#fn-format-local) · [`forskip`](#fn-forskip) · [`fourth`](#fn-fourth) · [`func`](#fn-func) · [`function`](#fn-function) · [`function?`](#fn-function-3f)

### G

[`get`](#fn-get) · [`get-path?`](#fn-get-path-3f) · [`get-word?`](#fn-get-word-3f) · [`go`](#fn-go) · [`go-back`](#fn-go-back) · [`go-forward`](#fn-go-forward) · [`greater-or-equal?`](#fn-greater-or-equal-3f) · [`greater?`](#fn-greater-3f)

### H

[`handle?`](#fn-handle-3f) · [`has`](#fn-has) · [`head`](#fn-head) · [`head?`](#fn-head-3f) · [`help`](#fn-help) · [`http-request`](#fn-http-request)

### I

[`if`](#fn-if) · [`import`](#fn-import) · [`in`](#fn-in) · [`index?`](#fn-index-3f) · [`insert`](#fn-insert) · [`integer?`](#fn-integer-3f) · [`intersect`](#fn-intersect) · [`issue?`](#fn-issue-3f)

### J

[`join`](#fn-join)

### L

[`last`](#fn-last) · [`last?`](#fn-last-3f) · [`layout`](#fn-layout) · [`length?`](#fn-length-3f) · [`lesser-or-equal?`](#fn-lesser-or-equal-3f) · [`lesser?`](#fn-lesser-3f) · [`lit-path?`](#fn-lit-path-3f) · [`lit-word?`](#fn-lit-word-3f) · [`load`](#fn-load) · [`load-csv`](#fn-load-csv) · [`load-json`](#fn-load-json) · [`load-local`](#fn-load-local) · [`load-query`](#fn-load-query) · [`load-xml`](#fn-load-xml) · [`loaded-at`](#fn-loaded-at) · [`localize`](#fn-localize) · [`log-10`](#fn-log-10) · [`log-2`](#fn-log-2) · [`log-e`](#fn-log-e) · [`logic?`](#fn-logic-3f) · [`loop`](#fn-loop) · [`lowercase`](#fn-lowercase)

### M

[`make`](#fn-make) · [`map-each`](#fn-map-each) · [`map?`](#fn-map-3f) · [`max`](#fn-max) · [`min`](#fn-min) · [`mod`](#fn-mod) · [`modulo`](#fn-modulo) · [`mold`](#fn-mold) · [`money?`](#fn-money-3f) · [`move`](#fn-move) · [`multiply`](#fn-multiply)

### N

[`native?`](#fn-native-3f) · [`negate`](#fn-negate) · [`negative?`](#fn-negative-3f) · [`next`](#fn-next) · [`none?`](#fn-none-3f) · [`not`](#fn-not) · [`not-equal?`](#fn-not-equal-3f) · [`now`](#fn-now) · [`number?`](#fn-number-3f)

### O

[`object?`](#fn-object-3f) · [`odd?`](#fn-odd-3f) · [`on-close`](#fn-on-close) · [`on-error`](#fn-on-error) · [`on-message`](#fn-on-message) · [`op?`](#fn-op-3f) · [`open`](#fn-open) · [`open-events`](#fn-open-events) · [`open-socket`](#fn-open-socket) · [`or`](#fn-or) · [`or~`](#fn-or-7e)

### P

[`pad`](#fn-pad) · [`pair?`](#fn-pair-3f) · [`paren?`](#fn-paren-3f) · [`parse`](#fn-parse) · [`path?`](#fn-path-3f) · [`percent?`](#fn-percent-3f) · [`pick`](#fn-pick) · [`poke`](#fn-poke) · [`positive?`](#fn-positive-3f) · [`power`](#fn-power) · [`print`](#fn-print) · [`print-page`](#fn-print-page) · [`probe`](#fn-probe) · [`put`](#fn-put)

### Q

[`quote`](#fn-quote)

### R

[`random`](#fn-random) · [`read`](#fn-read) · [`read-clipboard`](#fn-read-clipboard) · [`read-file`](#fn-read-file) · [`reduce`](#fn-reduce) · [`refinement?`](#fn-refinement-3f) · [`reform`](#fn-reform) · [`rejoin`](#fn-rejoin) · [`remainder`](#fn-remainder) · [`remove`](#fn-remove) · [`remove-each`](#fn-remove-each) · [`remove-local`](#fn-remove-local) · [`repeat`](#fn-repeat) · [`replace`](#fn-replace) · [`return`](#fn-return) · [`reverse`](#fn-reverse) · [`reword`](#fn-reword) · [`round`](#fn-round)

### S

[`same?`](#fn-same-3f) · [`save`](#fn-save) · [`save-local`](#fn-save-local) · [`scalar?`](#fn-scalar-3f) · [`second`](#fn-second) · [`select`](#fn-select) · [`send`](#fn-send) · [`series?`](#fn-series-3f) · [`set`](#fn-set) · [`set-language`](#fn-set-language) · [`set-path?`](#fn-set-path-3f) · [`set-values`](#fn-set-values) · [`set-word?`](#fn-set-word-3f) · [`shift`](#fn-shift) · [`shift-left`](#fn-shift-left) · [`shift-logical`](#fn-shift-logical) · [`shift-right`](#fn-shift-right) · [`show-progress`](#fn-show-progress) · [`sign?`](#fn-sign-3f) · [`sine`](#fn-sine) · [`single?`](#fn-single-3f) · [`skip`](#fn-skip) · [`sort`](#fn-sort) · [`source`](#fn-source) · [`spawn`](#fn-spawn) · [`spec-of`](#fn-spec-of) · [`split`](#fn-split) · [`square-root`](#fn-square-root) · [`strict-equal?`](#fn-strict-equal-3f) · [`strict-not-equal?`](#fn-strict-not-equal-3f) · [`string?`](#fn-string-3f) · [`stylize`](#fn-stylize) · [`subtract`](#fn-subtract) · [`suffix?`](#fn-suffix-3f) · [`swap`](#fn-swap) · [`switch`](#fn-switch)

### T

[`tag?`](#fn-tag-3f) · [`tail`](#fn-tail) · [`tail?`](#fn-tail-3f) · [`take`](#fn-take) · [`tangent`](#fn-tangent) · [`theme`](#fn-theme) · [`third`](#fn-third) · [`throw`](#fn-throw) · [`time?`](#fn-time-3f) · [`to`](#fn-to) · [`to-binary`](#fn-to-binary) · [`to-bitset`](#fn-to-bitset) · [`to-block`](#fn-to-block) · [`to-char`](#fn-to-char) · [`to-csv`](#fn-to-csv) · [`to-date`](#fn-to-date) · [`to-decimal`](#fn-to-decimal) · [`to-email`](#fn-to-email) · [`to-file`](#fn-to-file) · [`to-get-path`](#fn-to-get-path) · [`to-get-word`](#fn-to-get-word) · [`to-hex`](#fn-to-hex) · [`to-integer`](#fn-to-integer) · [`to-issue`](#fn-to-issue) · [`to-json`](#fn-to-json) · [`to-lit-path`](#fn-to-lit-path) · [`to-lit-word`](#fn-to-lit-word) · [`to-logic`](#fn-to-logic) · [`to-map`](#fn-to-map) · [`to-money`](#fn-to-money) · [`to-pair`](#fn-to-pair) · [`to-paren`](#fn-to-paren) · [`to-path`](#fn-to-path) · [`to-percent`](#fn-to-percent) · [`to-query`](#fn-to-query) · [`to-refinement`](#fn-to-refinement) · [`to-set-path`](#fn-to-set-path) · [`to-set-word`](#fn-to-set-word) · [`to-string`](#fn-to-string) · [`to-tag`](#fn-to-tag) · [`to-time`](#fn-to-time) · [`to-tuple`](#fn-to-tuple) · [`to-url`](#fn-to-url) · [`to-word`](#fn-to-word) · [`to-xml`](#fn-to-xml) · [`toast`](#fn-toast) · [`tr`](#fn-tr) · [`translated`](#fn-translated) · [`trim`](#fn-trim) · [`try`](#fn-try) · [`tuple?`](#fn-tuple-3f) · [`type?`](#fn-type-3f) · [`typeset?`](#fn-typeset-3f)

### U

[`union`](#fn-union) · [`unique`](#fn-unique) · [`unless`](#fn-unless) · [`unset`](#fn-unset) · [`unset?`](#fn-unset-3f) · [`until`](#fn-until) · [`uppercase`](#fn-uppercase) · [`url?`](#fn-url-3f) · [`use`](#fn-use)

### V

[`validate-face`](#fn-validate-face) · [`value?`](#fn-value-3f) · [`values-of`](#fn-values-of) · [`view`](#fn-view)

### W

[`wait`](#fn-wait) · [`while`](#fn-while) · [`word?`](#fn-word-3f) · [`words-of`](#fn-words-of) · [`write-clipboard`](#fn-write-clipboard) · [`write-line`](#fn-write-line)

### X

[`xor`](#fn-xor) · [`xor~`](#fn-xor-7e)

### Z

[`zero?`](#fn-zero-3f)
