<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Errors

An error is a value: `try` catches one and gives it, `cause-error` makes one happen. `catch` and `throw` leave
a block from deep inside it, which is not an error at all. See [errors](../language/07-errors.md).

(fn-try)=
## try

Evaluates a block; gives an error as a value instead of raising it.

```text
try body
```

- `body` (`block!`)

(fn-attempt)=
## attempt

Evaluates a block; gives none if it raises an error.

```text
attempt body
```

- `body` (`block!`)

(fn-catch)=
## catch

Evaluates a block; gives the value a throw inside it threw.

```text
catch body
```

- `body` (`block!`)
- `/name word` (`word!` `block!`)

(fn-throw)=
## throw

Throws a value to the catch around it.

```text
throw value
```

- `value` (`any-value!`)
- `/name word` (`word!`)

(fn-cause-error)=
## cause-error

Raises an error of a type and an id.

```text
cause-error type id args
```

- `type` (`word!`)
- `id` (`word!`)
- `args` (`any-value!`)
