<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Functions

Functions that make functions, leave them, and look into them. `func` and `function` differ in what a word
set inside the body becomes: in `function` it is local by itself. See [functions](../language/05-functions.md).

(fn-func)=
## func

Makes a function from a spec and a body.

```text
func spec body
```

- `spec` (`block!`)
- `body` (`block!`)

(fn-function)=
## function

A function whose set-words in the body are local.

```text
function spec body
```

- `spec` (`block!`)
- `body` (`block!`)

(fn-does)=
## does

A function with no arguments.

```text
does body
```

- `body` (`block!`)

(fn-has)=
## has

A function with only local words.

```text
has locals body
```

- `locals` (`block!`)
- `body` (`block!`)

(fn-closure)=
## closure

Makes a function from a spec and a body.

```text
closure spec body
```

- `spec` (`block!`)
- `body` (`block!`)

(fn-return)=
## return

Leaves the function it is in, giving a value.

```text
return value
```

- `value` (`any-type!`)

(fn-exit)=
## exit

Leaves the function it is in, giving no value.

```text
exit
```

(fn-apply)=
## apply

Calls a function with the arguments in a block.

```text
apply func block
```

- `func` (`any-function!`)
- `block` (`block!`)
- `/only`

(fn-spec-of)=
## spec-of

A copy of a function's spec block.

```text
spec-of value
```

- `value` (`any-function!`)

(fn-body-of)=
## body-of

A copy of a function's body block, or none for a native; for an object, its fields as field: value.

```text
body-of value
```

- `value` (`any-function!` `any-object!`)
