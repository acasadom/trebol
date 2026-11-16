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
                                        fail rejoin ["the machine invoked in " n/name " has no data " to word! x] spec
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
                fail rejoin [w " is not a word of machine"] here
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
        if n/parallel [fail rejoin ["the states of parallel " n/name " have no ways between them"] t/place]
        unless id: child m n/id t/source [fail rejoin ["no state " t/source " here"] t/place]
        t/source: id
        if t/target [t/target: target m n t/target t/place]
        if t/choices [
            foreach c t/choices [poke c 2 target m n second c t/place]
            if t/other [t/other: target m n t/other t/place]
        ]
        if t/events [
            if all [find t/events 'timeout  not has? m id [timeout]] [
                fail rejoin ["on timeout leaves " second t/place ", which has no timeout"] t/place
            ]
            if all [find t/events 'done  not has? m id [run invoke]] [
                fail rejoin ["on done leaves " second t/place ", which has no run or invoke"] t/place
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

    ; Whether a state or one inside it has one of the fields.
    has?: function [m id fields] [
        n: node m id
        foreach f fields [if select n f [return true]]
        foreach c n/children [if has? m c fields [return true]]
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
            if all [n/in  not find fields second n/in] [
                fail rejoin ["data has no " second n/in] n/place
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
    ; The route of the one that fits is kept in m/taken, for go. A way out of a parallel
    ; with no event sees in event how each of its states ended: a to waits for all of them.
    fits?: function [m t want] [
        case [
            want = true [true]
            none? want [
                if t/events [return false]
                if select node m t/source 'parallel [
                    if all [none? t/choices  inside? m t/source] [return false]
                    m/scope/event: results m t/source
                ]
                to logic! m/taken: route m t
            ]
            true [all [t/events  find t/events want  holds? m t/guard  m/taken: route m t]]
        ]
    ]

    ; The transition from state id that fits: its own first, then, when outer, those of the
    ; states around it, up to the state stop (none: up to the top).
    find-from: function [m id want outer stop] [
        while [all [id  id <> 1  id <> stop]] [
            n: node m id
            foreach t select node m n/parent 'transitions [
                if all [t/source = id  fits? m t want] [return t]
            ]
            unless outer [return none]
            id: n/parent
        ]
        none
    ]

    ; --- the states the machine is in: m/on holds each, from the top down to the leaves ---

    on?: function [m id] [to logic! find m/on id]

    ; Whether a state has one of its own states on.
    inside?: function [m id] [
        foreach c select node m id 'children [if on? m c [return true]]
        false
    ]

    ; The innermost states on, in the order the block gives them.
    leaves: function [m] [
        out: copy []
        foreach id m/on [unless inside? m id [append out id]]
        sort out
    ]

    ; The nearest parallel around a state, or none.
    region-of: function [m id] [
        while [id: select node m id 'parent] [if select node m id 'parallel [return id]]
        none
    ]

    ; How each state of a parallel ended: its outcome, or the name of its final state; none while on.
    results: function [m id] [
        make object! collect [
            foreach c select node m id 'children [
                keep to set-word! select node m c 'name
                v: either on? m c [none] [select m/results c]
                keep either v [to lit-word! v] ['none]
            ]
        ]
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
        append m/on id
        arm m id
        work m id
        hook m id 'enter
    ]

    leave: function [m id] [
        m/active: id
        disarm m id
        disarm m negate id
        hook m id 'exit
        remove find m/on id
    ]

    ; --- time: a timer per state with a timeout, and one (key 0) for the ttl ---

    ; The timer sends the machine its own event; a serial tells a timer that was stopped.
    clock: function [m key time name] [clock-at m key now/precise + to time! time name]

    ; A timer that goes off at a moment, kept with it for snapshot; one already past goes off at once.
    clock-at: function [m key at name] [
        s: serial m
        left: difference at now/precise
        if left < 0:00 [left: 0:00]
        put m/timers key reduce [s delay left compose [machine-engine/post (m) (to lit-word! name) (key) (s)] at]
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
            drop second x
            put m/timers key none
        ]
    ]

    ; Stops a timer, a task or a machine invoked; none is one that has already ended.
    drop: function [x] [
        case [
            object? x [
                stop x
                x/caller: none
                x/done: true
            ]
            block? x [foreach c x [drop c]]
            x [cancel x]
        ]
    ]

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
                unless in c/data f [do make error! rejoin ["machine: the machine invoked in " n/name " has no data " f]]
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

    ; --- snapshot: the machine as plain data, which machine/from resumes ---

    ; A state as the block of the names from the top down to it, and back.
    names-of: function [m id] [collect [foreach x next chain m 1 id [keep select node m x 'name]]]

    id-of: function [m names] [
        id: 1
        foreach w names [
            unless id: child m id w [do make error! rejoin ["machine/from: no state " mold to path! names]]
        ]
        id
    ]

    ; An object from a block of field: value, the values taken as they are.
    object-of: function [body] [
        o: make object! append collect [foreach [f v] body [keep to set-word! f]] [none]
        foreach [f v] body [set in o to word! f :v]
        o
    ]

    snapshot: function [m] [
        timers: copy []  tasks: copy []  ttl: none
        foreach [key x] m/timers [
            if x [
                case [
                    key = 0 [ttl: third x]
                    key > 0 [append/only timers names-of m key  append timers third x]
                    true [
                        w: second x
                        append/only tasks names-of m negate key
                        append/only tasks case [
                            object? w [snapshot w]
                            block? w [
                                reduce [
                                    'outcomes copy third x  'data copy fourth x
                                    'machines collect [foreach c w [keep/only either c/done [none] [snapshot c]]]
                                ]
                            ]
                            true ['run]
                        ]
                    ]
                ]
            ]
        ]
        reduce [
            'on collect [foreach id m/on [keep/only names-of m id]]
            'data body-of m/data
            'history collect [foreach [k v] m/history [if v [keep/only names-of m k  keep/only names-of m v]]]
            'results collect [foreach [k v] m/results [keep/only names-of m k  keep :v]]
            'deferred collect [foreach e m/deferred [keep/only reduce [first e  body-of second e]]]
            'timers timers  'ttl ttl  'tasks tasks
            'done m/done  'outcome m/outcome  'last m/last
        ]
    ]

    ; Puts a machine made from its spec where the snapshot left it: no on-enter runs again, the
    ; timers go off when they were going to, a run starts over and a machine invoked resumes.
    resume: function [m saved] [
        restore m saved
        unless m/done [
            if t: select saved 'ttl [clock-at m 0 t 'expired]
            foreach [names t] select saved 'timers [clock-at m id-of m names t 'timeout]
            foreach [names w] select saved 'tasks [revive m names w]
        ]
        m/state: where m
        m
    ]

    ; The plain part of a snapshot: states, data, history, results, the events held.
    restore: function [m saved] [
        unless block? :saved [do make error! "machine/from: a snapshot is a block"]
        foreach names select saved 'on [append m/on id-of m names]
        foreach [f v] select saved 'data [
            unless in m/data to word! f [do make error! rejoin ["machine/from: data has no " to word! f]]
            set in m/data to word! f :v
        ]
        foreach [k v] select saved 'history [put m/history id-of m k id-of m v]
        foreach [k v] select saved 'results [put m/results id-of m k :v]
        foreach e select saved 'deferred [append/only m/deferred reduce [first e  object-of second e]]
        m/done: true = select saved 'done
        m/outcome: select saved 'outcome
        m/last: select saved 'last
        m/state: where m
    ]

    ; The work of a state as the snapshot left it: a run starts over, a machine invoked resumes.
    revive: function [m names w] [
                id: id-of m names
                n: node m id
                case [
                    n/run [work m id]
                    all [n/invoke  n/for  block? :w] [
                        s: serial m
                        kids: copy []
                        machines: select w 'machines
                        repeat i length? machines [
                            if c: pick machines i [
                                c: resumed n c
                                c/caller: reduce [m id s i]
                                append kids c
                            ]
                        ]
                        put m/timers negate id reduce [s kids  copy select w 'outcomes  copy select w 'data  length? kids]
                    ]
                    all [n/invoke  block? :w] [
                        c: resumed n w
                        s: serial m
                        c/caller: reduce [m id s]
                        put m/timers negate id reduce [s c]
                    ]
                ]
    ]

    ; Forgets the states, history and results, before a snapshot is put in.
    clean: function [m] [
        stop m
        m/on: copy []
        m/history: make map! []
        m/results: make map! []
        clear m/queue
    ]

    ; The machine back where a snapshot of it left it, in place: what it was doing
    ; is stopped, and nothing it does on entering a state runs again. A form in
    ; steps goes back with it. A copy of a shared machine asks the owner's tab.
    rewind: function [m saved] [
        unless m/owner [
            share-ask m/channel mold/all reduce ['rewind saved]
            return m
        ]
        clean m
        m/done: false
        m/outcome: m/error: m/active: m/last: none
        resume m saved
        saved m
        m
    ]

    ; Whether a state the machine is in, or one around it, has a way out on an event.
    can: function [m name] [
        foreach leaf leaves m [
            id: leaf
            while [all [id  id <> 1]] [
                n: node m id
                foreach t select node m n/parent 'transitions [
                    if all [t/source = id  t/events  find t/events name] [return true]
                ]
                id: n/parent
            ]
        ]
        false
    ]

    ; The machine of an invoke, resumed from its own snapshot.
    resumed: function [n saved] [
        spec: n/invoke
        unless block? spec [spec: get spec]
        c: make-machine spec
        fresh c
        resume c saved
    ]

    ; After each event, the on-save of the outermost machine, with its snapshot.
    saved: function [m] [
        top: m
        while [top/caller] [top: first top/caller]
        if any [top/busy  not top/owner] [exit]
        if top/on-save [
            top/saver/snapshot: snapshot top
            do top/on-save
        ]
        if top/channel [tell top false]
    ]

    ; --- shared: one machine for every tab of the app, run by the tab that owns it ---
    ; The owner holds a lock named after the machine and tells the other tabs its
    ; snapshot after each event; they keep a copy and send their events to it.

    share-name: function [m] [rejoin ["trebol-machine-" m/shared]]

    ; Makes m the owner, or a copy of the owner another tab has.
    share-start: function [m saved] [
        ; a host with no tabs has no share-open: the machine is only this one's
        m/channel: all [value? 'share-open  share-open share-name m compose [machine-engine/heard (m) message asked]]
        either any [
            none? m/channel
            share-lock share-name m compose [machine-engine/took (m)]
        ] [
            either saved [resume m saved] [start m]
        ] [
            m/owner: false
            share-ask m/channel mold/all [hello]
        ]
        m
    ]

    ; The snapshot to the other tabs, answering the asks done since the last one.
    tell: function [m fresh] [
        asks: m/asks
        m/asks: copy []
        share-post m/channel mold/all reduce ['state snapshot m] asks fresh
    ]

    ; What another tab says: to the owner an event, restart or hello; to a copy the owner's snapshot.
    heard: function [m message asked] [
        x: load message
        unless m/owner [
            if 'state = first x [
                m/seen: second x
                clean m
                restore m m/seen
            ]
            exit
        ]
        if 'state = first x [exit]
        if asked [append m/asks asked]
        obey m x
        unless m/busy [tell m false]
    ]

    ; An event or a restart that came from another tab.
    obey: function [m x] [
        switch first x [
            event [
                append/only m/queue reduce [second x  object-of third x]
                unless m/busy [run m]
            ]
            restart [again m]
            rewind [rewind m second x]
        ]
    ]

    ; The owner's tab has gone: this one goes on from the last snapshot it was told.
    took: function [m] [
        m/owner: true
        clean m
        either m/seen [resume m m/seen] [start m]
        foreach [id message] share-asks m/channel [
            append m/asks id
            obey m load message
        ]
        tell m true
    ]

    ; restart, for the owner or a machine of one tab.
    again: function [m] [
        stop m
        fresh m
        m/history: make map! []
        m/outcome: m/error: m/active: m/last: none
        m/on: copy []
        m/results: make map! []
        m/done: false
        clear m/queue
        start m
    ]

    make-machine: function [spec [block!]] [
        spec: copy/deep spec
        m: make object! [
            state: data: outcome: error: active: data-spec: ttl: taken: none
            done: false
            nodes: copy []  code: copy []  history: make map! []  queue: copy []
            timers: make map! []  serial: 0  deferred: copy []
            on: copy []  results: make map! []  last: caller: none
            busy: false  exiting: false  on-save: saver: none
            shared: channel: seen: none  owner: true  asks: copy []
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
    /from {Resumes it where a snapshot of it left it, instead}
    saved [block!] "What snapshot gave"
] [
    e: machine-engine
    m: e/make-machine spec
    e/fresh m
    case [
        m/shared [e/share-start m all [from saved]]
        from [e/resume m saved]
        true [e/start m]
    ]
]

snapshot: function [
    "The state of a machine as a block of plain data, which machine/from resumes."
    m [object!]
] [
    ; a copy of a shared machine has only what the owner told it
    either m/owner [machine-engine/snapshot m] [copy/deep m/seen]
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
    unless m/owner [
        ; a copy: the owner's tab runs it, and its answer brings the new state
        share-ask m/channel mold/all reduce ['event name body-of ev]
        return m/state
    ]
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
    either word? name [
        foreach id m/on [if name = select e/node m id 'name [return true]]
        false
    ] [
        id: 1
        foreach w to block! name [unless id: e/child m id w [return false]]
        e/on? m id
    ]
]

can?: function [
    "Whether a machine has a way out on an event from where it is now; what where would say is not asked."
    m [object!]
    event [word!]
] [
    machine-engine/can m event
]

restart: function [
    "Starts a machine again from its initial state, with its data as it was made."
    m [object!]
] [
    either m/owner [machine-engine/again m] [
        share-ask m/channel mold/all [restart]
        m
    ]
]
`;
