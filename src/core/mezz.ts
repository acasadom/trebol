// Mezzanines: the part of lib written in Trebol itself. Evaluated into lib
// at startup by `makeRuntime`. Anything that can live here instead of in a
// TS native should, since it carries over unchanged to another core.

export const MEZZANINES = String.raw`
func: make function! [[
    "Makes a function from a spec and a body."
    spec [block!] body [block!]
][
    make function! reduce [spec body]
]]

does: func ["A function with no arguments." body [block!]] [
    make function! reduce [[] body]
]

has: func ["A function with only local words." locals [block!] body [block!]] [
    make function! reduce [append copy [/local] locals body]
]

; Each call already gets its own frame, so closures and functions are the same.
closure: :func

context: func ["Makes an object." spec [block!]] [make object! spec]

function: func [
    "A function whose set-words in the body are local."
    spec [block!] body [block!] /local words
][
    words: collect-words/deep/set/ignore body spec
    spec: copy spec
    unless find spec /local [append spec /local]
    make function! reduce [append spec words body]
]

; Type predicates: integer? string? series? ... for every datatype and typeset.
foreach type [
    unset! none! logic! integer! decimal! percent! money! char! pair! tuple! date! time!
    string! file! email! url! tag! binary! bitset! word! set-word! get-word! lit-word!
    refinement! issue! block! paren! path! set-path! get-path! lit-path! map! object!
    error! function! native! op! datatype! typeset! handle!
    any-type! any-value! number! scalar! any-string! series! any-word! any-block!
    any-path! any-object! any-function!
] [
    name: form type
    set bind/new to word! append copy/part name (length? name) - 1 "?" 'type? func [value [any-type!]] compose [
        find (make typeset! reduce [get type]) type? :value
    ]
]

first: func [series] [pick series 1]
second: func [series] [pick series 2]
third: func [series] [pick series 3]
fourth: func [series] [pick series 4]
fifth: func [series] [pick series 5]
last: func [series [series!]] [pick back tail series 1]

empty?: func [series [series! map!]] [zero? length? series]

rejoin: func [
    "Reduces a block and joins the values into one series, of the type of the first."
    block [block!] /local result
][
    block: reduce block
    if empty? block [return copy ""]
    result: either series? first block [copy first block] [form first block]
    foreach value next block [append result :value]
    result
]

join: func [
    "Joins a value with another value, or with a reduced block."
    value rest
][
    value: either series? :value [copy value] [form :value]
    append value either block? :rest [reduce rest] [:rest]
]

collect: func [
    "Evaluates a block where keep adds values to a new block, and returns it."
    body [block!] /local out run
][
    out: make block! 0
    run: func [keep] body
    run func [value [any-value!] /only] [
        either only [append/only out :value] [append out :value]
        :value
    ]
    out
]

replace: function [
    "Replaces the first (or with /all every) occurrence of a pattern in a series."
    target [series!] pattern value /all
] [
    len: either series? :pattern [length? pattern] [1]
    pos: target
    while [pos: find pos :pattern] [
        pos: change/part pos :value len
        unless all [break]
    ]
    target
]

also: func ["Returns the first value, after evaluating the second." a [any-type!] b [any-type!]] [:a]
`;
