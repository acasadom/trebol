# Screens

The functions of the UI dialect: showing a layout as the page, the theme, dialogs and toasts, screens with
links, and the values of forms. See [building screens](../ui/01-first-screen.md).

## view

## layout

## stylize

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
