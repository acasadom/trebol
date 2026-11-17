// Machines in Trebol (see machine.ts). The engine, part five: snapshot and resume, can, the graph of the states,
// and on-save.

export const SNAPSHOT = String.raw`
    ; --- snapshot: the machine as plain data, which machine/from resumes ---

    ; A state as the block of the names from the top down to it, and back.
    names-of: function [m id] [collect [foreach x next chain m 1 id [keep select node m x 'name]]]

    id-of: function [m names] [
        id: 1
        foreach w names [
            unless id: child m id w [do make error! rejoin ["machine/from: no state " mold to path! names suggest w state-names m]]
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
            unless in m/data to word! f [do make error! rejoin ["machine/from: data has no " to word! f suggest to word! f words-of m/data]]
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

    ; --- graph: the states and ways as plain data, for tools that draw them ---

    key-of: function [m id] [
        names: names-of m id
        either 1 = length? names [first names] [to path! names]
    ]

    graph: function [m] [
        states: copy []
        foreach n next m/nodes [
            parent: node m n/parent
            append states key-of m n/id
            append/only states reduce [
                'kind case [n/final ['final]  n/parallel ['parallel]  true ['state]]
                'initial n/id = parent/initial
                'on on? m n/id
                'history n/history
                'outcome n/outcome
                'timeout :n/timeout
                'run either n/run [copy/deep n/run] [none]
                'invoke either block? :n/invoke [graph make-machine n/invoke] [:n/invoke]
                'for n/for
                'in :n/in
                'defer copy n/defer
            ]
        ]
        ways: copy []
        foreach n m/nodes [
            foreach t n/transitions [
                way: reduce ['from key-of m t/source]
                case [
                    t/target [append way reduce ['to key-of m t/target]]
                    t/select [append way reduce ['select copy/deep t/select]]
                    true [append way 'choose]
                ]
                append way reduce ['on either t/events [copy t/events] [none]]
                append way reduce ['where either t/guard [copy/deep t/guard] [none]]
                append way reduce ['set either t/set [copy/deep t/set] [none]]
                if t/choices [
                    branches: copy []
                    foreach c t/choices [
                        append/only branches reduce [
                            either t/select ['value] ['when]  copy/deep first c
                            'to key-of m second c
                            'set either third c [copy/deep third c] [none]
                        ]
                    ]
                    if t/other [
                        append/only branches reduce ['else none 'to key-of m t/other 'set either t/other-set [copy/deep t/other-set] [none]]
                    ]
                    append way reduce ['branches branches]
                ]
                append/only ways way
            ]
        ]
        reduce [
            'state m/state
            'data collect [foreach v any [m/data-spec []] [if set-word? :v [keep to word! v]]]
            'ttl m/ttl
            'shared m/shared
            'done m/done
            'states states
            'ways ways
        ]
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

`;
