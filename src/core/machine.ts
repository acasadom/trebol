// Machines: statecharts written as a dialect, `machine [...]`, and the engine
// that runs them, all in Trebol. Evaluated into lib after the mezzanines by
// `makeRuntime`, so every program has them, with or without a UI.
//
// The semantics follow UML statecharts: a transition leaves the states up to
// the one the source and the target share, innermost first, and enters down
// to the target, outermost first; each level runs only its own hooks.

//
// The Trebol code is in machine/, a file per part, joined here in order.

import { SPEC } from './machine/spec.ts';
import { CHECKS } from './machine/checks.ts';
import { RUNNING } from './machine/running.ts';
import { EVENTS } from './machine/events.ts';
import { SNAPSHOT } from './machine/snapshot.ts';
import { SHARED } from './machine/shared.ts';
import { WORDS } from './machine/words.ts';

export const MACHINE = `\n${[SPEC, CHECKS, RUNNING, EVENTS, SNAPSHOT, SHARED, WORDS].map(part => part.slice(1)).join('')}`;
