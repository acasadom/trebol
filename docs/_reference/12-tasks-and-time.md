# Tasks and time

The date and time of now, and tasks: work that waits, for the network or for a time, while the rest of the
program goes on. See [tasks and the network](../language/12-tasks-and-network.md).

## now

## wait

## delay

## every

Each tick starts the block as a new task, whether the run before is over or not. A block that takes longer
than the period, waiting for the network or with `wait`, runs alongside its earlier runs: a block of 3 seconds
every second has three runs going. To skip a tick while a run is still going, keep a flag, as in
[tasks and the network](../language/12-tasks-and-network.md). `cancel` stops the ticks; runs already started go
on to their end.

## spawn

## cancel
