// Network natives: HTTP with JSON built in, WebSocket and server-sent events.
//
// All of them are asynchronous by default: they return `await` and the task
// continues with the result, so from Trebol `data: fetch url` just reads.
// Failures (network, timeout, HTTP status >= 400) are access errors that
// `try` can catch. `cancel` on the task aborts the request in flight.

import {
  K, NONE, I64, native, value, string, text, binary, makeError, throwError, form, spell, ctxFind, intern,
  parseJson, toJson,
  type Cell, type BlockCell, type StringCell, type ObjectCell, type WordCell, type Step, type NativeFn,
} from '../core/index.ts';
import { schedulerOf, spawnHandler, makeHandle, handleOf, type Scheduler } from './scheduler.ts';
import { cancellers } from './natives.ts';

// --- files -----------------------------------------------------------------------
//
// A file the user chose (an upload field) is a handle of kind 'file' over a
// Blob: Trebol never holds its bytes until it asks with read-file.

/** A handle for a file the user chose. */
export function fileHandle(file: Blob): Cell {
  return makeHandle('file', file);
}

native('read-file', '[file [handle!]]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  const file = handleOf<Blob>(f.args[0]!, 'file');
  if (file === null) return throwError('script', 'bad-handle', 'read-file needs a file from an upload field');
  const p = file.arrayBuffer().then(
    buf => binary([...new Uint8Array(buf)]) as Cell,
    (e: Error) => { throw makeError('access', 'read', `cannot read ${file instanceof File ? file.name : 'the file'}: ${e.message}`); },
  );
  return { k: 'await', p };
});

// --- HTTP ------------------------------------------------------------------------

function field(opts: ObjectCell | null, name: string): Cell | null {
  if (opts === null) return null;
  const i = ctxFind(opts.ctx, intern(name));
  const v = i < 0 ? undefined : opts.ctx.vals[i];
  return v === undefined || v.t === K.None ? null : v;
}

/** Pairs from a block [name value ...], a map or an object, as strings. */
function pairs(c: Cell): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const name = (k: Cell) => (k.t >= K.Word && k.t <= K.Issue ? spell((k as WordCell).sym) : form(k));
  if (c.t === K.Block || c.t === K.Map) {
    const d = c.s.data.slice(c.t === K.Block ? c.i : 0);
    for (let i = 0; i + 1 < d.length; i += 2) out.push([name(d[i]!), form(d[i + 1]!)]);
  } else if (c.t === K.Object) {
    c.ctx.keys.forEach((k, i) => out.push([spell(k), form(c.ctx.vals[i]!)]));
  }
  return out;
}

/** Turns a decoded body into a value: JSON when the server says so, text, or binary. */
function decodeBody(type: string, bytes: Uint8Array): Cell {
  if (/json/i.test(type)) {
    const r = parseJson(new TextDecoder().decode(bytes));
    return typeof r === 'string' ? string(new TextDecoder().decode(bytes)) : r;
  }
  if (/^text\/|xml|javascript|x-www-form-urlencoded/i.test(type) || type === '') {
    return string(new TextDecoder().decode(bytes));
  }
  return { t: K.Binary, s: { data: [...bytes] }, i: 0 };
}

function toSeconds(c: Cell): number {
  if (c.t === K.Time) return c.v / 1e9;
  if (c.t === K.Integer) return I64.toNumber(c.v);
  return (c as { v: number }).v;
}

/**
 * http-request url options: options is none or an object with any of
 * method, headers, body, json, form, multipart, timeout, full.
 */
