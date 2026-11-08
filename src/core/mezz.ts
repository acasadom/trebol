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

; Rebol 3 calls context? bound?.
bound?: :context?

context: func ["Makes an object." spec [block!]] [make object! spec]

function: func [
    "A function whose set-words in the body are local."
    spec [block!] body [block!] /local words
][
    words: collect-words/deep/set/ignore body spec
    spec: copy spec
    unless any [empty? words find spec /local] [append spec /local]
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
    set bind/new to word! append copy/part form type (length? form type) - 1 "?" 'type? func [value [any-type!]] compose [
        find (make typeset! reduce [get type]) type? :value
    ]
]

; Converters: to-integer to-string ... for every datatype that to makes.
foreach type [
    logic! integer! decimal! percent! money! char! pair! tuple! date! time!
    string! file! email! url! tag! binary! bitset! word! set-word! get-word! lit-word!
    refinement! issue! block! paren! path! set-path! get-path! lit-path! map!
] [
    set bind/new to word! append copy "to-" copy/part form type (length? form type) - 1 'type? func [value] compose [
        to (get type) :value
    ]
]

; Characters with a name, as in Rebol 3.
space: sp: #" "
tab: #"^-"
newline: lf: #"^/"
cr: #"^M"
crlf: "^M^/"
escape: #"^["
comma: #","
dot: #"."
slash: #"/"
backslash: #"\"
dbl-quote: #"^""

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

reword: function [
    "Makes a copy of a template with each keyword, marked by an escape ($ by default), replaced by its value."
    source [any-string!]
    values [block! map! object!] "Keywords and their values; a function value is called with the keyword"
    /case "Keywords are case-sensitive"
    /only "Uses the values of a block as they are, without reducing it"
    /escape "Marks keywords another way"
    char [char! any-string! block! none!] "A prefix, a [prefix suffix] block, or none for no mark"
] [
    prefix: "$"
    suffix: none
    if escape [either block? char [set [prefix suffix] char] [prefix: char]]
    if char? prefix [prefix: to string! prefix]
    if char? suffix [suffix: to string! suffix]
    keys: make block! 0
    either all [block? values not only] [
        while [not tail? values] [
            key: form first values
            value: do/next next values 'values
            append/only keys reduce [key :value]
        ]
    ] [
        foreach [key value] to block! values [append/only keys reduce [form key :value]]
    ]
    out: copy/part source 0
    pos: source
    while [not tail? pos] [
        mark: either prefix [find pos prefix] [pos]
        unless mark [append out pos break]
        append out copy/part pos mark
        after: either prefix [skip mark length? prefix] [mark]
        hit: none
        foreach entry keys [
            rest: either case [find/match/case after entry/1] [find/match after entry/1]
            if all [rest suffix] [
                rest: either case [find/match/case rest suffix] [find/match rest suffix]
            ]
            if all [rest any [none? hit (length? entry/1) > length? hit/1]] [hit: entry stop: rest]
        ]
        either hit [
            value: second hit
            append out either any-function? :value [value first hit] [:value]
            pos: stop
        ] [
            append out first mark
            pos: next mark
        ]
    ]
    out
]

pad: func [
    "Pads a string with spaces on the right (with /left, on the left) up to a length. Modifies it."
    str [string!] n [integer!]
    /left "Pads on the left, which aligns to the right"
    /with "Pads with another character" c [char!]
] [
    c: any [c #" "]
    loop n - length? str [either left [insert str c] [append str c]]
    str
]

take: function [
    "Removes the value at the head of a series and returns it; none if there is none."
    series [series! none!]
    /part "Takes that many values, as a series of the same type" length [integer!]
    /last "Takes from the tail instead"
    /deep "Copies the series inside what is taken"
] [
    if none? series [return none]
    n: either part [max 0 length] [1]
    if last [series: skip tail series negate n]
    either part [
        out: copy/part series n
        remove/part series n
        either deep [copy/deep out] [out]
    ] [
        if tail? series [return none]
        v: first series
        remove series
        either all [deep series? :v] [copy/deep v] [:v]
    ]
]

also: func ["Returns the first value, after evaluating the second." a [any-type!] b [any-type!]] [:a]
`;
