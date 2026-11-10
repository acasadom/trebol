<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Words and contexts

A word names a value in a context: the context it is bound to. These functions read and set what words name,
bind words to contexts, and look into objects and maps. See [words and blocks](../language/03-words-and-blocks.md)
and [contexts](../language/10-contexts.md).

(fn-get)=
## get

The value a word refers to.

```text
get word
```

- `word` (`any-word!`)
- `/any`

(fn-set)=
## set

Sets a word, or each word of a block, to a value.

```text
set word value
```

- `word` (`any-word!` `block!`)
- `value` (`any-type!`)

(fn-unset)=
## unset

Takes the value away from a word, or from each word of a block.

```text
unset word
```

- `word` (`any-word!` `block!`)

(fn-in)=
## in

The word of an object, bound to it, or none if the object has no such word.

```text
in object word
```

- `object` (`any-object!`)
- `word` (`any-word!`)

(fn-use)=
## use

Evaluates a block with words of its own, which exist only inside it.

```text
use words body
```

- `words` (`block!` `word!`)
- `body` (`block!`)

(fn-bind)=
## bind

Binds the words of a block to a context.

```text
bind words context
```

- `words` (`block!` `any-word!`)
- `context` (`any-word!` `any-object!`)
- `/new`
- `/copy`: Binds a deep copy and leaves the block as it was

(fn-bound-3f)=
## bound?

The context a word is bound to, or none.

```text
bound? word
```

- `word` (`any-word!`)

(fn-context-3f)=
## context?

The context a word is bound to, or none.

```text
context? word
```

- `word` (`any-word!`)

(fn-context)=
## context

Makes an object.

```text
context spec
```

- `spec` (`block!`)

(fn-collect-words)=
## collect-words

The words used in a block, each once.

```text
collect-words block
```

- `block` (`block!`)
- `/deep`
- `/set`
- `/ignore words` (`block!`)

(fn-words-of)=
## words-of

The words of an object or map, or the arguments, refinements and local words of a function.

```text
words-of value
```

- `value` (`any-object!` `map!` `any-function!`)

(fn-values-of)=
## values-of

The values of an object or map.

```text
values-of value
```

- `value` (`any-object!` `map!`)

(fn-default)=
## default

Sets a word to a value if it has none yet; gives the word's value.

```text
default 'word value
```

- `'word` (`word!` `set-word!`)
- `value` (any value)
