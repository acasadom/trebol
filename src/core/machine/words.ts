// Machines in Trebol (see machine.ts). The words a program uses: machine, snapshot, send, in?, graph-of, can?
// and restart.

export const WORDS = String.raw`
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
    ; an event no way of the machine names is a mistake: it would be lost
    if all [known: machine-engine/events m  not find known name] [
        do make error! rejoin ["send: the machine has no way on " name machine-engine/suggest name known]
    ]
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

graph-of: function [
    "The states of a machine and the ways between them, as plain data; of a block, the machine it would make, run not."
    machine [object! block!] "A machine, or the block of one"
] [
    e: machine-engine
    e/graph either block? machine [e/make-machine machine] [machine]
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
