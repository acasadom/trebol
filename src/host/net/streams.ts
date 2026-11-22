// Streams: a WebSocket and a stream of server-sent events, as handles whose
// handlers (on-message, on-close, on-error) run as tasks.

import {
  K, native, value, string, text, makeError, throwError, parseJson, toJson,
  type Cell, type BlockCell, type StringCell, type Step, type NativeFn,
} from '../../core/index.ts';
import { schedulerOf, spawnHandler, makeHandle, handleOf, type Scheduler, type HostTask } from '../scheduler.ts';
import { cancellers } from '../natives.ts';

/** What a stream (socket or event source) does with incoming messages. */
export interface Stream {
  readonly sch: Scheduler;
  /** Where it goes, for the screen tests that watch it. */
  readonly url: string;
  handlers: Record<string, BlockCell[]>;
  /** Events that arrived before any handler for them was set. */
  pending: Array<[string, Record<string, Cell>]>;
  close: () => void;
  /** What happens after close when the program closes it: a stream of events runs its on-close. */
  closed?: () => void;
  send?: (data: string | Uint8Array) => void;
}

/** A message as a value: JSON objects and arrays load, anything else stays text. */
export function messageValue(data: string): Cell {
  const s = data.trimStart();
  if (s.startsWith('{') || s.startsWith('[')) {
    const r = parseJson(data);
    if (typeof r !== 'string') return r;
  }
  return string(data);
}

/** Who watches what streams do; screen tests set it to wait for the handlers an event runs. */
export const streamTap: { fn: ((st: Stream, kind: string, tasks: HostTask[]) => void) | null } = { fn: null };

export function emit(st: Stream, kind: string, words: Record<string, Cell>): void {
  const bodies = st.handlers[kind];
  if (bodies === undefined) st.pending.push([kind, words]);
  const tasks = (bodies ?? []).map(body => spawnHandler(st.sch, body, words));
  streamTap.fn?.(st, kind, tasks);
}

native('open-socket', '["Opens a WebSocket; gives a handle once it is open." url [url! string!]]', (t, f, v) => {
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
      url,
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

function onEvent(kind: string) {
  return (_t: unknown, f: { args: Cell[] }): Step => {
    const st = handleOf<Stream>(f.args[0]!, 'stream');
    if (st === null) return throwError('script', 'bad-handle', `on-${kind} needs a socket or event stream`);
    (st.handlers[kind] ??= []).push(f.args[1] as BlockCell);
    const waiting = st.pending.filter(([k]) => k === kind);
    st.pending = st.pending.filter(([k]) => k !== kind);
    for (const [, words] of waiting) for (const b of st.handlers[kind]!) spawnHandler(st.sch, b, words);
    return value(f.args[0]!);
  };
}

native('on-message', '["Runs a block for each message that comes on a stream." stream [handle!] body [block!]]', onEvent('message'));
native('on-close', '["Runs a block when a stream closes." stream [handle!] body [block!]]', onEvent('close'));
native('on-error', '["Runs a block when a stream fails; a stream of events tries again, with attempt and status." stream [handle!] body [block!]]', onEvent('error'));
native('on-open', '["Runs a block when a stream of events is open, the first time and after each reconnection (reconnected)." stream [handle!] body [block!]]', onEvent('open'));

native('send', '["Sends a value on a socket." stream [handle!] data [any-value!]]', (_t, f) => {
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
  const st = handleOf<Stream>(f.args[0]!, 'stream');
  st?.close();
  st?.closed?.();
  return value(f.args[0]!);
};
native('close', '["Closes a stream, or hides a dialog." stream [handle!]]', closeStream);
// the UI dialect redefines close for dialogs and falls back to this one
native('close-stream', '["Closes a socket or a stream of events." stream [handle!]]', closeStream);
