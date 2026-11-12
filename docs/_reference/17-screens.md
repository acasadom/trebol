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

## toast

## go

## go-back

## go-forward

## can-go-back?

## can-go-forward?

## form-values

## set-values

## field-error

## validate-face
