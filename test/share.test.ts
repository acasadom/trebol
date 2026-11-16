// Shared machines: several tabs of one app played by several hosts in one
// process, with a channel and locks that behave as the browser's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mold, form, errorField, type ObjectCell } from '../src/core/index.ts';
import { startHost, runSource, setShareEnv, type ShareEnv, type ChannelLike, type Envelope, type Host } from '../src/host/index.ts';

/** The browser of these tests: channels and locks shared by its tabs. */
class Browser {
  channels: Array<{ tab: string; name: string; ch: ChannelLike }> = [];
  locks = new Map<string, { holder: string | null; queue: Array<{ tab: string; fn: (l: unknown) => unknown }> }>();
  frozen = new Set<string>();

  env(tab: string): ShareEnv {
    return {
      channel: name => {
        const ch: ChannelLike = {
          onmessage: null,
          postMessage: (e: Envelope) => {
            for (const o of this.channels) {
              if (o.ch === ch || o.name !== name || this.frozen.has(o.tab)) continue;
              const copy = structuredClone(e);
              setTimeout(() => o.ch.onmessage?.({ data: copy }), 0);
            }
          },
          close: () => { this.channels = this.channels.filter(o => o.ch !== ch); },
        };
        this.channels.push({ tab, name, ch });
        return ch;
      },
      locks: () => ({
        request: (name: string, a: unknown, b?: unknown) => {
          const ifAvailable = typeof a === 'object';
          const fn = (ifAvailable ? b : a) as (l: unknown) => unknown;
          const l = this.locks.get(name) ?? { holder: null, queue: [] };
          this.locks.set(name, l);
          if (l.holder === null) {
            l.holder = tab;
            fn({ name });
          } else if (ifAvailable) {
            fn(null);
          } else {
            l.queue.push({ tab, fn });
          }
          return new Promise(() => {});
        },
      }),
    };
  }

  /** A tab closes: its channels go and its locks pass to the next tab waiting. */
  close(tab: string): void {
    this.channels = this.channels.filter(o => o.tab !== tab);
    for (const l of this.locks.values()) {
      l.queue = l.queue.filter(q => q.tab !== tab);
      if (l.holder !== tab) continue;
      const next = l.queue.shift();
      l.holder = next?.tab ?? null;
      next?.fn({});
    }
  }
}

const SPEC = `cart: machine [
    shared cart
    data [items: 0]
    initial empty
    state empty [on-enter [entered: entered + 1]]
    state full [on-enter [entered: entered + 1]]
    from empty to full on add set [items: data/items + event/n]
    from full to full on add set [items: data/items + event/n]
    from full to empty on clear set [items: 0]
]`;

function tab(b: Browser, name: string): Host {
  const h = startHost({ onError: () => {} });
  setShareEnv(h.rt, b.env(name));
  return h;
}

const run = async (h: Host, src: string) => {
  try {
    return mold(await runSource(h, src));
  } catch (e) {
    throw new Error(form(errorField(e as ObjectCell, 'message')));
  }
};
const settle = () => new Promise(r => setTimeout(r, 20));

test('a second tab gets a copy of the machine the first one runs', async () => {
  const b = new Browser();
  const a = tab(b, 'a');
  const c = tab(b, 'c');
  await run(a, `entered: 0 ${SPEC}`);
  assert.equal(await run(c, `entered: 0 ${SPEC} cart/state`), 'empty');
  assert.equal(await run(c, 'cart/owner'), 'false');
  // the event of the copy runs in the owner's tab, and send gives the new state
  assert.equal(await run(c, 'send cart [add n: 2]'), 'full');
  assert.equal(await run(c, 'cart/data/items'), '2');
  assert.equal(await run(a, 'reduce [cart/state cart/data/items entered]'), '[full 2 2]');
  // on-enter ran only where the machine runs
  assert.equal(await run(c, 'entered'), '0');
  // what the owner does reaches the copy
  await run(a, 'send cart [add n: 3]');
  await settle();
  assert.equal(await run(c, 'reduce [cart/state cart/data/items in? cart \'full]'), '[full 5 true]');
  assert.equal(await run(c, 'select snapshot cart \'data'), '[items: 5]');
  // restart from the copy restarts the owner's machine
  await run(c, 'restart cart');
  assert.equal(await run(a, 'reduce [cart/state cart/data/items]'), '[empty 0]');
  assert.equal(await run(c, 'reduce [cart/state cart/data/items]'), '[empty 0]');
});

