# Errors

An error is a value: `try` catches one and gives it, `cause-error` makes one happen. `catch` and `throw` leave
a block from deep inside it, which is not an error at all. See [errors](../language/07-errors.md).

## try

## attempt

## catch

## throw

## cause-error

## loaded-at

The place an error's `At` names, for any value of a block: a dialect uses it to say where a problem in the
block it reads is. A block made by code (`append`, `compose`, `reduce`) has no place for what was put in it.

```trebol-console
>> loaded-at next [bike saddle]
== "1:22"
```
