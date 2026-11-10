<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Comparison

Comparing values, as functions and as operators. `=` and `equal?` compare loosely: `"abc" = "ABC"` is true and
so is `1 = 1.0`. `==` and `strict-equal?` compare the case and the datatype too, and `same?` asks whether two
values are one and the same.

(fn-equal-3f)=
## equal?

True if the values are equal.

```text
equal? a b
```

- `a` (`any-type!`)
- `b` (`any-type!`)

(fn-not-equal-3f)=
## not-equal?

True if the values are not equal.

```text
not-equal? a b
```

- `a` (`any-type!`)
- `b` (`any-type!`)

(fn-strict-equal-3f)=
## strict-equal?

True if the values are equal and of the same type and case.

```text
strict-equal? a b
```

- `a` (`any-type!`)
- `b` (`any-type!`)

(fn-strict-not-equal-3f)=
## strict-not-equal?

True if the values are not strictly equal.

```text
strict-not-equal? a b
```

- `a` (`any-type!`)
- `b` (`any-type!`)

(fn-same-3f)=
## same?

True if the values are the very same: the same series at the same position, the same object.

```text
same? a b
```

- `a` (`any-type!`)
- `b` (`any-type!`)

(fn-lesser-3f)=
## lesser?

True if the first value is less than the second.

```text
lesser? a b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn-greater-3f)=
## greater?

True if the first value is more than the second.

```text
greater? a b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn-lesser-or-equal-3f)=
## lesser-or-equal?

True if the first value is less than or equal to the second.

```text
lesser-or-equal? a b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn-greater-or-equal-3f)=
## greater-or-equal?

True if the first value is more than or equal to the second.

```text
greater-or-equal? a b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn--3d)=
## =

True if the values are equal.

An operator, written between its values: `a = b` is `equal? a b` (see [`equal?`](#fn-equal-3f)).

```text
a = b
```

- `a` (`any-type!`)
- `b` (`any-type!`)

(fn--3c-3e)=
## \<\>

True if the values are not equal.

An operator, written between its values: `a <> b` is `not-equal? a b` (see [`not-equal?`](#fn-not-equal-3f)).

```text
a <> b
```

- `a` (`any-type!`)
- `b` (`any-type!`)

(fn--3d-3d)=
## ==

True if the values are equal and of the same type and case.

An operator, written between its values: `a == b` is `strict-equal? a b` (see [`strict-equal?`](#fn-strict-equal-3f)).

```text
a == b
```

- `a` (`any-type!`)
- `b` (`any-type!`)

(fn--21-3d-3d)=
## !==

True if the values are not strictly equal.

An operator, written between its values: `a !== b` is `strict-not-equal? a b` (see [`strict-not-equal?`](#fn-strict-not-equal-3f)).

```text
a !== b
```

- `a` (`any-type!`)
- `b` (`any-type!`)

(fn--3c)=
## \<

True if the first value is less than the second.

An operator, written between its values: `a < b` is `lesser? a b` (see [`lesser?`](#fn-lesser-3f)).

```text
a < b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn--3e)=
## \>

True if the first value is more than the second.

An operator, written between its values: `a > b` is `greater? a b` (see [`greater?`](#fn-greater-3f)).

```text
a > b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn--3c-3d)=
## \<=

True if the first value is less than or equal to the second.

An operator, written between its values: `a <= b` is `lesser-or-equal? a b` (see [`lesser-or-equal?`](#fn-lesser-or-equal-3f)).

```text
a <= b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn--3e-3d)=
## \>=

True if the first value is more than or equal to the second.

An operator, written between its values: `a >= b` is `greater-or-equal? a b` (see [`greater-or-equal?`](#fn-greater-or-equal-3f)).

```text
a >= b
```

- `a` (`any-value!`)
- `b` (`any-value!`)
