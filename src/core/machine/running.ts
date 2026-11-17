// Machines in Trebol (see machine.ts). The engine, part three: running, the states the machine is in, entering
// and leaving them, and its timers.

export const RUNNING = String.raw`
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

`;
