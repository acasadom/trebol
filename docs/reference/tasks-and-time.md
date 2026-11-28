<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->

# Tasks and time

The date and time of now, and tasks: work that waits, for the network or for a time, while the rest of the
program goes on. See [tasks and the network](../language/12-tasks-and-network.md).

(fn-now)=
## now

The date and time now.

```text
now
```

- `/year`
- `/month`
- `/day`
- `/time`
- `/zone`
- `/date`
- `/weekday`
- `/yearday`
- `/precise`
- `/utc`

(fn-wait)=
## wait

Waits a number of seconds, or for tasks to finish; other tasks run meanwhile.

```text
wait value
```

- `value` (`number!` `time!` `handle!` `block!`)

(fn-delay)=
## delay

Evaluates a block once, after a while; gives a handle.

```text
delay time body
```

- `time` (`number!` `time!`)
- `body` (`block!`)

(fn-every)=
## every

Evaluates a block again and again, every so often; gives a handle.

```text
every time body
```

- `time` (`number!` `time!`)
- `body` (`block!`)

Each tick starts the block as a new task, whether the run before is over or not. A block that takes longer
than the period, waiting for the network or with `wait`, runs alongside its earlier runs: a block of 3 seconds
every second has three runs going. To skip a tick while a run is still going, keep a flag, as in
[tasks and the network](../language/12-tasks-and-network.md). `cancel` stops the ticks; runs already started go
on to their end.

(fn-spawn)=
## spawn

Starts a task that evaluates a block on its own; gives a handle at once.

```text
spawn body
```

- `body` (`block!`)

(fn-cancel)=
## cancel

Stops a task, timer or request.

```text
cancel target
```

- `target` (`handle!`)
