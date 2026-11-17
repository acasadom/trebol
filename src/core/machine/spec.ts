// Machines in Trebol (see machine.ts). The engine, part one: reading the block of a machine into states, one
// level at a time, and finding the words it meant.

export const SPEC = String.raw`
; The engine of machine: states are objects in a block, known by their place
; in it (the root is 1), so a machine holds no loops of references and molds.
machine-engine: make object! [

    words: [data initial state final parallel from no on-enter on-exit on-activity on-save timeout ttl defer run invoke shared]

    ; the events a machine sends itself
    own: [error timeout expired done]

    ; send on a socket, when the host has sockets: send itself is redefined below
    socket: either value? 'send [:send] [none]

    ; where the last mistake was, for trebol check
    failed: none

    fail: function [message [string!] place [block!]] [
        set 'failed place
        e: make error! rejoin ["machine: " message]
        e/near: copy/part place 4
        e/at: loaded-at place
        do e
    ]

    node: function [m id] [pick m/nodes id]

    ; --- did you mean: the word near enough to one that is not known (strat: start) ---

    ; Optimal string alignment distance: letters put in, taken out, changed, or two neighbours swapped.
    distance: function [a [string!] b [string!]] [
        n: length? b
        before: none
        prev: copy []
        repeat j n + 1 [append prev j - 1]
        repeat i length? a [
            row: reduce [i]
            repeat j n [
                d: min min (pick prev j + 1) + 1  (last row) + 1  (pick prev j) + either (pick a i) = (pick b j) [0] [1]
                if all [i > 1  j > 1  (pick a i) = (pick b j - 1)  (pick a i - 1) = (pick b j)] [
                    d: min d (pick before j - 1) + 1
                ]
                append row d
            ]
            before: prev
            prev: row
        ]
        last prev
    ]

    ; The word near enough to w to be what it meant, or none: one letter off up to four letters, two longer;
    ; nothing for one or two letters, which are near too many.
    nearest: function [w words [block!]] [
        t: form w
        if 3 > length? t [return none]
        most: either 4 < length? t [2] [1]
        best: none
        foreach c words [
            d: distance t form c
            if all [d > 0  d <= most] [best: c  most: d - 1]
        ]
        best
    ]

    ; "; did you mean start?" when one of the words is near enough; "" otherwise.
    suggest: function [w words [block!]] [
        either best: nearest w words [rejoin ["; did you mean " best "?"]] [""]
    ]

    state-names: function [m] [collect [foreach n next m/nodes [keep n/name]]]

    data-fields: function [m] [collect [foreach v any [m/data-spec []] [if set-word? :v [keep to word! v]]]]

    add-node: function [m name parent] [
        n: make object! [
            id: name: parent: initial: enter: exit: activity: outcome: place: timeout: run: invoke: with: for: in: none
            children: copy []  transitions: copy []  defer: copy []  history: true  final: false  parallel: false
        ]
        append m/nodes n
        n/id: length? m/nodes  n/name: name  n/parent: parent
        n
    ]

    child: function [m id name] [
        foreach c (select node m id 'children) [if name = select node m c 'name [return c]]
        none
    ]

    ; A target: a name or a path, looked up from the scope, then from each level above.
    find-state: function [m scope name] [
        names: either path? name [to block! name] [reduce [name]]
        while [scope] [
            id: scope
            foreach w names [unless id: child m id w [break]]
            if id [return id]
            scope: select node m scope 'parent
        ]
        none
    ]

    ; A hook, guard or set block of the spec: bound to the machine's data and event.
    code: function [m spec what] [
        b: second spec
        unless block? :b [fail rejoin [what " takes a block"] spec]
        bind b m/scope
        append/only m/code spec
        b
    ]

    ; Reads the words of one level (the machine or a state) into node n.
    level: function [m n spec] [
        froms: copy []
        while [not tail? spec] [
            here: spec
            w: first spec
            unless word? :w [fail rejoin [mold :w " is not a word of machine"] here]
            spec: next spec
            switch/default w [
                data [
                    if n/id <> 1 [fail "data goes at the top of the machine" here]
                    unless block? first spec [fail "data takes a block" here]
                    m/data-spec: first spec
                    spec: next spec
                ]
                initial [
                    unless word? first spec [fail "initial takes the name of a state" here]
                    n/initial: here
                    spec: next spec
                ]
                state final parallel [
                    name: first spec
                    unless word? :name [fail rejoin [w " takes a name"] here]
                    if child m n/id name [fail rejoin ["two states called " name] here]
                    c: add-node m name n/id
                    c/place: here
                    append n/children c/id
                    spec: next spec
                    c/parallel: w = 'parallel
                    if w = 'final [
                        c/final: true
                        if all [word? first spec  not find words first spec] [
                            c/outcome: first spec
                            spec: next spec
                        ]
                    ]
                    if block? first spec [
                        level m c first spec
                        spec: next spec
                    ]
                    if all [c/final  not empty? c/children] [fail rejoin ["final " name " has states inside"] here]
                    if c/parallel [
                        if 2 > length? c/children [fail rejoin ["parallel " name " needs two states or more"] here]
                        foreach k c/children [
                            if select node m k 'final [fail rejoin ["parallel " name " holds states, not final ones"] here]
                        ]
                    ]
                ]
                shared [
                    if n/id <> 1 [fail "shared goes at the top of the machine" here]
                    unless word? first spec [fail "shared takes a name, the same in every tab" here]
                    m/shared: first spec
                    spec: next spec
                ]
                on-save [
                    if n/id <> 1 [fail "on-save goes at the top of the machine" here]
                    b: code m here w
                    ; snapshot, inside it, is the machine as it is after the event
                    m/saver: make object! [snapshot: none]
                    bind b m/saver
                    m/on-save: b
                    spec: next spec
                ]
                on-enter on-exit on-activity [
                    if n/id = 1 [fail rejoin [w " goes inside a state"] here]
                    b: code m here w
                    switch w [on-enter [n/enter: b] on-exit [n/exit: b] on-activity [n/activity: b]]
                    spec: next spec
                ]
                timeout [
                    if n/id = 1 [fail "timeout goes inside a state; the whole machine takes ttl" here]
                    if n/final [fail "a final state takes no timeout" here]
                    v: first spec
                    unless any [number? :v  time? :v  all [path? :v  'data = first v  2 = length? v]] [
                        fail "timeout takes seconds, a time or data/field" here
                    ]
                    n/timeout: v
                    spec: next spec
                ]
                run invoke [
                    if n/id = 1 [fail rejoin [w " goes inside a state"] here]
                    if n/final [fail rejoin ["a final state takes no " w] here]
                    if any [n/run n/invoke] [fail "a state runs one thing: one run or one invoke" here]
                    either w = 'run [
                        n/run: code m here 'run
                        spec: next spec
                    ] [
                        v: first spec
                        unless any [block? :v  word? :v  path? :v] [fail "invoke takes the block of a machine, or a word for one" here]
                        ; a machine written here is made now, so its mistakes show at once
                        if block? v [inner: make-machine v]
                        n/invoke: v
                        spec: next spec
                        ; one machine for each item of a block of the data
                        if 'for = first spec [
                            unless all [word? second spec  'in = third spec] [
                                fail "invoke ... for takes a word, in and data/field" spec
                            ]
                            v: fourth spec
                            unless all [path? :v  'data = first v  2 = length? v] [
                                fail "invoke ... for item in takes data/field" spec
                            ]
                            n/for: second spec
                            n/in: v
                            spec: skip spec 4
                        ]
                        if 'with = first spec [
                            n/with: code m spec 'with
                            if block? v [
                                fields: collect [foreach x any [inner/data-spec []] [if set-word? :x [keep to word! x]]]
                                foreach x n/with [
                                    if all [set-word? :x  not find fields to word! x] [
                                        fail rejoin ["the machine invoked in " n/name " has no data " to word! x suggest to word! x fields] spec
                                    ]
                                ]
                            ]
                            spec: skip spec 2
                        ]
                    ]
                ]
                ttl [
                    if n/id <> 1 [fail "ttl goes at the top of the machine" here]
                    v: first spec
                    unless any [number? :v  time? :v] [fail "ttl takes seconds or a time" here]
                    m/ttl: v
                    spec: next spec
                ]
                defer [
                    e: first spec
                    names: case [
                        word? :e [reduce [e]]
                        all [block? :e  not empty? e  parse e [some word!]] [e]
                        true [fail "defer takes the name of an event or a block of them" here]
                    ]
                    foreach w names [
                        if find own w [fail rejoin [w " is the machine's own event; it cannot wait"] here]
                    ]
                    append n/defer names
                    spec: next spec
                ]
                no [
                    unless 'history = first spec [fail "no takes history" here]
                    n/history: false
                    spec: next spec
                ]
                from [spec: transition m n here]
            ] [
                fail rejoin [w " is not a word of machine" suggest w words] here
            ]
        ]
        if all [n/parallel  n/initial] [fail rejoin ["parallel " n/name " has no initial: all its states start at once"] n/initial]
        if all [not empty? n/children  none? n/initial  not n/parallel] [
            fail either n/id = 1 ["the machine has no initial state"] [rejoin ["state " n/name " has no initial"]]
                any [n/place spec]
        ]
        if n/initial [
            place: n/initial
            unless n/initial: child m n/id second place [
                fail rejoin ["no state " second place " here" suggest second place state-names m] place
            ]
        ]
    ]

`;
