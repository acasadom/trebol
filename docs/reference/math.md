<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Math

Arithmetic on numbers, amounts of money, percents, times, dates and pairs, and the operators written between
values: `2 + 3` is `add 2 3`. Integers are 64-bit; an operation that does not fit is an error, never a wrong
number. `money!` is exact, every digit kept, while `decimal!` is a floating-point number shown to 15 digits. See [values](../language/02-values.md).

(fn-add)=
## add

The sum of two values.

```text
add a b
```

- `a` (`number!` `money!` `time!` `pair!` `date!`)
- `b` (`number!` `money!` `time!` `pair!` `date!`)

(fn-subtract)=
## subtract

The difference of two values.

```text
subtract a b
```

- `a` (`number!` `money!` `time!` `pair!` `date!`)
- `b` (`number!` `money!` `time!` `pair!` `date!`)

(fn-multiply)=
## multiply

The product of two values.

```text
multiply a b
```

- `a` (`number!` `money!` `time!` `pair!` `date!`)
- `b` (`number!` `money!` `time!` `pair!` `date!`)

(fn-divide)=
## divide

The first value divided by the second.

```text
divide a b
```

- `a` (`number!` `money!` `time!` `pair!` `date!`)
- `b` (`number!` `money!` `time!` `pair!` `date!`)

(fn-remainder)=
## remainder

What is left after dividing the first value by the second.

```text
remainder a b
```

- `a` (`number!` `money!` `time!` `pair!` `date!`)
- `b` (`number!` `money!` `time!` `pair!` `date!`)

(fn-mod)=
## mod

The remainder of a divided by b, with the sign of b.

```text
mod a b
```

- `a` (`number!` `money!` `time!`)
- `b` (`number!` `money!` `time!`): Must not be zero

(fn-modulo)=
## modulo

Like mod, but a remainder too small to tell from b or zero is zero.

```text
modulo a b
```

- `a` (`number!` `money!` `time!`)
- `b` (`number!` `money!` `time!`): Must not be zero

(fn-negate)=
## negate

The value with its sign changed.

```text
negate value
```

- `value` (`number!` `money!` `time!` `pair!` `date!`)

(fn-abs)=
## abs

The value without its sign.

```text
abs value
```

- `value` (`number!` `money!` `time!` `pair!` `date!`)

(fn-round)=
## round

The value rounded to the nearest whole number, or to a multiple of a scale.

```text
round value
```

- `value` (`number!` `money!` `time!`)
- `/to scale` (`number!` `money!` `time!`)
- `/even`
- `/down`
- `/half-down`
- `/floor`
- `/ceiling`
- `/half-ceiling`

(fn-power)=
## power

The number raised to the exponent.

```text
power number exponent
```

- `number` (`number!`)
- `exponent` (`number!`)

(fn-square-root)=
## square-root

The square root of the number.

```text
square-root value
```

- `value` (`number!`)

(fn-exp)=
## exp

e raised to the power of the number.

```text
exp power
```

- `power` (`number!`)

(fn-log-e)=
## log-e

The natural logarithm of the number.

```text
log-e value
```

- `value` (`number!`)

(fn-log-10)=
## log-10

The base-10 logarithm of the number.

```text
log-10 value
```

- `value` (`number!`)

(fn-log-2)=
## log-2

The base-2 logarithm of the number.

```text
log-2 value
```

- `value` (`number!`)

(fn-sine)=
## sine

The sine of an angle, in degrees.

```text
sine angle
```

- `angle` (`number!`)
- `/radians`: The angle is in radians

(fn-cosine)=
## cosine

The cosine of an angle, in degrees.

```text
cosine angle
```

- `angle` (`number!`)
- `/radians`: The angle is in radians

(fn-tangent)=
## tangent

The tangent of an angle, in degrees.

```text
tangent angle
```

- `angle` (`number!`)
- `/radians`: The angle is in radians

(fn-arcsine)=
## arcsine

The angle whose sine is the value, in degrees.

```text
arcsine value
```

- `value` (`number!`)
- `/radians`: Give the angle in radians

(fn-arccosine)=
## arccosine

The angle whose cosine is the value, in degrees.

```text
arccosine value
```

- `value` (`number!`)
- `/radians`: Give the angle in radians

(fn-arctangent)=
## arctangent

The angle whose tangent is the value, in degrees.

```text
arctangent value
```

- `value` (`number!`)
- `/radians`: Give the angle in radians

(fn-arctangent2)=
## arctangent2

The angle of the point x, y, in degrees.

```text
arctangent2 y x
```

- `y` (`number!`)
- `x` (`number!`)
- `/radians`: Give the angle in radians

(fn-random)=
## random

A random value: an integer from 1 to it, a decimal up to it, a shuffled series.

```text
random value
```

- `value` (`any-value!`)
- `/seed`: Start the sequence from this value; gives nothing
- `/only`: Pick one element of a series

(fn-zero-3f)=
## zero?

True if the value is zero.

```text
zero? value
```

- `value` (`number!` `money!` `time!` `pair!` `date!`)

(fn-even-3f)=
## even?

True if the integer is even.

```text
even? value
```

- `value` (`integer!`)

(fn-odd-3f)=
## odd?

True if the integer is odd.

```text
odd? value
```

- `value` (`integer!`)

(fn-sign-3f)=
## sign?

