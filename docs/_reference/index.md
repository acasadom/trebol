# Reference

Every function a Trebol program can call, with what it takes and what it gives. Each entry is read from the
function itself, as `help` shows it in the console, so it is always the function as it is.

An entry starts with what the function does and how it is called: its name, then its arguments in order.
**Takes** lists the kinds of value each argument accepts; a word ending in `!` is a datatype, such as
`integer!`, or a set of them, such as `series!`. **Refinements** are the words written after a slash,
`append/only`, that change what a function does; the arguments a refinement takes follow the call's own.
**Gives** is the kind of value it returns, when the function says so.

The functions are grouped by what they work on. The tutorials show them at work: the
[language tutorial](../language/01-getting-started.md) and [building screens](../ui/01-first-screen.md).
