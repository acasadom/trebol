<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Screens

The functions of the UI dialect: showing a layout as the page, the theme, dialogs and toasts, screens with
links, and the values of forms. See [building screens](../ui/01-first-screen.md).

(fn-view)=
## view

Shows a layout (a block of the dialect, or a face from layout) as the page.

```text
view spec
```

- `spec` (`block!` `object!`)

(fn-layout)=
## layout

Turns a block of the UI dialect into a view face; /only gives the block of faces.

```text
layout spec
```

- `spec` (`block!`)
- `/only`: Return the faces, not a view holding them

(fn-stylize)=
## stylize

Defines styles from existing ones: name: base \[field: value ...\]

```text
stylize spec
```

- `spec` (`block!`)

(fn-theme)=
## theme

Sets the theme: a look by name (theme 'civic), or parameters (theme \[look: civic base: 200 mode: dark\]).

```text
theme spec
```

- `spec` (`block!` `word!`)

(fn-open)=
## open

Shows a dialog.

```text
open dialog
```

- `dialog` (`object!`)

(fn-close)=
## close

Hides a dialog; closes a stream.

```text
close target
```

- `target` (`object!` `handle!`)

(fn-confirm)=
## confirm

Asks a question in a small dialog and waits: true when the user says yes.

```text
confirm question
```

- `question` (`string!` `map!` `word!`): A text, a text per language, or a word of the dictionary
- `/with choices` (`block!`): The answers, yes first
- `/role kind` (`word!`): primary (the default) or danger, for what cannot be undone

The yes answer shows with the role's color, `primary` unless `/role` says `danger`; with `danger` the no has the
focus first, so Enter does not do what cannot be undone. Esc answers no. The question and the answers are
translated as `toast`'s message is. The handler that asks waits for the answer; the rest of the page goes on.

(fn-toast)=
## toast

Shows a short notice that goes away by itself.

```text
toast message
```

- `message` (`string!` `map!` `word!`): A text, a text per language, or a word of the dictionary
- `/role kind` (`word!`): primary, success, warning or danger

(fn-go)=
## go

Shows a screen and gives the page its link: go 'clients, go \[client row/id\] (the name is not evaluated, the arguments are).

```text
go target
```

- `target` (`word!` `block!` `path!`)

(fn-go-back)=
## go-back

Returns to the screen the user came from; if they came from outside the page, goes to target.

```text
go-back target
```

- `target` (`word!` `block!` `path!`)

(fn-go-forward)=
## go-forward

Goes to the screen the user came back from, if there is one; true if it went.

```text
go-forward
```

(fn-can-go-back-3f)=
## can-go-back?

True if a screen of this page lies behind the current one in the browser's history.

```text
can-go-back?
```

(fn-can-go-forward-3f)=
## can-go-forward?

True if a screen of this page lies ahead of the current one: the user went back and has not gone elsewhere since.

```text
can-go-forward?
```

(fn-form-values)=
## form-values

The values of the named fields of a form (or view), as a map.

```text
form-values scope
```

- `scope` (any value)

(fn-set-values)=
## set-values

Fills the named fields of a form (or view) from a map or object; none clears them.

```text
set-values scope data
```

- `scope` (any value)
- `data` (`map!` `object!` `none!`)

(fn-field-error)=
## field-error

Shows a message on a named field until the user changes it: what a server refused. False if there is no such field.

```text
field-error scope name text
```

- `scope` (any value)
- `name` (`word!` `string!`)
- `text` (`string!`)

(fn-validate-face)=
## validate-face

Checks a face's rules; returns a message or none.

```text
validate-face f
```

- `f` (any value)