native('http-request', '[url [url! string!] options [object! none!]]', (t, f, v) => {
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  const url = text(f.args[0] as StringCell);
  const opts = f.args[1]!.t === K.Object ? f.args[1] as ObjectCell : null;
  const method = field(opts, 'method');
  const headers = new Headers();
  const h = field(opts, 'headers');
  if (h !== null) for (const [k, val] of pairs(h)) headers.set(k, val);
  let body: BodyInit | undefined;
  const b = field(opts, 'body');
  const formFields = field(opts, 'form');
  const multipart = field(opts, 'multipart');
  if (formFields !== null) {
    body = new URLSearchParams(pairs(formFields));
  } else if (multipart !== null) {
    const fd = new FormData();
    const d = multipart.t === K.Block ? multipart.s.data.slice(multipart.i) : [];
    for (let i = 0; i + 1 < d.length; i += 2) {
      const k = d[i]!;
      const val = d[i + 1]!;
      const key = k.t >= K.Word && k.t <= K.Issue ? spell((k as WordCell).sym) : form(k);
      const file = handleOf<Blob>(val, 'file');
      if (val.t === K.Binary) fd.append(key, new Blob([new Uint8Array(val.s.data.slice(val.i))]), key);
      else if (file !== null) fd.append(key, file, file instanceof File ? file.name : key);
      else fd.append(key, form(val));
    }
    body = fd;
  } else if (b !== null) {
    if (b.t === K.String) {
      body = text(b);
    } else if (b.t === K.Binary) {
      body = new Uint8Array(b.s.data.slice(b.i)) as unknown as BodyInit;
    } else {
      body = toJson(b);
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    }
  }
  if (!headers.has('accept')) headers.set('accept', 'application/json, text/*;q=0.9, */*;q=0.8');
  const timeout = field(opts, 'timeout');
  const full = field(opts, 'full') !== null;
  const ctl = new AbortController();
  let timedOut = false;
  const timer = timeout !== null ? setTimeout(() => { timedOut = true; ctl.abort(); }, toSeconds(timeout) * 1000) : null;
  const me = schedulerOf(t).byTask.get(t);
  if (me) me.abort = () => ctl.abort();
  const verb = method === null ? (body === undefined ? 'GET' : 'POST') : form(method).toUpperCase();
  const p = (async (): Promise<Cell> => {
    try {
      const res = await fetch(url, { method: verb, headers, body, signal: ctl.signal });
      const bytes = new Uint8Array(await res.arrayBuffer());
      const data = decodeBody(res.headers.get('content-type') ?? '', bytes);
      if (full) {
        const hs: Cell[] = [];
        res.headers.forEach((val, k) => hs.push(string(k), string(val)));
        return {
          t: K.Object,
          ctx: {
            keys: ['status', 'headers', 'body'].map(n => intern(n)),
            vals: [{ t: K.Integer, v: res.status }, { t: K.Map, s: { data: hs } }, data],
            parent: null,
          },
        };
      }
      if (!res.ok) throw makeError('access', 'http', `HTTP ${res.status} ${res.statusText} for ${url}`);
      return data;
    } catch (e) {
      if ((e as Cell).t === K.Error) throw e;
      if (timedOut) throw makeError('access', 'timeout', `request to ${url} timed out`);
      if (ctl.signal.aborted) throw makeError('access', 'cancelled', `request to ${url} was cancelled`);
      throw makeError('access', 'network', `cannot reach ${url}: ${(e as Error).message}`);
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  })();
  return { k: 'await', p };
});


// --- WebSocket and server-sent events ----------------------------------------------

/** What a stream (socket or event source) does with incoming messages. */
interface Stream {
  readonly sch: Scheduler;
  handlers: Record<string, BlockCell[]>;
  /** Events that arrived before any handler for them was set. */
  pending: Array<[string, Record<string, Cell>]>;
  close: () => void;
  send?: (data: string | Uint8Array) => void;
}

/** A message as a value: JSON objects and arrays load, anything else stays text. */
function messageValue(data: string): Cell {
  const s = data.trimStart();
  if (s.startsWith('{') || s.startsWith('[')) {
    const r = parseJson(data);
    if (typeof r !== 'string') return r;
  }
  return string(data);
}

function emit(st: Stream, kind: string, words: Record<string, Cell>): void {
  const bodies = st.handlers[kind];
  if (bodies === undefined) {
    st.pending.push([kind, words]);
    return;
  }
  for (const body of bodies) spawnHandler(st.sch, body, words);
}

native('open-socket', '[url [url! string!]]', (t, f, v) => {
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  const url = text(f.args[0] as StringCell);
  const sch = schedulerOf(t);
  const p = new Promise<Cell>((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      reject(makeError('access', 'network', `cannot open ${url}: ${(e as Error).message}`));
      return;
    }
    ws.binaryType = 'arraybuffer';
    const st: Stream = {
      sch,
      handlers: {},
      pending: [],
      close: () => ws.close(),
      send: data => ws.send(data),
    };
    let opened = false;
    ws.onopen = () => {
      opened = true;
      resolve(makeHandle('stream', st));
    };
    ws.onmessage = ev => {
      const val = typeof ev.data === 'string'
        ? messageValue(ev.data)
        : { t: K.Binary, s: { data: [...new Uint8Array(ev.data as ArrayBuffer)] }, i: 0 } as Cell;
      emit(st, 'message', { value: val });
    };
    ws.onerror = () => {
      if (!opened) reject(makeError('access', 'network', `cannot open ${url}`));
      else emit(st, 'error', { value: makeError('access', 'network', `socket error on ${url}`) });
    };
    ws.onclose = ev => {
      if (opened) emit(st, 'close', { value: { t: K.Integer, v: ev.code } });
    };
  });
  return { k: 'await', p };
});

