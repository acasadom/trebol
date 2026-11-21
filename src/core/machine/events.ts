// Machines in Trebol (see machine.ts). The engine, part four: run and invoke, events and how a transition moves
// the machine, one step at a time.

export const EVENTS = String.raw`
    ; --- run and invoke: work of a state (key -id), its end sent back as done or error ---

    work: function [m id] [
        n: node m id
        case [
            n/run [
                s: serial m
                put m/timers negate id reduce [s spawn compose/only [machine-engine/worked (m) (id) (s) (n/run)]]
            ]
            n/invoke [
                spec: n/invoke
                unless block? spec [spec: get spec]
                unless block? :spec [
                    do make error! rejoin ["machine: invoke in " n/name " takes the block of a machine: " mold :spec]
                ]
                s: serial m
                either n/for [
                    items: get in m/data second n/in
                    unless block? :items [
                        do make error! rejoin ["machine: invoke in " n/name " goes over a block: data/" second n/in " is " mold :items]
                    ]
                    ; [serial children outcomes data left]: the outcomes and data in the order of the items
                    x: reduce [s copy []  array length? items  array length? items  length? items]
                    put m/timers negate id x
                    either empty? items [
                        post-event m 'done make object! [outcomes: copy []  data: copy []] negate id s
                    ] [
                        repeat i length? items [
                            ; the word of for, seen only by with
                            it: make object! reduce [to set-word! n/for none]
                            set in it n/for pick items i
                            c: invoked m n spec all [n/with  bind copy/deep n/with it]
                            c/caller: reduce [m id s i]
                            append second x c
                        ]
                        foreach c second x [start c]
                    ]
                ] [
                    c: invoked m n spec n/with
                    c/caller: reduce [m id s]
                    put m/timers negate id reduce [s c]
                    start c
                ]
            ]
        ]
    ]

    ; A machine made for invoke, its data seeded by with.
    invoked: function [m n spec with] [
        c: make-machine spec
        if c/shared [do make error! rejoin ["machine: the machine invoked in " n/name " cannot be shared"]]
        fresh c
        if with [
            foreach [f v] values m reduce [with] [
                unless in c/data f [do make error! rejoin ["machine: the machine invoked in " n/name " has no data " f suggest f words-of c/data]]
                set in c/data f :v
            ]
        ]
        c
    ]

    ; The task of a run: the value it gives comes back as done, a failure as error.
    worked: function [m id s b] [
        r: try b
        x: select m/timers negate id
        if all [x  s = first x] [poke x 2 none]
        either error? :r [
            post-event m 'error r negate id s
        ] [
            post-event m 'done make object! [value: :r] negate id s
        ]
    ]

    ; A machine invoked that is done tells the one that invoked it.
    returned: function [c] [
        if all [c/done  x: c/caller] [
            c/caller: none
            ev: make object! [outcome: c/outcome  data: c/data]
            if fourth x [ev: make ev [item: fourth x]]
            post-event first x 'done ev negate second x third x
        ]
    ]

    serial: function [m] [m/serial: m/serial + 1]

    arm-ttl: function [m] [
        if m/ttl [
            disarm m 0
            clock m 0 m/ttl 'expired
        ]
    ]

    stop: function [m] [
        foreach [key x] m/timers [if x [drop second x]]
        m/timers: make map! []
        clear m/deferred
    ]

    post: function [m name key serial] [post-event m name make object! [] key serial]

    post-event: function [m name ev key serial] [
        append/only m/queue reduce [name ev key serial]
        unless m/busy [run m]
    ]

    ; A timer that went off: its timeout is taken from its own state, or from one around it.
    ring: function [m name key serial] [
        x: select m/timers key
        unless all [x  serial = first x] [exit]
        ; a machine of a fan-out that ends: the state is done when all of them are
        if all [name = 'done  block? second x  in e: m/scope/event 'item] [
            poke third x e/item e/outcome
            poke fourth x e/item e/data
            poke x 5 (pick x 5) - 1
            if 0 < pick x 5 [exit]
            m/scope/event: make object! [outcomes: third x  data: fourth x]
        ]
        put m/timers key none
        case [
            name = 'timeout [
                if t: find-from m key 'timeout true none [go m t]
            ]
            name = 'expired [
                unless deliver m 'expired [
                    m/outcome: 'expired
                    m/done: true
                    stop m
                    exit
                ]
            ]
            name = 'done [
                if t: find-from m negate key 'done true none [go m t]
            ]
            name = 'error [
                ; routed as a failure of the state that ran it
                m/active: negate key
                do m/scope/event
            ]
        ]
        drain m
    ]

    ; An event goes to every innermost state: each takes its own way out, looking no further
    ; out than its parallel; when none does, the states around the parallels may.
    deliver: function [m name] [
        taken: false
        foreach id leaves m [
            if on? m id [
                if t: find-from m id name true region-of m id [go m t  taken: true]
            ]
        ]
        if taken [return true]
        foreach id leaves m [
            if t: find-from m id name true none [go m t  return true]
        ]
        false
    ]

    ; The first event held by defer that the machine can take now.
    redeliver: function [m] [
        pos: m/deferred
        while [not tail? pos] [
            e: first pos
            m/scope/event: second e
            if deliver m first e [
                remove pos
                return true
            ]
            pos: next pos
        ]
        false
    ]

    deferring?: function [m name] [
        foreach id head insert copy m/on 1 [if find select node m id 'defer name [return true]]
        false
    ]

    remember: function [m id] [
        if p: select node m id 'parent [put m/history p id]
    ]

    ; Enters the states of path, the first one down to the last, and then what is inside the
    ; last: its history or initial state, or every state of a parallel.
    enter-down: function [m path] [
        id: first path
        rest: next path
        enter m id
        remember m id
        n: node m id
        case [
            n/parallel [
                foreach c n/children [
                    put m/results c none
                    enter-down m either all [not tail? rest  c = first rest] [rest] [reduce [c]]
                ]
            ]
            not tail? rest [enter-down m rest]
            not empty? n/children [
                unless n/history [put m/history id none]
                enter-down m reduce [any [select m/history id  n/initial]]
            ]
        ]
    ]

    ; Leaves every state on inside state id, innermost first.
    exit-below: function [m id] [
        foreach c reverse copy select node m id 'children [
            if on? m c [
                exit-below m c
                leave m c
                remember m c
            ]
        ]
    ]

    ; Every right side of a set, worked out before any state is left.
    values: function [m sets] [
        out: copy []
        foreach b sets [
            pos: b
            while [not tail? pos] [
                unless set-word? first pos [fail "set takes field: value pairs" pos]
                f: to word! first pos
                v: do/next next pos 'pos
                append out reduce [f :v]
            ]
        ]
        out
    ]

    ; The states left and entered are those below the one the source and the target share;
    ; a parallel is never that one, so going between its states leaves it and enters it again.
    go: function [m t] [
        r: m/taken
        dest: first r
        sets: copy []
        if t/set [append/only sets t/set]
        if second r [append/only sets second r]
        vals: values m sets
        pivot: lca m t/source dest
        while [select node m pivot 'parallel] [pivot: select node m pivot 'parent]
        exit-below m pivot
        m/active: pivot
        foreach [f v] vals [set in m/data f :v]
        path: next chain m pivot dest
        unless empty? path [enter-down m path]
    ]

    ; A state with nowhere to go ends: a leaf gives its outcome, a state of a parallel how it ended.
    sink: function [m id] [
        n: node m id
        if empty? n/children [
            m/last: any [n/outcome n/name]
            if all [n/outcome  none? m/outcome  none? region-of m id] [m/outcome: n/outcome]
        ]
        leave m id
        case [
            n/parent = 1 [
                m/on: reduce [id]
                m/done: true
                stop m
            ]
            select node m n/parent 'parallel [put m/results id m/last]
            true [put m/history n/parent none]
        ]
    ]

    ; One move with no event, if there is one: a way out with no event, or a state that ends.
    settle: function [m] [
        foreach id leaves m [
            if on? m id [
                if t: find-from m id none false none [go m t  return true]
                unless find-from m id true false none [sink m id  return true]
            ]
        ]
        foreach id copy m/on [
            if all [select node m id 'parallel  t: find-from m id none false none] [go m t  return true]
        ]
        false
    ]

    drain: function [m] [
        while [not m/done] [
            unless any [settle m  redeliver m] [exit]
        ]
    ]

    begin: function [m] [
        ; start-later shows the initial states before their hooks run: they are entered here
        clear m/on
        arm-ttl m
        enter-down m reduce [select node m 1 'initial]
        drain m
    ]

    ; An event from send: one that no transition takes waits if a defer holds it.
    event: function [m name] [
        unless deliver m name [
            either deferring? m name [
                append/only m/deferred reduce [name m/scope/event]
            ] [
                foreach id leaves m [hook m id 'activity]
            ]
        ]
        drain m
        unless m/done [arm-ttl m]
    ]

    ; One step, the start, an event or a timer; a failure on the way in routes to on error.
    step: function [m e] [
        name: first e
        m/scope/event: second e
        r: try [
            case [
                none? name [begin m]
                third e [ring m name third e fourth e]
                true [event m name]
            ]
            none
        ]
        if error? :r [
            if m/exiting [m/exiting: false  do r]
            m/error: r
            m/scope/event: r
            unless t: find-from m m/active 'error true none [do r]
            go m t
            drain m
        ]
    ]

    ; A word or a path for one state on; a block of paths when there are several.
    where: function [m] [
        out: collect [
            foreach leaf leaves m [
                names: collect [foreach id next chain m 1 leaf [keep select node m id 'name]]
                keep either 1 = length? names [first names] [to path! names]
            ]
        ]
        case [
            empty? out [none]
            1 = length? out [first out]
            true [out]
        ]
    ]

    run: function [m] [
        m/busy: true
        r: try [
            while [not empty? m/queue] [
                e: take m/queue
                unless m/done [step m e]
            ]
            none
        ]
        m/busy: false
        m/state: where m
        if error? :r [clear m/queue  do r]
        saved m
        returned m
        m
    ]

`;
