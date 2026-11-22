// The parts of a stream of server-sent events that need no server: the fields and the wait.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSse, nextDelay, FIRST_DELAY, LAST_DELAY, type SseEvent } from '../src/host/net/events.ts';

const parse = (text: string): { events: SseEvent[]; rest: string } => {
  const events: SseEvent[] = [];
  const rest = parseSse(text, e => events.push(e));
  return { events, rest };
};

test('event, data, id and retry fields; comments are skipped', () => {
  const { events, rest } = parse(': hello\nevent: note\nid: 3\ndata: a\ndata: b\n\nretry: 500\n\nid:\ndata: c\n\ndata: d');
  assert.deepEqual(events, [
    { event: 'note', data: 'a\nb', id: '3', retry: null },
    { event: 'message', data: null, id: null, retry: 500 },
    { event: 'message', data: 'c', id: '', retry: null },
  ]);
  assert.equal(rest, 'data: d');
});

test('a retry that is not digits and an id with NUL are ignored', () => {
  const { events } = parse('retry: 1s\nid: a\0b\ndata: x\r\n\r\n');
  assert.deepEqual(events, [{ event: 'message', data: 'x', id: null, retry: null }]);
});

test('the wait doubles from a second up to thirty', () => {
  const waits = [FIRST_DELAY];
  while (waits.length < 8) waits.push(nextDelay(waits.at(-1)!));
  assert.deepEqual(waits, [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  assert.equal(LAST_DELAY, 30000);
});
