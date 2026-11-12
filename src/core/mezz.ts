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
    set bind/new to word! append copy/part form type (length? form type) - 1 "?" 'type? func compose [(append copy "True if the value is " form type) value [any-type!]] compose [
        find (make typeset! reduce [get type]) type? :value
    ]
]

; Converters: to-integer to-string ... for every datatype that to makes.
foreach type [
    logic! integer! decimal! percent! money! char! pair! tuple! date! time!
    string! file! email! url! tag! binary! bitset! word! set-word! get-word! lit-word!
    refinement! issue! block! paren! path! set-path! get-path! lit-path! map!
] [
    set bind/new to word! append copy "to-" copy/part form type (length? form type) - 1 'type? func compose [(append copy "Converts a value to " form type) value] compose [
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

first: func ["The first value of a series." series] [pick series 1]
second: func ["The second value of a series." series] [pick series 2]
third: func ["The third value of a series." series] [pick series 3]
fourth: func ["The fourth value of a series." series] [pick series 4]
fifth: func ["The fifth value of a series." series] [pick series 5]
last: func ["The last value of a series." series [series!]] [pick back tail series 1]

empty?: func ["True if the series has nothing from its position on, or the map nothing at all." series [series! map!]] [zero? length? series]

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

pi: 3.141592653589793

as-pair: func ["Makes a pair of two numbers: as-pair 3 4 is 3x4." x [number!] y [number!]] [make pair! reduce [x y]]

ajoin: func ["Reduces a block and joins the values into a string, with no spaces." block [block!]] [
    to string! reduce block
]

reform: func ["Reduces a block and forms it: the values with spaces between. Any other value is formed." value] [
    form reduce :value
]

comment: func ["Ignores its argument." value [any-type!]] []

forever: func ["Evaluates a block again and again, until break or return." body [block!]] [
    while [true] body
]

default: func [
    "Sets a word to a value if it has none yet; gives the word's value."
    'word [word! set-word!] value
][
    unless all [value? word  not none? get word] [set word :value]
    get word
]

last?: func ["True if the series has one value left." series [series!]] [1 = length? series]
single?: :last?

extract: function [
    "Takes every so many values of a series: the first of each record."
    series [series!] width [integer!] "Size of each record"
    /index "Take this position of each record instead" pos [integer!]
][
    out: copy/part series 0
    i: any [pos 1]
    while [i <= length? series] [
        append/only out pick series i
        i: i + width
    ]
    out
]

alter: func [
    "Removes the value if the series has it, adds it if not; true if it was added."
    series [series!] value
][
    either find/only series :value [remove find/only series :value  false] [append/only series :value  true]
]

swap: func [
    "Swaps the first values of two series; gives the first series."
    a [series!] b [series!] /local x
][
    unless any [tail? a tail? b] [
        x: first a
        poke a 1 first b
        poke b 1 :x
    ]
    a
]

move: func [
    "Moves a value, or a span of values, within a series; gives the series after it."
    source [series!] "Changed"
    offset [integer!] "How far to move it, or with /to where to"
    /part "Move this many values" length [integer!]
    /skip "The series is records of this size" size [integer!]
    /to "Offset is a position from the head"
    /local taken
][
    unless length [length: 1]
    if skip [
        if size < 1 [cause-error 'script 'out-of-range ["size must be at least 1"]]
        offset: either to [offset - 1 * size + 1] [offset * size]
        length: length * size
    ]
    taken: take/part source length
    insert either to [at head source offset] [at source either offset < 0 [offset] [offset + 1]] taken
]

array: function [
    "Makes a block of the size given, or of blocks for a block of sizes."
    size [integer! block!]
    /initial "Fill it with this; a series is copied, a function called" value
][
    rest: none
    if block? size [
        rest: next size
        if tail? rest [rest: none]
        size: first size
    ]
    out: copy []
    loop size [
        append/only out case [
            rest [either initial [array/initial rest :value] [array rest]]
            series? :value [copy/deep value]
            any-function? :value [value]
            true [:value]
        ]
    ]
    out
]

mod: func [
    "The remainder of a divided by b, with the sign of b."
    a [number! money! time!] b [number! money! time!] "Must not be zero"
    /local r
][
    r: a // b
    either all [not zero? r  (negative? r) <> negative? b] [r + b] [r]
]

modulo: func [
    "Like mod, but a remainder too small to tell from b or zero is zero."
    a [number! money! time!] b [number! money! time!] "Must not be zero"
    /local r
][
    r: mod a b
    either any [
        all [decimal? r  (abs r) < (1e-13 * abs b)]
        all [decimal? r  (abs r - b) < (1e-13 * abs b)]
    ] [0.0] [r]
]

suffix?: func [
    "The suffix of a file name or URL, as %.txt; none when it has none."
    path [file! url! string!]
    /local end
][
    either all [url? path  end: any [find path #"?" find path #"#"]] [
        all [
            path: find/reverse end #"."
            not find/part path #"/" end
            to file! copy/part path end
        ]
    ] [
        all [
            path: find/last path #"."
            not find path #"/"
            to file! path
        ]
    ]
]
`;
