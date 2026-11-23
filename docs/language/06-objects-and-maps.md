# 6. Objects and maps

A repair order is not a list. It has a customer, a bike, a due date and the parts that go into it — each
with a name and a meaning. This page gives orders that shape with **objects**, makes every new order from a
model, and meets **maps**, the shape for data whose fields you do not know in advance.

```trebol-console
>> prices: [chain $12.50 tyre $22.00 brake-pads $9.90 bell $5.00]
== [chain $12.50 tyre $22.00 brake-pads $9.90 bell $5.00]
```

## An object

`make object!` takes a block of set-words and values, and keeps them together:

```trebol-console
>> order: make object! [
[        customer: "Ada Okafor"
[        bike: "Blue road bike"
[        due: 14-Nov-2026
[        parts: [chain tyre]
[    ]
== make object! [
    customer: "Ada Okafor"
    bike: "Blue road bike"
    due: 14-Nov-2026
    parts: [chain tyre]
]
```

The words of an object are its **fields**. A path reads them, and a path with a colon changes them:

```trebol-console
>> order/customer
== "Ada Okafor"
>> order/due: order/due + 1
== 15-Nov-2026
>> append order/parts 'bell
== [chain tyre bell]
>> words-of order
== [customer bike due parts]
```

An object keeps the fields it was made with, and no others. Asking for one it does not have is an error,
which catches a mistyped name at once:

```trebol-console
>> order/colour
** Script error: colour is not a field of the object
** Near: [order/colour]
** At: 1:1
```

## Functions inside an object

A field can hold a function, and the function sees the other fields of its object by their names. An order
that knows its own total:

```trebol-console
>> order: make object! [
[        customer: "Ada Okafor"
[        parts: [chain tyre]
[        total: function [] [
[            sum: $0.00
[            foreach part parts [sum: sum + select prices part]
[            sum
[        ]
[    ]
== make object! [
    customer: "Ada Okafor"
    parts: [chain tyre]
    total: func [/local sum] [
        sum: $0.00
        foreach part parts [sum: sum + select prices part]
        sum
    ]
]
>> order/total
== $34.50
```

`parts` inside `total` is the `parts` of this object. How a word inside a function knows which object it
belongs to is the subject of a later step; for now, it simply works.

## A model for every order

The shop makes dozens of orders, all with the same fields. Make one object as the model — a *prototype* —
and every order from it with `make`:

```trebol-console
>> repair: make object! [
[        customer: none
[        due: none
[        parts: []
[        note: ""
[        total: function [] [
[            sum: $0.00
[            foreach part parts [sum: sum + select prices part]
[            sum
[        ]
[    ]
== make object! [
    customer: none
    due: none
    parts: []
    note: ""
    total: func [/local sum] [
        sum: $0.00
        foreach part parts [sum: sum + select prices part]
        sum
    ]
]
>> ada: make repair [customer: "Ada Okafor" due: 14-Nov-2026 parts: [chain tyre]]
== make object! [
    customer: "Ada Okafor"
    due: 14-Nov-2026
    parts: [chain tyre]
    note: ""
    total: func [/local sum] [
        sum: $0.00
        foreach part parts [sum: sum + select prices part]
        sum
    ]
]
>> lin: make repair [customer: "Lin Wei" parts: [bell]]
== make object! [
    customer: "Lin Wei"
    due: none
    parts: [bell]
    note: ""
    total: func [/local sum] [
        sum: $0.00
        foreach part parts [sum: sum + select prices part]
        sum
    ]
]
>> ada/total
== $34.50
>> lin/total
== $5.00
```

The new order starts as a copy of the model, then the block you give sets the fields that differ. The copy
is real: each order gets its own blocks and strings, and its functions work on its own fields. Writing a
note on Ada's order leaves Lin's alone:

```trebol-console
>> append ada/note "Customer will collect on Saturday"
== "Customer will collect on Saturday"
>> lin/note
== ""
```

A model can also be extended: fields in the block that the model does not have are added to the new object.

## Maps

An object is right when every order has the same fields. Some data is not like that. The shop's extra fees
change over the year — a rush fee, a storage fee, a wash in the summer — and a **map** holds any keys you
give it. A map is written `#(...)`:

