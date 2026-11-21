// Machines in Trebol (see machine.ts). The engine, part six: one machine for every tab, run by the tab that
// holds its lock; it closes the engine object.

export const SHARED = String.raw`
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
            either saved [resume m saved] [start-later m]
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
            shared: channel: seen: none  owner: true  asks: copy []  using: copy []
            scope: make object! [data: event: none]
        ]
        add-node m none none
        level m node m 1 spec
        ; targets once every state is known: one inside may lead to one further out
        foreach n m/nodes [foreach t n/transitions [resolve m n t]]
        if empty? select node m 1 'children [fail "a machine needs a state" spec]
        check-timeouts m
        check-data m
        check-reach m
        check-hang m
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

    ; The start of a machine that machine makes: it is in its initial states at once, and machine
    ; runs their hooks once the expression that made it is done, so they see the word it was set
    ; to. An event sent before that waits in the queue behind the start.
    start-later: function [m] [
        append m/on firsts m select node m 1 'initial
        m/state: where m
        append/only m/queue reduce [none make object! []]
        m
    ]

    begun: function [m] [unless any [m/busy  empty? m/queue] [run m]]

    ; A state and the states inside it a start enters.
    firsts: function [m id] [
        out: reduce [id]
        n: node m id
        case [
            n/parallel [foreach c n/children [append out firsts m c]]
            not empty? n/children [append out firsts m n/initial]
        ]
        out
    ]
]

`;
