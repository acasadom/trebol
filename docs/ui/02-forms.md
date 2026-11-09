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

## Rules of your own

The built-in rules cover the usual cases: `required`, `email`, `url`, `integer`, `min` and `max` for
numbers, amounts and dates, `length 3 20` for text, and `match` for a field that must repeat another. A rule
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

## What's next

A form on its own fills the page from side to side. The [next page](03-layout) arranges the counter
screen: the form beside the day's bookings, grouped in panels, and what happens to all of it on a phone.