test('when the owner tab closes another tab goes on where it was', async () => {
  const b = new Browser();
  const a = tab(b, 'a');
  const c = tab(b, 'c');
  const d = tab(b, 'd');
  await run(a, `entered: 0 ${SPEC}`);
  await run(c, `entered: 0 ${SPEC}`);
  await run(d, `entered: 0 ${SPEC}`);
  await run(c, 'send cart [add n: 4]');
  await settle();
  b.close('a');
  await settle();
  // c asked for the lock first: it owns the machine now, with no on-enter run again
  assert.equal(await run(c, 'reduce [cart/owner cart/state cart/data/items entered]'), '[true full 4 0]');
  assert.equal(await run(d, 'send cart [add n: 1]'), 'full');
  assert.equal(await run(c, 'cart/data/items'), '5');
  // a tab opened now is a copy of c's
  const e = tab(b, 'e');
  assert.equal(await run(e, `entered: 0 ${SPEC} reduce [cart/owner cart/data/items]`), '[false 5]');
});

test('what a tab was sending when the owner went is not lost', async () => {
  const b = new Browser();
  const a = tab(b, 'a');
  const c = tab(b, 'c');
  const d = tab(b, 'd');
  await run(a, `entered: 0 ${SPEC}`);
  await run(c, `entered: 0 ${SPEC}`);
  await run(d, `entered: 0 ${SPEC}`);
  // the owner hears nothing more: the events of c and d wait
  b.frozen.add('a');
  const fromC = run(c, 'send cart [add n: 1]');
  const fromD = run(d, 'send cart [add n: 10]');
  await settle();
  b.close('a');
  // c takes over and runs its own event; d sends its own again to c
  assert.equal(await fromC, 'full');
  assert.equal(await fromD, 'full');
  assert.equal(await run(c, 'cart/data/items'), '11');
  await settle();
  assert.equal(await run(d, 'cart/data/items'), '11');
});

test('on-save runs only in the tab that runs the machine', async () => {
  const b = new Browser();
  const a = tab(b, 'a');
  const c = tab(b, 'c');
  const spec = SPEC.replace('shared cart', 'shared cart on-save [saves: saves + 1]');
  await run(a, `entered: 0 saves: 0 ${spec}`);
  await run(c, `entered: 0 saves: 0 ${spec}`);
  await run(c, 'send cart [add n: 1]');
  assert.equal(await run(c, 'saves'), '0');
  assert.equal(await run(a, 'saves > 0'), 'true');
});

test('a tab resumes from a snapshot only when no other tab runs the machine', async () => {
  const b = new Browser();
  const a = tab(b, 'a');
  await run(a, `entered: 0 ${SPEC.replace('cart: machine [', 'cart: machine/from [')} [on [[full]] data [items: 7] history [] results [] deferred [] timers [] ttl #[none] tasks [] done #[false] outcome #[none] last #[none]]`);
  assert.equal(await run(a, 'reduce [cart/state cart/data/items entered]'), '[full 7 0]');
  const c = tab(b, 'c');
  await run(c, `entered: 0 ${SPEC.replace('cart: machine [', 'cart: machine/from [')} [on [[empty]] data [items: 0] history [] results [] deferred [] timers [] ttl #[none] tasks [] done #[false] outcome #[none] last #[none]]`);
  assert.equal(await run(c, 'reduce [cart/owner cart/state cart/data/items]'), '[false full 7]');
});

test('with no locks the machine stays in its own tab', async () => {
  const h = startHost({ onError: () => {} });
  setShareEnv(h.rt, { channel: () => assert.fail('no channel without locks'), locks: () => null });
  assert.equal(await run(h, `entered: 0 ${SPEC} send cart [add n: 1] reduce [cart/owner cart/channel cart/data/items]`), '[true none 1]');
});
