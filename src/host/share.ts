// Host natives for shared machines: one machine for every tab or window of the
// same app. One tab owns it (it holds a Web Lock named after it) and runs it;
// the others keep a copy, which a BroadcastChannel keeps up to date and which
// sends its events to the owner. The machine engine (src/core/machine.ts)
// uses these natives only when the host has them.

import { K, NONE, TRUE, FALSE, string, block, text, throwError, type Cell, type BlockCell, type StringCell, type Runtime } from '../core/index.ts';
import { native, value } from '../core/natives/define.ts';
import { schedulerOf, hasScheduler, spawnHandler, taskResult, makeHandle, handleOf } from './scheduler.ts';

/** What travels on the channel: text is a value molded with mold/all. */
export interface Envelope {
  from: string;
  text: string;
  /** The id of an ask: the one who sent it waits for an envelope that acks it. */
  ask?: string;
  acks?: string[];
  /** A new owner: every tab sends again what it is still waiting for. */
  fresh?: boolean;
}

export interface ChannelLike {
  postMessage(e: Envelope): void;
  onmessage: ((e: { data: Envelope }) => void) | null;
  close(): void;
}

export interface LocksLike {
  request(name: string, options: { ifAvailable: true }, fn: (lock: unknown) => Promise<void> | void): Promise<unknown>;
  request(name: string, fn: (lock: unknown) => Promise<void> | void): Promise<unknown>;
}

/** Where a runtime finds channels and locks: the browser's, or a test's. */
export interface ShareEnv {
  channel(name: string): ChannelLike | null;
  locks(): LocksLike | null;
}

const browserEnv: ShareEnv = {
  channel: name => {
    const B = (globalThis as { BroadcastChannel?: new (n: string) => ChannelLike & { unref?: () => void } }).BroadcastChannel;
    if (B === undefined) return null;
    const ch = new B(name);
    // in Node a channel would keep the process alive
    ch.unref?.();
    return ch;
  },
  locks: () => (globalThis as { navigator?: { locks?: LocksLike } }).navigator?.locks ?? null,
};

const envs = new WeakMap<Runtime, ShareEnv>();

/** Gives a runtime its own channels and locks (tests play several tabs in one process). */
export function setShareEnv(rt: Runtime, env: ShareEnv): void {
  envs.set(rt, env);
}

const envOf = (rt: Runtime): ShareEnv => envs.get(rt) ?? browserEnv;

interface Share {
  me: string;
  ch: ChannelLike;
  serial: number;
  /** Asks sent and not acked yet: id -> text and who waits. */
  waiting: Map<string, { text: string; done: () => void }>;
}

/** A lock held until the page goes. */
const forever = (): Promise<void> => new Promise(() => {});

const str = (c: Cell): string => text(c as StringCell);

native('share-open', '["Opens the channel of a shared machine; none when the host has none." name [string!] heard [block!]]', (t, f) => {
  // with no locks there is no telling who owns the machine, and with no scheduler (the core
  // alone, as in Node with no host) nothing could hear the other tabs: it stays in this tab
  const env = envOf(t.rt);
  const ch = env.locks() === null || !hasScheduler(t.rt) ? null : env.channel(str(f.args[0]!));
  if (ch === null) return value(NONE);
  const sch = schedulerOf(t);
  const heard = f.args[1] as BlockCell;
  const sh: Share = { me: Math.random().toString(36).slice(2), ch, serial: 0, waiting: new Map() };
  ch.onmessage = async ({ data: env }) => {
    if (env.from === sh.me) return;
    try {
      await taskResult(spawnHandler(sch, heard, { message: string(env.text), asked: env.ask === undefined ? NONE : string(env.ask) }));
    } catch {
      // the scheduler has reported it
    }
    settle(sh, env.acks);
    if (env.fresh) for (const [id, w] of sh.waiting) ch.postMessage({ from: sh.me, text: w.text, ask: id });
  };
  return value(makeHandle('share', sh));
});

function settle(sh: Share, acks: string[] | undefined): void {
  for (const id of acks ?? []) {
    const w = sh.waiting.get(id);
    if (w === undefined) continue;
    sh.waiting.delete(id);
    w.done();
  }
}

const notShared = () => throwError('script', 'bad-share', 'not the channel of a shared machine');

native('share-post', '["Sends a value to every other tab; acks are asks it answers, also this tab\'s own." channel [handle!] message [string!] acks [block!] fresh [logic!]]', (_t, f) => {
  const sh = handleOf<Share>(f.args[0]!, 'share');
  if (sh === null) return notShared();
  const acks = (f.args[2] as BlockCell).s.data.slice((f.args[2] as BlockCell).i).map(str);
  const env: Envelope = { from: sh.me, text: str(f.args[1]!) };
  if (acks.length > 0) env.acks = acks;
  if (f.args[3]!.t === K.Logic && f.args[3]!.v) env.fresh = true;
  sh.ch.postMessage(env);
  settle(sh, acks);
  return value(NONE);
});

native('share-ask', '["Sends a value to the owner and waits until an answer acks it." channel [handle!] message [string!]]', (_t, f, v) => {
  // called again with what the wait gave
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  const sh = handleOf<Share>(f.args[0]!, 'share');
  if (sh === null) return notShared();
  const msg = str(f.args[1]!);
  const id = `${sh.me}-${++sh.serial}`;
  return {
    k: 'await',
    p: new Promise<Cell>(resolve => {
      sh.waiting.set(id, { text: msg, done: () => resolve(NONE) });
      sh.ch.postMessage({ from: sh.me, text: msg, ask: id });
    }),
  };
});

native('share-asks', '["What this tab asked and is still waiting for, as a block of id and message." channel [handle!]]', (_t, f) => {
  const sh = handleOf<Share>(f.args[0]!, 'share');
  if (sh === null) return notShared();
  const out: Cell[] = [];
  for (const [id, w] of sh.waiting) out.push(string(id), string(w.text));
  return value(block(out));
});

native('share-lock', '["Takes the lock of a shared machine if it is free (true); else gives false and evaluates took when it comes free." name [string!] took [block!]]', (t, f, v) => {
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  const locks = envOf(t.rt).locks();
  if (locks === null || !hasScheduler(t.rt)) return value(TRUE);
  const sch = schedulerOf(t);
  const name = str(f.args[0]!);
  const took = f.args[1] as BlockCell;
  return {
    k: 'await',
    p: new Promise<Cell>(resolve => {
      void locks.request(name, { ifAvailable: true }, lock => {
        if (lock !== null) {
          resolve(TRUE);
          return forever();
        }
        resolve(FALSE);
        void locks.request(name, () => {
          spawnHandler(sch, took, {});
          return forever();
        });
        return undefined;
      });
    }),
  };
});