/** Splits a server-sent events stream into events. */
function parseSse(buffer: string, onEvent: (event: string, data: string) => void): string {
  let rest = buffer;
  for (;;) {
    const m = /\r?\n\r?\n/.exec(rest);
    if (m === null) return rest;
    const block = rest.slice(0, m.index);
    rest = rest.slice(m.index + m[0].length);
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const name = colon < 0 ? line : line.slice(0, colon);
      const val = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (name === 'event') event = val;
      else if (name === 'data') data.push(val);
    }
    if (data.length > 0) onEvent(event, data.join('\n'));
  }
}

native('open-events', '[url [url! string!]]', (t, f) => {
  const url = text(f.args[0] as StringCell);
  const sch = schedulerOf(t);
  const ctl = new AbortController();
  const st: Stream = { sch, handlers: {}, pending: [], close: () => ctl.abort() };
  const handle = makeHandle('stream', st);
  void (async () => {
    try {
      const res = await fetch(url, { headers: { accept: 'text/event-stream' }, signal: ctl.signal });
      if (!res.ok || res.body === null) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buf = parseSse(buf + dec.decode(chunk, { stream: true }), (event, data) => {
          emit(st, 'message', { value: messageValue(data), event: { t: K.Word, sym: intern(event), bind: null } });
        });
      }
      emit(st, 'close', { value: NONE });
    } catch (e) {
      if (!ctl.signal.aborted) emit(st, 'error', { value: makeError('access', 'network', `event stream ${url}: ${(e as Error).message}`) });
    }
  })();
  return value(handle);
});

function onEvent(kind: string) {
  return (_t: unknown, f: { args: Cell[] }): Step => {
    const st = handleOf<Stream>(f.args[0]!, 'stream');
    if (st === null) return throwError('script', 'bad-handle', `on-${kind} needs a socket or event stream`);
    (st.handlers[kind] ??= []).push(f.args[1] as BlockCell);
    const waiting = st.pending.filter(([k]) => k === kind);
    st.pending = st.pending.filter(([k]) => k !== kind);
    for (const [, words] of waiting) emit(st, kind, words);
    return value(f.args[0]!);
  };
}

native('on-message', '[stream [handle!] body [block!]]', onEvent('message'));
native('on-close', '[stream [handle!] body [block!]]', onEvent('close'));
native('on-error', '[stream [handle!] body [block!]]', onEvent('error'));

native('send', '[stream [handle!] data [any-value!]]', (_t, f) => {
  const st = handleOf<Stream>(f.args[0]!, 'stream');
  if (st === null || st.send === undefined) {
    return throwError('script', 'bad-handle', 'send needs an open socket');
  }
  const d = f.args[1]!;
  st.send(d.t === K.String ? text(d) : d.t === K.Binary ? new Uint8Array(d.s.data.slice(d.i)) : toJson(d));
  return value(f.args[0]!);
});

cancellers['stream'] = obj => (obj as Stream).close();
const closeStream: NativeFn = (_t, f) => {
  handleOf<Stream>(f.args[0]!, 'stream')?.close();
  return value(f.args[0]!);
};
native('close', '[stream [handle!]]', closeStream);
// the UI dialect redefines close for dialogs and falls back to this one
native('close-stream', '[stream [handle!]]', closeStream);
