// Machines in Trebol (see machine.ts). The engine, part one and a half: fragments, pieces of machine written
// once with blanks, used in states of machines with the blanks filled.

export const FRAGMENTS = String.raw`
    ; --- fragments: use name [with [blank: value ...]] puts a fragment's words where it stands ---

    ; Whether a value is a type a blank of a fragment takes; a blank with no types takes any value.
    takes?: function [types v] [
        unless types [return true]
        foreach t types [
            d: get t
            if either datatype? d [d = type? :v] [find d type? :v] [return true]
        ]
        false
    ]

    ; The words of a fragment used at here (use name [with [...]]), its blanks filled: a copy, so each use is
    ; its own. A blank is a word of the body; set-words, lit-words and paths are left as they are.
    use-fragment: function [m here] [
        r: second here
        f: case [
            word? :r [get/any r]
            path? :r [do r]
            true [fail "use takes the name of a fragment" here]
        ]
        unless fragment? :f [fail rejoin [mold r " is not a fragment"] here]
        if find m/using f [fail rejoin ["fragment " mold r " uses itself"] here]
        keys: copy []  vals: copy []
        if 'with = third here [
            given: fourth here
            unless block? :given [fail "use ... with takes a block of blank: value" here]
            names: collect [foreach [w t] f/params [keep w]]
            while [not tail? given] [
                w: first given
                unless set-word? :w [fail rejoin ["use ... with takes blank: value, not " mold :w] given]
                w: to word! w
                unless types: find names w [
                    fail rejoin ["fragment " mold r " has no blank " w suggest w names] given
                ]
                types: select f/params w
                if tail? next given [fail rejoin ["use ... with gives " w " no value"] given]
                v: second given
                unless takes? types :v [
                    fail rejoin [w " of fragment " mold r " takes " mold types ", not " mold type? :v] given
                ]
                if find keys w [fail rejoin ["use ... with gives " w " twice"] given]
                append keys w
                append/only vals :v
                given: skip given 2
            ]
        ]
        foreach [w t] f/params [
            unless find keys w [fail rejoin ["use " mold r " needs " w] here]
        ]
        append m/using f
        fill copy/deep f/body keys vals
    ]

    ; Puts the value of each blank where its word stands in b, deep; gives b.
    fill: function [b [block! paren!] keys [block!] vals [block!]] [
        p: b
        while [not tail? p] [
            v: first p
            case [
                all [word? :v  x: find keys v] [
                    v: pick vals index? x
                    change/only p either any-block? :v [copy/deep v] [:v]
                ]
                any [block? :v  paren? :v] [fill v keys vals]
            ]
            p: next p
        ]
        b
    ]

`;
