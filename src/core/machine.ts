// Machines: statecharts written as a dialect, `machine [...]`, and the engine
// that runs them, all in Trebol. Evaluated into lib after the mezzanines by
// `makeRuntime`, so every program has them, with or without a UI.
//
// The semantics follow UML statecharts: a transition leaves the states up to
// the one the source and the target share, innermost first, and enters down
// to the target, outermost first; each level runs only its own hooks.

export const MACHINE = String.raw`
; The engine of machine: states are objects in a block, known by their place
; in it (the root is 1), so a machine holds no loops of references and molds.
machine-engine: make object! [

    words: [data initial state final from no on-enter on-exit on-activity timeout ttl defer]

    ; the events a machine sends itself
    own: [error timeout expired]

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

    add-node: function [m name parent] [
        n: make object! [
            id: name: parent: initial: enter: exit: activity: outcome: place: timeout: none
            children: copy []  transitions: copy []  defer: copy []  history: true  final: false
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
                state final [
                    name: first spec
                    unless word? :name [fail rejoin [w " takes a name"] here]
                    if child m n/id name [fail rejoin ["two states called " name] here]
                    c: add-node m name n/id
                    c/place: here
                    append n/children c/id
                    spec: next spec
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
                fail rejoin [w " is not a word of machine"] here
            ]
        ]
        if all [not empty? n/children  none? n/initial] [
            fail either n/id = 1 ["the machine has no initial state"] [rejoin ["state " n/name " has no initial"]]
                any [n/place spec]
        ]
        if n/initial [
            place: n/initial
            unless n/initial: child m n/id second place [
                fail rejoin ["no state " second place " here"] place
            ]
        ]
    ]

    ; from a to b [on e | on [e f] | on error] [where [...]] [set [...]]
    ; from a choose [on e] [when [...] to b [set [...]] ... else to c [set [...]]]
    ; from a select [...] [on e] [value to b [set [...]] ... else to c [set [...]]]
    transition: function [m n here] [
        t: make object! [
            source: target: events: guard: set: choices: other: other-set: select: place: none
        ]
        t/place: here
        spec: next here
        unless any [word? first spec] [fail "from takes the name of a state" here]
        t/source: first spec
        spec: next spec
        switch/default first spec [
            to [
                t/target: second spec
                unless any [word? :t/target path? :t/target] [fail "to takes the name of a state" spec]
                spec: skip spec 2
            ]
            choose [t/choices: copy []  spec: next spec]
            select [
                t/select: code m spec 'select
                t/choices: copy []
                spec: skip spec 2
            ]
        ] [fail "from takes to, choose or select after the name of a state" here]
        if 'on = first spec [
            e: second spec
            case [
                word? :e [t/events: reduce [e]]
                all [block? :e  not empty? e  parse e [some word!]] [t/events: e]
                true [fail "on takes the name of an event or a block of them" spec]
            ]
            spec: skip spec 2
        ]
        what: either t/select ['select] ['choose]
        if t/choices [
            unless block? first spec [
                fail either t/select ["select takes a block of value to a state"] ["choose takes a block of when ... to"] here
            ]
            branches: first spec
            spec: next spec
            while [not tail? branches] [
                at: branches
                guard: none
                case [
                    'else = first branches [branches: next branches]
                    t/select [
                        guard: reduce [first branches]
                        foreach c t/choices [
                            if guard/1 = first c/1 [fail rejoin ["select has two branches for " mold guard/1] at]
                        ]
                        branches: next branches
                    ]
                    true [
                        unless 'when = first branches [fail "choose takes when [...] to a state, or else to a state" at]
                        guard: code m branches 'when
                        branches: skip branches 2
                    ]
                ]
                unless 'to = first branches [fail rejoin ["a branch of " what " takes to and a state"] at]
                target: second branches
                unless any [word? :target path? :target] [fail "to takes the name of a state" branches]
                branches: skip branches 2
                sets: none
                if 'set = first branches [
                    sets: code m branches 'set
                    branches: skip branches 2
                ]
                either guard [
                    append/only t/choices reduce [guard target sets]
                ] [
                    if t/other [fail rejoin [what " has two else"] at]
                    t/other: target  t/other-set: sets
                ]
            ]
        ]
        if 'where = first spec [
            unless t/events [fail "where goes after on; a transition with no event that may wait for a condition is a choose" spec]
            t/guard: code m spec 'where
            spec: skip spec 2
        ]
        if 'set = first spec [
            t/set: code m spec 'set
            spec: skip spec 2
        ]
        append n/transitions t
        spec
    ]

    resolve: function [m n t] [
        unless id: child m n/id t/source [fail rejoin ["no state " t/source " here"] t/place]
        t/source: id
        if t/target [t/target: target m n t/target t/place]
        if t/choices [
            foreach c t/choices [poke c 2 target m n second c t/place]
            if t/other [t/other: target m n t/other t/place]
        ]
        if t/events [
            if all [find t/events 'timeout  not timed? m id] [
                fail rejoin ["on timeout leaves " second t/place ", which has no timeout"] t/place
            ]
            if find t/events 'expired [
                unless m/ttl [fail "on expired needs ttl at the top of the machine" t/place]
                unless all [t/target  select node m t/target 'final] [
                    fail "on expired goes to a final state" t/place
                ]
            ]
        ]
        if all [none? t/events  none? t/choices] [
            foreach o n/transitions [
                if all [o <> t  o/source = id  none? o/events  none? o/choices] [
                    fail rejoin ["two transitions with no event leave " second t/place] t/place
                ]
            ]
        ]
    ]

    ; Whether a state or one inside it has a timeout.
    timed?: function [m id] [
        n: node m id
        if n/timeout [return true]
        foreach c n/children [if timed? m c [return true]]
        false
    ]

    ; Every timeout is taken by a transition on timeout from its state or one around it.
    check-timeouts: function [m] [
        foreach n m/nodes [
            if n/timeout [
                up: chain m 1 n/id
                taken: false
                foreach o m/nodes [
                    foreach t o/transitions [
                        if all [t/events  find t/events 'timeout  find up t/source] [taken: true]
                    ]
                ]
                unless taken [fail rejoin ["state " n/name " has a timeout and no transition on timeout"] n/place]
            ]
        ]
    ]

    target: function [m n name place] [
        any [find-state m n/id name  fail rejoin ["no state " mold name] place]
    ]

    ; The data a block reads or writes, for data/x where data has no x.
    check-data: function [m] [
        fields: collect [foreach v any [m/data-spec []] [if set-word? :v [keep to word! v]]]
        walk: function [b sets] [
            while [not tail? b] [
                v: first b
                case [
                    all [sets  set-word? :v  not find fields to word! v] [
                        fail rejoin ["data has no " to word! v] b
                    ]
                    all [any [path? :v set-path? :v get-path? :v]  'data = first v] [
                        if all [word? second v  not find fields second v] [
                            fail rejoin ["data has no " second v] b
                        ]
                    ]
                    any [block? :v paren? :v] [walk v false]
                ]
                b: next b
            ]
        ]
        foreach place m/code [walk second place 'set = first place]
        foreach n m/nodes [
            if all [path? n/timeout  not find fields second n/timeout] [
                fail rejoin ["data has no " second n/timeout] n/place
            ]
        ]
    ]

    ; --- running ----------------------------------------------------------------

    chain: function [m top leaf] [
        out: copy []
        id: leaf
        while [true] [
            insert out id
            if id = top [return out]
            id: select node m id 'parent
        ]
    ]

    lca: function [m a b] [
        up: chain m 1 a
        while [not find up b] [b: select node m b 'parent]
        b
    ]

    holds?: function [m guard] [
        if none? guard [return true]
        r: try guard
        either error? :r [false] [either :r [true] [false]]
    ]

    ; The target and the sets of a transition, as they are now; none when a choose has nowhere to go.
    ; The block of a select runs once, here: a value no branch takes is a mistake.
    route: function [m t] [
        unless t/choices [return reduce [t/target t/set]]
        if t/select [
            v: do t/select
            foreach c t/choices [if :v = first first c [return reduce [second c third c]]]
            if t/other [return reduce [t/other t/other-set]]
            fail rejoin ["select gave " mold :v ", which no branch takes"] t/place
        ]
        foreach c t/choices [if holds? m first c [return reduce [second c third c]]]
        if t/other [return reduce [t/other t/other-set]]
        none
    ]

    ; want: none = a transition with no event, true = any, a word = that event.
    ; The route of the one that fits is kept in m/taken, for go.
    fits?: function [m t want] [
        case [
            want = true [true]
            none? want [all [none? t/events  m/taken: route m t]]
            true [all [t/events  find t/events want  holds? m t/guard  m/taken: route m t]]
        ]
    ]

    ; The transition for the active state: the innermost level first, then the ones
    ; around it, for an event; only the innermost for one with no event.
    nested: function [m scope rel want outer] [
        head: first rel
        if 1 < length? rel [
            if t: nested m head next rel want outer [return t]
            unless outer [return none]
        ]
        foreach t select node m scope 'transitions [
            if all [t/source = head  fits? m t want] [return t]
        ]
        none
    ]

    find-transition: function [m want outer] [find-from m m/active want outer]

    ; The same, looking from a state that may be around the active one.
    find-from: function [m id want outer] [
        if any [none? id  id = 1] [return none]
        nested m 1 next chain m 1 id want outer
    ]

    hook: function [m id which] [
        n: node m id
        if b: select n which [
            either which = 'exit [
                m/exiting: true
                do b
                m/exiting: false
            ] [do b]
        ]
    ]

    enter: function [m id] [
        m/active: id
        arm m id
        hook m id 'enter
    ]

    leave: function [m id] [
        m/active: id
        disarm m id
        hook m id 'exit
    ]

    ; --- time: a timer per state with a timeout, and one (key 0) for the ttl ---

    ; The timer sends the machine its own event; a serial tells a timer that was stopped.
    clock: function [m key time name] [
        m/serial: m/serial + 1
        s: m/serial
        put m/timers key reduce [s delay time compose [machine-engine/post (m) (to lit-word! name) (key) (s)]]
    ]

    arm: function [m id] [
        unless v: select node m id 'timeout [exit]
        if path? v [
            v: get in m/data second v
            unless any [number? :v  time? :v] [
                do make error! rejoin ["machine: the timeout of " select node m id 'name " is not seconds or a time: " mold :v]
            ]
        ]
        clock m id v 'timeout
    ]

    disarm: function [m key] [
        if x: select m/timers key [
            cancel second x
            put m/timers key none
        ]
    ]

    arm-ttl: function [m] [
        if m/ttl [
            disarm m 0
            clock m 0 m/ttl 'expired
        ]
    ]

    stop: function [m] [
        foreach [key x] m/timers [if x [cancel second x]]
        m/timers: make map! []
        clear m/deferred
    ]

    post: function [m name key serial] [
        append/only m/queue reduce [name make object! [] key serial]
        unless m/busy [run m]
    ]

    ; A timer that went off: its timeout is taken from its own state, or from one around it.
    ring: function [m name key serial] [
        x: select m/timers key
        unless all [x  serial = first x] [exit]
        put m/timers key none
        either name = 'timeout [
            if t: find-from m key 'timeout true [go m t]
        ] [
            either t: find-transition m 'expired true [go m t] [
                m/outcome: 'expired
                m/done: true
                stop m
                exit
            ]
        ]
        drain m
    ]

    ; The first event held by defer that the machine can take now.
    redeliver: function [m] [
        pos: m/deferred
        while [not tail? pos] [
            e: first pos
            m/scope/event: second e
            if t: find-transition m first e true [
                remove pos
                go m t
                return true
            ]
            pos: next pos
        ]
        false
    ]

    deferring?: function [m name] [
        foreach id chain m 1 m/active [if find select node m id 'defer name [return true]]
        false
    ]

    remember: function [m id] [
        if p: select node m id 'parent [put m/history p id]
    ]

    descend: function [m id] [
        while [true] [
            n: node m id
            if empty? n/children [exit]
            unless n/history [put m/history id none]
            c: any [select m/history id  n/initial]
            enter m c
            put m/history id c
            id: c
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

    go: function [m t] [
        r: m/taken
        dest: first r
        sets: copy []
        if t/set [append/only sets t/set]
        if second r [append/only sets second r]
        vals: values m sets
        source: m/active
        pivot: lca m source dest
        foreach id reverse next chain m pivot source [
            leave m id
            remember m id
        ]
        m/active: pivot
        foreach [f v] vals [set in m/data f :v]
        foreach id next chain m pivot dest [
            enter m id
            remember m id
        ]
        descend m dest
    ]

    ; Follows transitions with no event; a state with nowhere to go ends its level.
    drain: function [m] [
        while [true] [
            if t: find-transition m none false [go m t  continue]
            if find-transition m true false [
                if redeliver m [continue]
                exit
            ]
            n: node m m/active
            if all [n/outcome  none? m/outcome] [m/outcome: n/outcome]
            leave m n/id
            either all [n/parent  n/parent <> 1] [
                put m/history n/parent none
                m/active: n/parent
            ] [
                m/done: true
                stop m
                exit
            ]
        ]
    ]

    begin: function [m] [
        root: node m 1
        arm-ttl m
        enter m root/initial
        descend m root/initial
        drain m
    ]

    ; An event from send: one that no transition takes waits if a defer holds it.
    event: function [m name] [
        either t: find-transition m name true [go m t] [
            either deferring? m name [
                append/only m/deferred reduce [name m/scope/event]
            ] [
                if m/active [hook m m/active 'activity]
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
            unless t: find-transition m 'error true [do r]
            go m t
            drain m
        ]
    ]

    where: function [m] [
        if none? m/active [return none]
        names: collect [foreach id next chain m 1 m/active [keep select node m id 'name]]
        either 1 = length? names [first names] [to path! names]
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
        m
    ]

    make-machine: function [spec [block!]] [
        spec: copy/deep spec
        m: make object! [
            state: data: outcome: error: active: data-spec: ttl: taken: none
            done: false
            nodes: copy []  code: copy []  history: make map! []  queue: copy []
            timers: make map! []  serial: 0  deferred: copy []
            busy: false  exiting: false
            scope: make object! [data: event: none]
        ]
        add-node m none none
        level m node m 1 spec
        ; targets once every state is known: one inside may lead to one further out
        foreach n m/nodes [foreach t n/transitions [resolve m n t]]
        if empty? select node m 1 'children [fail "a machine needs a state" spec]
        check-timeouts m
        check-data m
        m
    ]

    ; The data as the machine starts with it.
    fresh: function [m] [
        m/data: make object! copy/deep any [m/data-spec  []]
        m/scope/data: m/data
    ]

    start: function [m] [
        append/only m/queue reduce [none make object! []]
        run m
    ]
]

machine: function [
    "Makes a state machine from a block and starts it in its initial state."
    spec [block!]
] [
    m: machine-engine/make-machine spec
    machine-engine/fresh m
    machine-engine/start m
]

send: function [
    "Sends an event to a machine and gives the state it is in then, or sends a value on a socket."
    m [object! handle!] "A machine, or a socket"
    event [any-value!] "The event: a word, or a block with the word and its fields; for a socket, the value"
] [
    if handle? m [return machine-engine/socket m :event]
    unless any [word? :event block? :event] [
        do make error! "send: the event is a word, or a block that starts with one"
    ]
    either word? event [name: event  ev: make object! []] [
        name: first event
        unless word? :name [do make error! "send: the block starts with the name of the event"]
        ev: make object! next event
    ]
    if find machine-engine/own name [do make error! rejoin ["send: " name " is the machine's own event"]]
    append/only m/queue reduce [name ev]
    unless m/busy [machine-engine/run m]
    m/state
]

in?: function [
    "Whether a machine is in a state now: its name, or a path of names from the top."
    m [object!]
    name [word! path!]
] [
    e: machine-engine
    if none? m/active [return false]
    ids: next e/chain m 1 m/active
    either word? name [
        foreach id ids [if name = select e/node m id 'name [return true]]
        false
    ] [
        id: 1
        foreach w to block! name [unless id: e/child m id w [return false]]
        to logic! find ids id
    ]
]

restart: function [
    "Starts a machine again from its initial state, with its data as it was made."
    m [object!]
] [
    machine-engine/stop m
    machine-engine/fresh m
    m/history: make map! []
    m/outcome: m/error: m/active: none
    m/done: false
    clear m/queue
    machine-engine/start m
]
`;