Gives -1, 0 or 1 by the sign of the value.

```text
sign? value
```

- `value` (`number!` `money!` `time!`)

(fn-negative-3f)=
## negative?

True if the value is less than zero.

```text
negative? value
```

- `value` (`number!` `money!` `time!`)

(fn-positive-3f)=
## positive?

True if the value is more than zero.

```text
positive? value
```

- `value` (`number!` `money!` `time!`)

(fn-max)=
## max

The greater of two values.

```text
max a b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn-min)=
## min

The lesser of two values.

```text
min a b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn-and-7e)=
## and~

Both values: bitwise for integers and binaries, logical for anything else.

```text
and~ a b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn-or-7e)=
## or~

Either value: bitwise for integers and binaries, logical for anything else.

```text
or~ a b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn-xor-7e)=
## xor~

One value or the other but not both: bitwise for integers and binaries, logical for anything else.

```text
xor~ a b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn-and)=
## and

Both values: bitwise for integers and binaries, logical for anything else.

An operator, written between its values: `a and b` is `and~ a b` (see [`and~`](#fn-and-7e)).

```text
a and b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn-or)=
## or

Either value: bitwise for integers and binaries, logical for anything else.

An operator, written between its values: `a or b` is `or~ a b` (see [`or~`](#fn-or-7e)).

```text
a or b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn-xor)=
## xor

One value or the other but not both: bitwise for integers and binaries, logical for anything else.

An operator, written between its values: `a xor b` is `xor~ a b` (see [`xor~`](#fn-xor-7e)).

```text
a xor b
```

- `a` (`any-value!`)
- `b` (`any-value!`)

(fn-shift)=
## shift

Shifts the bits of an integer right, or left with /left.

```text
shift data bits
```

- `data` (`integer!`)
- `bits` (`integer!`): How many bits
- `/left`: Shift to the left
- `/logical`: Shift zeros in, not the sign

(fn-shift-left)=
## shift-left

Shifts the bits of an integer left.

```text
shift-left data bits
```

- `data` (`integer!`)
- `bits` (`integer!`): How many bits

(fn-shift-right)=
## shift-right

Shifts the bits of an integer right, keeping its sign.

```text
shift-right data bits
```

- `data` (`integer!`)
- `bits` (`integer!`): How many bits

(fn-shift-logical)=
## shift-logical

Shifts the bits of an integer right, shifting zeros in.

```text
shift-logical data bits
```

- `data` (`integer!`)
- `bits` (`integer!`): How many bits

(fn--2b)=
## +

The sum of two values.

An operator, written between its values: `a + b` is `add a b` (see [`add`](#fn-add)).

```text
a + b
```

- `a` (`number!` `money!` `time!` `pair!` `date!`)
- `b` (`number!` `money!` `time!` `pair!` `date!`)

(fn--)=
## -

The difference of two values.

An operator, written between its values: `a - b` is `subtract a b` (see [`subtract`](#fn-subtract)).

```text
a - b
```

- `a` (`number!` `money!` `time!` `pair!` `date!`)
- `b` (`number!` `money!` `time!` `pair!` `date!`)

(fn--2a)=
## \*

The product of two values.

An operator, written between its values: `a * b` is `multiply a b` (see [`multiply`](#fn-multiply)).

```text
a * b
```

- `a` (`number!` `money!` `time!` `pair!` `date!`)
- `b` (`number!` `money!` `time!` `pair!` `date!`)

(fn--2f)=
## /

The first value divided by the second.

An operator, written between its values: `a / b` is `divide a b` (see [`divide`](#fn-divide)).

```text
a / b
```

- `a` (`number!` `money!` `time!` `pair!` `date!`)
- `b` (`number!` `money!` `time!` `pair!` `date!`)

(fn--2f-2f)=
## //

What is left after dividing the first value by the second.

An operator, written between its values: `a // b` is `remainder a b` (see [`remainder`](#fn-remainder)).

```text
a // b
```

- `a` (`number!` `money!` `time!` `pair!` `date!`)
- `b` (`number!` `money!` `time!` `pair!` `date!`)

(fn--2a-2a)=
## \*\*

The number raised to the exponent.

An operator, written between its values: `number ** exponent` is `power number exponent` (see [`power`](#fn-power)).

```text
number ** exponent
```

- `number` (`number!`)
- `exponent` (`number!`)

(fn--3c-3c)=
## \<\<

Shifts the bits of an integer left.

An operator, written between its values: `data << bits` is `shift-left data bits` (see [`shift-left`](#fn-shift-left)).

```text
data << bits
```

- `data` (`integer!`)
- `bits` (`integer!`): How many bits

(fn--3e-3e)=
## \>\>

Shifts the bits of an integer right, keeping its sign.

An operator, written between its values: `data >> bits` is `shift-right data bits` (see [`shift-right`](#fn-shift-right)).

```text
data >> bits
```

- `data` (`integer!`)
- `bits` (`integer!`): How many bits

(fn--3e-3e-3e)=
## \>\>\>

Shifts the bits of an integer right, shifting zeros in.

An operator, written between its values: `data >>> bits` is `shift-logical data bits` (see [`shift-logical`](#fn-shift-logical)).

```text
data >>> bits
```

- `data` (`integer!`)
- `bits` (`integer!`): How many bits
