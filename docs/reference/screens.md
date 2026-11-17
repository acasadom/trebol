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

(fn-rule)=
## rule

Adds a rule that a face takes by its name, as it takes required: rule 'even "Enter an even number" \[even? value\]

```text
rule name message body
```

- `name` (`word!`)
- `message` (`string!` `map!` `block!`): What a face that breaks it says: a text, or a text per language
- `body` (`block!`): Sees value, face and values; gives true when the value is good, none or false for the message, or a string to say instead

A rule made with `rule` goes after a field like the ones Trebol has, by its name: `field account "Account"
iban`. Its block runs with `value`, `face` and `values` as a `check` does, only when the field has a value;
`required` still says when it must have one. It gives true when the value is good, none or false for the
rule's message, or a string to show instead. The message is kept in `i18n/ui` under the rule's name, so an
app may change it, or add a language, as with Trebol's own messages. A name the dialect already has, or one of
Trebol's texts, is an error. Packages add their rules this way: importing the package is enough.

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

(fn-print-page)=
## print-page

Opens the browser's print dialog for the screen.

```text
print-page
```

- `/only face` (`object!`): Print just this face and what is inside it

The browser's own print dialog opens, where the user can also save a PDF. With `/only`, only that face prints, at
the top of the page; it must be on the screen, or it is an error. Toasts and closed dialogs never print.

(fn-toast)=
## toast

Shows a short notice that goes away by itself.

```text
toast message
```

- `message` (`string!` `map!` `word!`): A text, a text per language, or a word of the dictionary
- `/role kind` (`word!`): primary, success, warning or danger
- `/undo back` (`block!`): With an Undo button, for what was just done: back runs if the user clicks it
- `/then done` (`block!`): Runs done when the notice goes without Undo: what waits for it, such as the delete on the server

A toast stays four seconds, six with the `danger` role; a click dismisses it sooner. With `/undo` it has an
*Undo* button and stays eight seconds, waiting while the pointer or the keyboard is on it; Ctrl+Z (⌘Z) out
of a box of text clicks the newest one. The `/then` block runs when the notice goes without *Undo*: when its
time passes, the person clicks it away, the app goes to another screen, or the page is hidden. Both blocks
keep the words of the handler that showed the notice, such as `row`.

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

(fn-unsaved)=
## unsaved

Marks the screen on show as having changes not saved, or not: leaving it asks first, and so does closing the page.

```text
unsaved on
```

- `on` (`logic!`)

Leaving a screen marked `unsaved yes` asks first: «Leave without saving?», translated, with the `danger`
role, unless the screen has an `on-leave` of its own that decides. While the mark is on, the browser also asks
before the page is closed or reloaded, with its own words, since no browser lets a page give that text. The
mark is put on and taken off by code, `unsaved no` once the changes are saved; a screen entered anew starts
without it.

(fn-unsaved-3f)=
## unsaved?

True if the screen on show has changes not saved (unsaved).

```text
unsaved?
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

(fn-insert-text)=
## insert-text

Puts text where the cursor of a field, area or rich text was last, in place of what was selected, as if the user typed it.

```text
insert-text face text
```

- `face` (`object!`)
- `text` (`string!`)

For a `field`, `area` or `rich`. The text goes where the user's cursor was last, even after a click on a
button or a choice took the focus away, and the cursor ends after it; with no cursor yet, at the end. It counts
as the user's typing: the face's value changes and its `on-change` runs. In a `rich` the text is plain, never
Markdown. A read-only or disabled face is left as it is; under `trebol test` the text always goes at the end.

```trebol-ui
view [
    global gap: choice "Gap" ["{{name}}" "{{date}}"]
    button "Insert gap" [if gap/value [insert-text letter gap/value]]
    global letter: rich "Letter"
]
```

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
