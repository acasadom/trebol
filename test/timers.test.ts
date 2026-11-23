// Waits of any length (src/host/timers.ts): a wait past what setTimeout holds is a chain of shorter ones.
import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { after, repeat, LONGEST_WAIT } from '../src/host/timers.ts';

const MIN = 60000;
const DAY = 1440 * MIN;

/** Mocked clocks, and every wait asked of setTimeout and setInterval, so none is past what they hold. */
function clocks(): number[] {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const asked: number[] = [];
  for (const api of ['setTimeout', 'setInterval'] as const) {
    const real = globalThis[api];
    mock.method(globalThis, api, (fn: () => void, ms: number) => {
      asked.push(ms);
      return real(fn, ms);
    });
  }
  return asked;
}

/**
 * Moves the mocked clocks on a minute at a time, so a wait set while they move is run too; a mocked wait set
 * by a timer starts when the tick ends, so a chained one may land up to a minute late.
 */
function advance(ms: number): void {
  for (; ms > MIN; ms -= MIN) mock.timers.tick(MIN);
  mock.timers.tick(ms);
}

afterEach(() => {
  mock.restoreAll();
  mock.timers.reset();
});

describe('timers', () => {
  test('a wait of 30 days runs once, after 30 days, never asking for more than the longest wait', () => {
    const asked = clocks();
    let n = 0;
    after(30 * DAY, () => { n++; });
    advance(30 * DAY - 2 * MIN);
    assert.equal(n, 0);
    advance(4 * MIN);
    assert.equal(n, 1);
    advance(60 * DAY);
    assert.equal(n, 1);
    assert.ok(asked.every(ms => ms <= LONGEST_WAIT), `asked for ${asked}`);
  });

  test('every 30 days ticks once each 30 days, and stops', () => {
    const asked = clocks();
    let n = 0;
    const stop = repeat(30 * DAY, () => { n++; });
    advance(30 * DAY - 2 * MIN);
    assert.equal(n, 0);
    advance(4 * MIN);
    assert.equal(n, 1);
    advance(30 * DAY - 4 * MIN);
    assert.equal(n, 1);
    advance(4 * MIN);
    assert.equal(n, 2);
    stop();
    advance(90 * DAY);
    assert.equal(n, 2);
    assert.ok(asked.every(ms => ms <= LONGEST_WAIT), `asked for ${asked}`);
  });

  test('a long repeat stopped by its own run leaves no wait behind', () => {
    const asked = clocks();
    let n = 0;
    const stop = repeat(30 * DAY, () => { n++; stop(); });
    advance(31 * DAY);
    assert.equal(n, 1);
    const waits = asked.length;
    advance(90 * DAY);
    assert.equal(n, 1);
    assert.equal(asked.length, waits, 'a wait was set after the stop');
  });

  test('a short wait is one interval of at least a millisecond', () => {
    const asked = clocks();
    let n = 0;
    const stop = repeat(0.25, () => { n++; });
    mock.timers.tick(3);
    assert.equal(n, 3);
    stop();
    assert.deepEqual(asked, [1]);
  });
});
