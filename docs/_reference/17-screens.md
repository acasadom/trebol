# Screens

The functions of the UI dialect: showing a layout as the page, the theme, dialogs and toasts, screens with
links, and the values of forms. See [building screens](../ui/01-first-screen.md).

## view

`view` of a block lays it out first, as `layout` does; given a face from `layout`, it shows that one. The view
becomes the page, held by the word `page`, and its `screens`, if it has some, follow the browser's link.

## layout

Gives the view face that `view` would show, without showing it, so code can change it first. With `/only` it
gives the block of faces, with no view around them, to put in a container: `box/pane: layout/only [text "New"]`
draws them in place of the faces it held, and `append box/pane layout/only [...]`, `insert`, `remove` and
`clear` on the pane draw it again too. The new faces join the view and the form they are put in: a field is one
of the form's values, and its checks show. A block made with `compose` lays out the values code puts in it, so
faces can come from data. Each layout copies its block, so laying out the same block twice gives faces of their
own; the names it gives are local to it, unless written with `global`.

## stylize

## rule

A rule made with `rule` goes after a field like the ones Trebol has, by its name: `field account "Account"
iban`. Its block runs with `value`, `face` and `values` as a `check` does, only when the field has a value;
`required` still says when it must have one. It gives true when the value is good, none or false for the
rule's message, or a string to show instead. The message is kept in `i18n/ui` under the rule's name, so an
app may change it, or add a language, as with Trebol's own messages. A name the dialect already has, or one of
Trebol's texts, is an error. Packages add their rules this way: importing the package is enough.

## add-rule

What a style of your own does with a rule it reads: in a `done:` function, `add-rule f reduce ['max f/most]`
gives the face the rule `max`, as writing `max 5` after it would.

## theme

## open

## close

## confirm

The yes answer shows with the role's color, `primary` unless `/role` says `danger`; with `danger` the no has the
focus first, so Enter does not do what cannot be undone. Esc answers no. The question and the answers are
translated as `toast`'s message is. The handler that asks waits for the answer; the rest of the page goes on.

## print-page

The browser's own print dialog opens, where the user can also save a PDF. With `/only`, only that face prints, at
the top of the page; it must be on the screen, or it is an error. Toasts and closed dialogs never print.

## toast

A toast stays four seconds, six with the `danger` role; a click dismisses it sooner. With `/undo` it has an
*Undo* button and stays eight seconds, waiting while the pointer or the keyboard is on it; Ctrl+Z (⌘Z) out
of a box of text clicks the newest one. The `/then` block runs when the notice goes without *Undo*: when its
time passes, the person clicks it away, the app goes to another screen, or the page is hidden. Both blocks
keep the words of the handler that showed the notice, such as `row`.

## go

## go-back

## go-forward

## can-go-back?

## can-go-forward?

## unsaved

Leaving a screen marked `unsaved yes` asks first: «Leave without saving?», translated, with the `danger`
role, unless the screen has an `on-leave` of its own that decides. While the mark is on, the browser also asks
before the page is closed or reloaded, with its own words, since no browser lets a page give that text. The
mark is put on and taken off by code, `unsaved no` once the changes are saved; a screen entered anew starts
without it.

## unsaved?

## form-values

## set-values

## insert-text

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

## field-error

## validate-face
