// A stream of server-sent events, as the browser's EventSource keeps one: when
// it fails or the server ends it, it opens again on the same handle after a
// wait, and says where it was with Last-Event-ID. An answer of 204 or 4xx stops
// it: the server does not want it, or the user is no longer signed in.

import {
  K, NONE, native, value, string, text, form, makeError, throwError, intern, queryText,
  type Cell, type ObjectCell, type StringCell,
} from '../../core/index.ts';
import { schedulerOf, makeHandle } from '../scheduler.ts';
import { field, isOn, pairs } from '../net.ts';
import { emit, messageValue, type Stream } from './streams.ts';

/** One event of the stream, and what the fields around it set. */
export interface SseEvent {
  event: string;
  /** The data lines joined, or null when the block had none: only id or retry, and nothing is dispatched. */
  data: string | null;
  /** The id: field of the block, '' to forget the last one, or null when it had none. */
  id: string | null;
  /** The retry: field in milliseconds, or null. */
  retry: number | null;
}

/** Splits a server-sent events stream into events; gives what is left for the next chunk. */
export function parseSse(buffer: string, onEvent: (e: SseEvent) => void): string {
  let rest = buffer;
  for (;;) {
    const m = /\r?\n\r?\n/.exec(rest);
    if (m === null) return rest;
    const block = rest.slice(0, m.index);
    rest = rest.slice(m.index + m[0].length);
    const e: SseEvent = { event: 'message', data: null, id: null, retry: null };
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const name = colon < 0 ? line : line.slice(0, colon);
      const val = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (name === 'event') e.event = val;
      else if (name === 'data') data.push(val);
      else if (name === 'id' && !val.includes('\0')) e.id = val;
      else if (name === 'retry' && /^\d+$/.test(val)) e.retry = Number(val);
    }
    if (data.length > 0) e.data = data.join('\n');
    onEvent(e);
  }
}

/** How long to wait before the next attempt: after `delay`, double it up to 30 s. */
export const FIRST_DELAY = 1000;
export const LAST_DELAY = 30_000;
export const nextDelay = (delay: number): number => Math.min(delay * 2, LAST_DELAY);

/** What a stream of events keeps between attempts. */
interface Events {
  readonly st: Stream;
  readonly url: string;
  readonly headers: Array<[string, string]>;
  readonly credentials: RequestCredentials;
  readonly reconnect: boolean;
  lastId: string;
  /** The retry: the server asked for, or null. */
  retry: number | null;
  delay: number;
  /** Failed attempts since the last stream that delivered an event. */
  attempt: number;
  opened: boolean;
  stopped: boolean;
  ctl: AbortController;
  wake: (() => void) | null;
}

const word = (s: string): Cell => ({ t: K.Word, sym: intern(s), bind: null });
const integer = (n: number): Cell => ({ t: K.Integer, v: n });

/** Why a stream that should not be asked again stopped. */
class Refused extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

/** One request: the stream read to its end; true when it delivered an event. */
async function attempt(ev: Events): Promise<boolean> {
  const headers = new Headers(ev.headers);
  if (!headers.has('accept')) headers.set('accept', 'text/event-stream');
  if (ev.lastId !== '') headers.set('last-event-id', ev.lastId);
  const res = await fetch(ev.url, { headers, credentials: ev.credentials, cache: 'no-store', signal: ev.ctl.signal });
  if (res.status === 204 || (res.status >= 400 && res.status < 500)) throw new Refused(res.status);
  if (!res.ok || res.body === null) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  emit(ev.st, 'open', { reconnected: { t: K.Logic, v: ev.opened } });
  ev.opened = true;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let delivered = false;
  for (;;) {
    const { done, value: chunk } = await reader.read();
    if (done) return delivered;
    buf = parseSse(buf + dec.decode(chunk, { stream: true }), e => {
      if (e.id !== null) ev.lastId = e.id;
      if (e.retry !== null) ev.retry = e.retry;
      if (e.data === null) return;
      delivered = true;
      emit(ev.st, 'message', { value: messageValue(e.data), event: word(e.event), id: ev.lastId === '' ? NONE : string(ev.lastId) });
    });
  }
}

/** Waits before the next attempt; the browser coming back online ends the wait at once. */
function pause(ev: Events, ms: number): Promise<void> {
  return new Promise(resolve => {
    const g = globalThis as { addEventListener?: typeof addEventListener; removeEventListener?: typeof removeEventListener };
    const done = () => {
      clearTimeout(timer);
      g.removeEventListener?.('online', done);
      ev.wake = null;
      resolve();
    };
    const timer = setTimeout(done, ms);
    g.addEventListener?.('online', done);
    ev.wake = done;
  });
}

async function run(ev: Events): Promise<void> {
  const fail = (message: string, status: number | null) => emit(ev.st, 'error', {
    value: makeError('access', 'network', `event stream ${ev.url}: ${message}`),
    attempt: integer(ev.attempt),
    status: status === null ? NONE : integer(status),
  });
  for (;;) {
    let delivered = false;
    try {
      delivered = await attempt(ev);
      if (ev.stopped) return;
      if (!ev.reconnect) {
        emit(ev.st, 'close', { value: NONE });
        return;
      }
    } catch (e) {
      if (ev.stopped) return;
      if (e instanceof Refused) {
        ev.attempt++;
        if (e.status !== 204) fail(e.message, e.status);
        emit(ev.st, 'close', { value: integer(e.status) });
        return;
      }
      ev.attempt++;
      fail((e as Error).message, (e as { status?: number }).status ?? null);
      if (!ev.reconnect) return;
    }
    if (delivered) {
      ev.delay = FIRST_DELAY;
      ev.attempt = 0;
    }
    const wait = ev.retry ?? ev.delay;
    if (ev.retry === null) ev.delay = nextDelay(ev.delay);
    await pause(ev, wait);
    if (ev.stopped) return;
    ev.ctl = new AbortController();
  }
}

native('events-request', '["Opens a stream of server-sent events; used by open-events." url [url! string!] options [object! none!]]', (t, f) => {
  let url = text(f.args[0] as StringCell);
  const opts = f.args[1]!.t === K.Object ? f.args[1] as ObjectCell : null;
  const q = field(opts, 'query');
  if (q !== null) {
    const qs = queryText(q);
    if (qs === null) return throwError('script', 'bad-query', 'a query takes words or strings as names');
    if (qs !== '') url += (url.includes('?') ? '&' : '?') + qs;
  }
  const h = field(opts, 'headers');
  const cookies = field(opts, 'cookies');
  const reconnect = field(opts, 'reconnect');
  const last = field(opts, 'last-id');
  const ev: Events = {
    st: null as unknown as Stream,
    url,
    headers: h === null ? [] : pairs(h),
    credentials: cookies === null ? 'same-origin' : isOn(cookies) ? 'include' : 'omit',
    reconnect: reconnect === null || isOn(reconnect),
    lastId: last === null ? '' : form(last),
    retry: null,
    delay: FIRST_DELAY,
    attempt: 0,
    opened: false,
    stopped: false,
    ctl: new AbortController(),
    wake: null,
  };
  const stop = () => {
    ev.stopped = true;
    ev.ctl.abort();
    ev.wake?.();
  };
  const st: Stream = {
    sch: schedulerOf(t), url, handlers: {}, pending: [], close: stop,
    closed: () => emit(st, 'close', { value: NONE }),
  };
  (ev as { st: Stream }).st = st;
  void run(ev);
  return value(makeHandle('stream', st));
});
