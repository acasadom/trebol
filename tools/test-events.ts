// Streams of server-sent events in screen tests: `serve [EVENTS "/api/events"]` declares one, the app's
// open-events gets a stream the test writes to with `push`, and `end-events` ends it so the app opens it
// again. Each step waits until the handlers it set off in the app have run, as `see` waits for cached.

import {
  K, native, value, text, form, spell, toJson, makeError, throwError,
  type Cell, type StringCell, type WordCell,
} from '../src/core/index.ts';
import { taskResult, type HostTask } from '../src/host/scheduler.ts';
import { streamTap, type Stream } from '../src/host/net/streams.ts';

const TRUE: Cell = { t: K.Logic, v: true };

/** How long a step waits for the app before it is an error. */
const PATIENCE = 2000;

/** A stream the app has open on the test's server. */
interface Served { path: string; ctl: ReadableStreamDefaultController<Uint8Array> }

/** What a step waits for the app to do on a path: run its handlers of one of these kinds. */
interface Waiter { path: string; kinds: string[]; done: (tasks: HostTask[]) => void }

let served: Served[] = [];
let waiters: Waiter[] = [];
/** The app's streams of events, closed when the test ends so none tries again after it. */
let streams = new Set<Stream>();

const pathOf = (url: string): string => new URL(url, 'http://app.test').pathname;
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

function tap(st: Stream, kind: string, tasks: HostTask[]): void {
  streams.add(st);
  const path = pathOf(st.url);
  const i = waiters.findIndex(w => w.path === path && w.kinds.includes(kind));
  if (i >= 0) waiters.splice(i, 1)[0]!.done(tasks);
}

/** Starts a test with no streams; ends those of the test before. */
export function resetEvents(): void {
  for (const st of streams) st.close();
  for (const s of served) s.ctl.close();
  streams = new Set();
  served = [];
  waiters = [];
  streamTap.fn = tap;
}

/** The answer to an open-events of a path that serve declared with EVENTS: a stream left open. */
export function eventsResponse(url: string): Response {
  const path = pathOf(url);
  let me: Served;
  const body = new ReadableStream<Uint8Array>({
    start(ctl) {
      me = { path, ctl };
      served.push(me);
      // a reconnection in a test comes at once, not after a second
      ctl.enqueue(bytes('retry: 1\n\n'));
    },
    cancel() {
      served = served.filter(s => s !== me);
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

/** Waits until the app ran its handlers of these kinds on the path; an error after PATIENCE. */
function waitFor(path: string, kinds: string[], what: string): Promise<Cell> {
  return new Promise((resolve, reject) => {
    const w: Waiter = {
      path, kinds,
      done: tasks => {
        clearTimeout(timer);
        Promise.all(tasks.map(taskResult)).then(() => resolve(TRUE), reject);
      },
    };
    const timer = setTimeout(() => {
      waiters = waiters.filter(x => x !== w);
      reject(makeError('script', 'no-stream', what));
    }, PATIENCE);
    waiters.push(w);
  });
}


/** A refinement that was given. */
const used = (c: Cell | undefined): boolean => c !== undefined && c.t === K.Logic && c.v;

native('push', '["Sends an event on a stream that serve declared with EVENTS; waits until the app ran its on-message." path [string!] data [any-value!] /event "Gives the event a name" event-name [word! string!] /id "Gives the event an id" event-id [any-value!]]', (_t, f) => {
  if (f.phase === 1) return value(TRUE);
  f.phase = 1;
  const a = f.args;
  const path = pathOf(text(a[0] as StringCell));
  const fields: string[] = [];
  if (used(a[2])) fields.push(`event: ${a[3]!.t === K.String ? text(a[3]!) : spell((a[3] as WordCell).sym)}`);
  if (used(a[4])) fields.push(`id: ${form(a[5]!)}`);
  const data = a[1]!;
  for (const line of (data.t === K.String ? text(data) : toJson(data)).split('\n')) fields.push(`data: ${line}`);
  const chunk = bytes(fields.join('\n') + '\n\n');
  const send = (): Promise<Cell> => {
    const got = waitFor(path, ['message'], `push: the app does not read the stream on ${path}`);
    for (const s of served) if (s.path === path) s.ctl.enqueue(chunk);
    return got;
  };
  const p = served.some(s => s.path === path)
    ? send()
    : waitFor(path, ['open'], `push: the app has no stream open on ${path}`).then(send);
  return { k: 'await', p };
});

native('end-events', '["Ends the streams the app has open on a path that serve declared with EVENTS; waits until the app opened it again (on-open) or closed it (on-close)." path [string!]]', (_t, f) => {
  if (f.phase === 1) return value(TRUE);
  f.phase = 1;
  const path = pathOf(text(f.args[0] as StringCell));
  const open = served.filter(s => s.path === path);
  if (open.length === 0) return throwError('script', 'no-stream', `end-events: the app has no stream open on ${path}`);
  const got = waitFor(path, ['open', 'close'], `end-events: the app neither opened ${path} again nor closed it`);
  served = served.filter(s => s.path !== path);
  for (const s of open) s.ctl.close();
  return { k: 'await', p: got };
});