```trebol-console
>> fees: #(rush: $10.00 storage: $2.00)
== #(rush: $10.00 storage: $2.00)
>> fees/rush
== $10.00
```

Unlike an object, a map takes new keys whenever you set them, and gives `none` for a key it does not have:

```trebol-console
>> fees/wash: $5.00
== $5.00
>> fees
== #(rush: $10.00 storage: $2.00 wash: $5.00)
>> fees/painting
== none
>> length? fees
== 3
```

Keys can be words, as here, or strings, numbers or any other value. `words-of` and `values-of` give the
keys and the values of a map, as they do for an object.

`foreach` walks a map one key and value at a time, or only its keys when given one word:

```trebol-console
>> foreach [fee price] fees [print [fee price]]
rush $10.00
storage $2.00
wash $5.00
```

## Data from outside

Data from other programs usually arrives as JSON. `load-json` turns it into maps and blocks, and `to-json`
does the reverse:

```trebol-console
>> customer: load-json {{"name": "Ada Okafor", "phone": "555-0101", "bikes": 2}}
== #(name: "Ada Okafor" phone: "555-0101" bikes: 2)
>> customer/bikes + 1
== 3
>> to-json #(customer: "Lin Wei" due: 9-Nov-2026 total: $34.50)
== {{"customer":"Lin Wei","due":"2026-11-09","total":34.5}}
```

In a map written with `#(...)` the values are not evaluated, so `true`, `false` and `none` stay words there.
`to-json` still writes them as the JSON values a server expects:

```trebol-console
>> to-json #(paid: false note: none)
== {{"paid":false,"note":null}}
```

Text between braces is a string too, written `{...}` instead of `"..."`: it can span lines and hold double
quotes, which makes it the natural way to write JSON. The braces here are doubled because the outer pair
delimits the string and the inner pair belongs to the JSON. In the second tutorial the shop fetches its
orders from a server, and they arrive just like `customer` here.

Spreadsheets speak CSV. `load-csv/as-records` reads it into a map per row, keyed by the first line, and
`to-csv` writes rows back, with a first line of the keys:

```trebol-console
>> parts: load-csv/as-records {Part,Stock^/Chain,12^/Brake pad,4}
== [#("Part" "Chain" "Stock" "12") #("Part" "Brake pad" "Stock" "4")]
>> to integer! select parts/2 "Stock"
== 4
>> to-csv [#(customer: "Lin Wei" bikes: 2) #(customer: "Ada Okafor" bikes: 1)]
== {customer,bikes
Lin Wei,2
Ada Okafor,1
}
```

Every field comes in as a string, as `"12"` shows: a CSV file does not say what is a number, and a postal
code such as `"01001"` must keep its zero. The keys are strings too, the names in the first line.

Some programs, and many official forms, speak XML. `load-xml` reads it as a block where every element is
three values — its name, a block with what is inside, and its attributes — and a piece of text is `none`,
the text and `none`. `to-xml` writes it back:

```trebol-console
>> invoice: load-xml {<invoice id="7"><customer>Lin Wei</customer><paid/></invoice>}
== [invoice [customer [none "Lin Wei" none] none paid [] none] #(id: "7")]
>> invoice/3/id
== "7"
>> to-xml [part "Chain" [stock 12]]
== {<part stock="12">Chain</part>}
```

The part of a web address after `?` holds names and values too. `load-query` reads it as a map, and
`to-query` writes one, with what an address cannot hold, such as spaces and accents, as `%` escapes:

```trebol-console
>> load-query http://shop.example/search?bike=road&size=54
== #(bike: "road" size: "54")
>> to-query #(customer: "Lin Wei" bikes: 2)
== "customer=Lin%20Wei&bikes=2"
```

The [reference](../reference/data-formats.md) says more about all of them.

## Objects or maps?

Use an **object** when the shape is known and every value has the same fields — an order, a customer, a
bike. Its fields are fixed, mistakes in names show up at once, and it can carry functions. Use a **map**
when the keys are data themselves — fees by name, stock by part, anything read from outside.

## What's next

Orders have a shape. But orders go wrong: a part is out of stock, a date is typed as `31-Feb`, a customer
has no phone. The next step is about errors — how Trebol reports them, and how a program catches them and
carries on.
