// Machines in Trebol (see machine.ts). The engine, part two: the ways out of a state, and the checks of a
// machine made: every state reached, no choose that hangs, the events it takes, its data.

export const CHECKS = String.raw`
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
        unless id: child m n/id t/source [fail rejoin ["no state " t/source " here" suggest t/source state-names m] t/place]
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

    ; Every state can be reached: from the initial ones, by the ways out of states that can.
    check-reach: function [m] [
        reach: make map! []
        mark: function [id] [
            if any [none? id  select reach id] [exit]
            put reach id true
            n: node m id
            if n/parent [mark n/parent]
            either n/parallel [foreach c n/children [mark c]] [mark n/initial]
        ]
        mark 1
        more: true
        while [more] [
            more: false
            before: length? reach
            foreach n m/nodes [
                foreach t n/transitions [
                    if select reach t/source [
                        mark t/target
                        mark t/other
                        foreach c any [t/choices []] [mark second c]
                    ]
                ]
            ]
            more: before < length? reach
        ]
        foreach n next m/nodes [
            unless select reach n/id [fail rejoin ["no way leads to state " n/name] n/place]
        ]
    ]

    ; A choose with no event and no else, out of a state with no other way out, may keep the machine there for good.
    check-hang: function [m] [
        foreach n m/nodes [
            foreach t n/transitions [
                if all [t/choices  none? t/events  none? t/other  none? t/select] [
                    s: node m t/source
                    up: next chain m 1 t/source
                    out: false
                    foreach id up [if select node m id 'parallel [out: true]]
                    unless empty? s/children [out: true]
                    foreach o m/nodes [
                        foreach x o/transitions [
                            if all [x <> t  find up x/source] [out: true]
                        ]
                    ]
                    unless out [
                        fail rejoin ["the machine may stay in " s/name " for good: give the choose an else, or the state another way out"] t/place
                    ]
                ]
            ]
        ]
    ]

    ; The events some way or defer of the machine names; none if it takes any (ttl, on-activity).
    events: function [m] [
        if m/ttl [return none]
        out: copy []
        foreach n m/nodes [
            if n/activity [return none]
            append out n/defer
            foreach t n/transitions [append out any [t/events []]]
        ]
        unique out
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
        any [find-state m n/id name  fail rejoin ["no state " mold name suggest either path? name [last name] [name] state-names m] place]
    ]

    ; The data a block reads or writes, for data/x where data has no x.
    check-data: function [m] [
        fields: data-fields m
        walk: function [b sets] [
            while [not tail? b] [
                v: first b
                case [
                    all [sets  set-word? :v  not find fields to word! v] [
                        fail rejoin ["data has no " to word! v suggest to word! v fields] b
                    ]
                    all [any [path? :v set-path? :v get-path? :v]  'data = first v] [
                        if all [word? second v  not find fields second v] [
                            fail rejoin ["data has no " second v suggest second v fields] b
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
                fail rejoin ["data has no " second n/timeout suggest second n/timeout fields] n/place
            ]
            if all [n/in  not find fields second n/in] [
                fail rejoin ["data has no " second n/in suggest second n/in fields] n/place
            ]
        ]
    ]

`;
