# 2. Forms

A bike comes in through the door. Before anyone touches it the shop writes down whose it is, what kind of
bike, what is wrong with it and when the customer can have it back. This page builds that counter screen.

## A form

```trebol-ui
view [
    title "Book a repair"
    form [
        field customer "Customer" required
        field phone "Phone" "So we can call when it is ready"
        choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
        area fault "What is wrong" required
        money estimate "Estimate" min $0
        date due "Due back" required
        submit "Book in" [toast rejoin ["Booked in for " values/customer]]
    ]
]
```

`form` lines its faces up in two columns, labels on the left and controls on the right. When it is narrow,
on a phone or in a narrow column, it puts each label over its control instead. Each face inside it reads the same way:

- the style says what kind of value it takes: `field` a line of text, `choice` one of a list, `area` a few
  lines, `money` an amount, `date` a day;
- the word after the style is the field's *name*, `customer` or `due`;
- the first string is its label and the second, when there is one, the hint shown while it is empty;
- the rest are rules: `required`, `min $0`.

Try it before reading on. The button looks disabled until every field is valid, and pressing it anyway
points out every field that is not. A field that breaks a rule says so when you leave it, not while you are
still typing, and the message goes as soon as it is fixed.

## The values

`submit` is a button that belongs to its form: it only runs its action when the form is valid, and Enter
in any field presses it. Inside its action, `values` is a map of every named field and its value:

```trebol-ui
view [
    title "Book a repair"
    form [
        field customer "Customer" required
        choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
        money estimate "Estimate" min $0
        date due "Due back" required
        submit "Book in" [booked/text: mold values]
    ]
    booked: text muted "Nothing booked yet."
]
```

Each value has its own type. The estimate is a `money!` and the due date a `date!`, ready to add, compare or
store, the same values the first tutorial worked with. A field left empty is `none`. Nothing in the form had
to turn text into a number.

## Options in groups

A long list of options is easier to read in groups. In the options of a `choice`, a title followed by a block
is a group, with the block's options under the title; options on their own and groups can go together:

```trebol-ui
view [
    form [
        choice job "Job" [
            "Repairs" ["Puncture" "Brakes" "Gears"]
            "Service" ["Basic service" "Full service"]
            "Something else"
        ] required
        submit "Book in" [toast values/job]
    ]
]
```

What the program receives is still the option chosen, here `"Brakes"`, not its group. A `radio` takes groups
the same way, and shows each title over its options.

## Rules of your own

The built-in rules cover the usual cases: `required`, `email`, `url`, `integer`, `iban`, `min` and `max`
for numbers, amounts and dates, `length 3 20` for text, and `match` for a field that must repeat another. A rule
of the shop's own is a `check` block. It sees the field's value as `value` and says `true` when the value is
good, or the message to show when it is not:

```trebol-ui
view [
    title "Book a repair"
    form [
        field customer "Customer" required length 2 60
        date due "Due back" required check [
            case [
                value < now/date ["That day has already gone"]
                value/weekday = 7 ["The shop is closed on Sundays"]
                true [true]
            ]
        ]
        submit "Book in" [toast "Booked in"]
    ]
]
```

Pick a Sunday and leave the field. A `check` runs whenever its value changes, so keep it quick; a rule
that has to ask a server is a `check-async`, which a later page uses.

A rule the shop needs in many fields gets a name with `rule`, and then goes after a field as `email` does.
The shop's frame numbers are two letters and six digits:

```trebol-ui
alpha: charset [#"A" - #"Z" #"a" - #"z"]
digit: charset "0123456789"
rule 'frame-number #(en: "Enter a frame number, like WT123456" es: "Introduce un número de cuadro, como WT123456") [
    parse value [2 alpha 6 digit]
]

view [
    title "Book a repair"
    form [
        field frame "Frame number" required frame-number
        field old-frame "Frame it replaces" frame-number
        submit "Book in" [toast "Booked in"]
    ]
]
```

Its block sees `value`, `face` and `values` as a `check` does, and runs only when the field has a value. It
gives true when the value is good; none or false shows the rule's message, which is a text, or a text per
language, as the [languages](08-languages.md) page tells; a string shows that string instead. The message is
kept in `i18n/ui` under the rule's name, so an app can say it its own way:
`poke i18n/ui 'frame-number #(en: "That is not one of our frames")`.

