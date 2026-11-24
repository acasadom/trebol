# Text

Making text from values, and changing text. `form` gives text for people to read, `mold` text that `load`
reads back as the same value. A block or object that holds itself shows as `[...]` in `mold` and `...` in
`form`, and values nested any depth are written. Strings are series too, so every series function works on
them. See [text](../language/09-text.md).

## form

## mold

## reform

## rejoin

## ajoin

## reword

## uppercase

## lowercase

## trim

## split

## iban?

Spaces between the groups and small letters are fine: `iban? "es91 2100 0418 4502 0005 1332"` is true. The
country must be one that has IBANs, and the length its own. It checks that the IBAN is well made, not that the
account exists.