A package of rules, the ones of a country for instance, is a module of `rule`s: a program that imports it,
`import 'trebol-es`, can write those words after its fields (see [packages](../language/13-modules.md#a-package)).

## Faces that follow others

Some faces only show what others hold: the price of the repair, worked out from the hours and the parts, or
a line that sums up the booking. `calc` gives a field a formula, `is` gives any face one, and `react` runs a
block of your own:

```trebol-ui
view [
    title "Quote"
    form [
        number hours "Hours" min 0
        money parts "Parts" EUR min 0
        money total "Total" EUR calc [values/hours * 30 + values/parts]
        text muted is [
            either values/total [rejoin ["The customer pays " localize values/total]] ["Fill in hours and parts"]
        ]
        check rush "Rush job"
        text warning hidden react [face/hidden: not values/rush  face/text: "Ready tomorrow, 20% more"]
        submit "Send quote" [toast "Quote sent"]
    ]
]
```

Type the hours and the parts. Each of these blocks runs when its face is shown and again whenever something it
reads changes, and Trebol tells what it reads by looking at it: `values/hours`, `face/hidden`, or a face's
label and facet, as in `search/text`. A block that reads what another one sets runs after it, so the line
below the total follows the total. `calc` makes the field read only: its value is the formula's, and a
formula that cannot be worked out yet, because a field is empty, leaves it empty. `is` sets what the face
shows, its `value` for a field and its `text` for a text; `react` sets whatever it likes, and `react later`
waits for the first change instead of running when shown.

A block can read more than faces: any word that holds an object, down a path as deep as it goes, such as
`settings/look/dark` or the state and data of a machine (page 15 of the language tutorial). Whatever changes
it, a click, a timer of the machine or another tab, the faces that read it follow:

```trebol-ui
repair: machine [
    data [bike: none]
    initial received
    state received []
    state repairing []
    from received to repairing on start set [bike: event/bike]
    from repairing to received on fixed
]
view [
    title "Workshop"
    text is [either in? repair 'repairing [rejoin ["Repairing " repair/data/bike]] ["Nothing on the stand"]]
    row [
        button "Start" react [face/disabled: in? repair 'repairing] [send repair [start bike: "Brompton"]]
        button "Done" react [face/disabled: not in? repair 'repairing] [send repair 'fixed]
    ]
]
```

`in? repair 'repairing` counts as reading `repair/state`.

A face that is hidden folds away, and one shown again unfolds, as the warning here does when the box is
ticked; the first time a screen shows, its faces are simply there.

## A form in steps

A long form reads better a part at a time. The shop's web page takes repairs too, and a customer filling it
in at home answers who they are, then what is wrong, then checks it all before sending. `steps` splits a
form like that, each step a title and its block:

```trebol-ui
view [
    title "Book a repair"
    form [
        steps [
            "You" [
                radio account "Who brings it" ["Me" "My company"] required
                field customer "Name" required
                field phone "Phone" required
            ]
            "Company" when [values/account = "My company"] [
                field company "Company" required
                field tax-id "Tax id" required
            ]
            "The bike" [
                choice bike "Bike" ["Road" "Mountain" "City" "Child's"] required
                area fault "What is wrong" required
            ]
            "Check" [
                text is [rejoin [any [values/customer ""] ", a " any [values/bike "bike"] " bike: " any [values/fault ""]]]
            ]
        ]
        submit "Book in" [toast rejoin ["Booked in for " values/customer]]
    ]
]
```

Only one step shows, under a bar with every title. *Next* moves on when the fields of the step are valid,
and otherwise points out the ones that are not, as `submit` does for the whole form; Enter in a field presses
it. *Back* keeps what was typed. The `submit` of the form waits for the last step, and `values` there holds
the fields of every step.

A step with `when` is there only while its block is true. Choose *My company* and a step for the company
comes in; choose *Me* again and it goes, its fields with it: they are not checked, and they are not in
`values`.

A step done can be chosen again by its title, and the browser's Back goes to the step before, as people
expect from a form on the web. The step on show is the value of `steps`, so a button can go back to one:
with `go: steps [...]`, a *Change* button on the last step is `button "Change" [go/value: 1]`.

When which step comes next is more than one `when`, a machine (page 15 of the language tutorial) can lead the
steps. Its word goes after `steps`, and each step starts with the name of its state:

```trebol-ui
booking: machine [
    data [account: none]
    initial you
    state you []
    state company []
    state bike []
    state check []
    from you choose on next [
        when [event/values/account = "My company"] to company set [account: "company"]
        else to bike set [account: "own"]
    ]
    from company to bike on next
    from bike to check on next
]
view [
    title "Book a repair"
    form [
        steps booking [
            you "You" [
                radio account "Who brings it" ["Me" "My company"] required
                field customer "Name" required
            ]
            company "Company" [
                field company "Company" required
            ]
            bike "The bike" [
                area fault "What is wrong" required
            ]
            check "Check" [
                text is [rejoin [any [values/customer ""] ": " any [values/fault ""]]]
            ]
        ]
        submit "Book in" [toast rejoin ["Booked in for " values/customer]]
    ]
]
```

The step on show is the one of the state the machine is in. *Next* checks the fields of the step, as before,
and sends the machine `next`, with the values of the form in `event/values`; where it goes is the machine's
choice, and it may keep what it needs in its data. *Next* is there while the machine has a way out on
`next` (`can? booking 'next`), so on the last step the `submit` takes its place. *Back* puts the machine back
where it was before that *Next*, its data too, and nothing in `on-enter` runs again: the machine only says the
way forward. The steps it did not go through do not apply, as with `when`.

## A photo

`photo` shows an image and lets the person choose another: with its button, by clicking the image, or by
dropping one on it. On a phone, the button offers the camera too. `round` makes it a circle, as for a
person:

```trebol-ui
view [
    title "Customer"
    global card: form [
        photo picture "Photo" round
        field name "Name" required
        submit "Save" [saved/text: mold values]
    ]
    saved: text muted "Nothing saved yet."
]

set-values card #(name: "Ada Lovelace" picture: "ada.svg")
```

A record that has a photo gives its address, as it comes from the server, and the field shows it. When the
person chooses another, the value becomes that image, an object with its `name`, `size`, `type` and `file`,
the same as one file of an `upload`; the [server page](09-server) sends it. Removing it leaves `none`. It takes
images only, unless `accept` says otherwise.

## What's next

A form on its own fills the page from side to side. The [next page](03-layout) arranges the counter
screen: the form beside the day's bookings, grouped in panels, and what happens to all of it on a phone.
