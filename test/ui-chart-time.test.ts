// Charts over time (src/host/chart-time.ts, chart.ts): rows placed at their moments, round steps of the
// calendar on the axis, long lines thinned with no dots, a second scale on the right, and the column word
// right-axis in the dialect. Dates are made on the clock where the tests run, so any zone gives the same.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { load, mold, native, value, form, errorField, type ObjectCell, type Cell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { chartSvg, chartFrame, type ChartSpec } from '../src/host/chart.ts';
import { byTime, timeTicks, pointText, thinned, nearest } from '../src/host/chart-time.ts';
import type { El } from '../src/host/draw.ts';
import { intern } from '../src/core/index.ts';

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const rows = (src: string): Cell[] => {
  const b = load(src);
  return b.s.data.slice(b.i);
};

describe('rows on a time axis', () => {
  test('rows whose first column is a moment go oldest first; one that is not makes no time axis', () => {
    const r = rows('#(at: 2026-01-12 n: 2) #(at: "2026-01-10" n: 1) #(at: 2026-01-11/9:00 n: 3)');
    const t = byTime(r, intern('at'))!;
    assert.deepEqual(t.times, [at(2026, 1, 10), at(2026, 1, 11, 9), at(2026, 1, 12)]);
    assert.equal(t.allDay, false);
    assert.equal(mold(t.rows[0]!), '#(at: "2026-01-10" n: 1)');
    assert.equal(byTime(rows('#(at: "Jan" n: 1) #(at: 2026-01-11 n: 2)'), intern('at')), null);
    assert.equal(byTime(rows('#(at: 2026-01-10 n: 1)'), intern('at'))!.allDay, true);
  });

  test('the steps of the axis are round steps of the calendar that fit the width', () => {
    const hours = timeTicks(at(2026, 1, 10, 0), at(2026, 1, 10, 23, 59), 600, 'en-GB');
    assert.deepEqual(hours.map(t => t.text), ['10 Jan', '3:00', '6:00', '9:00', '12:00', '15:00', '18:00', '21:00']);
    const narrow = timeTicks(at(2026, 1, 10, 0), at(2026, 1, 10, 23, 59), 200, 'en-GB');
    assert.ok(narrow.length < hours.length && narrow.length >= 2);
    const months = timeTicks(at(2025, 9, 1), at(2026, 8, 31), 600, 'en-GB');
    assert.deepEqual(months.map(t => t.text).slice(0, 5), ['Sept', 'Oct', 'Nov', 'Dec', '2026']);
    const years = timeTicks(at(1990, 1, 1), at(2026, 1, 1), 400, 'en');
    assert.ok(years.every(t => /^\d{4}$/.test(t.text)));
    assert.ok(years.every(t => new Date(t.ms).getMonth() === 0 && new Date(t.ms).getDate() === 1));
    // in the page's language
    assert.equal(timeTicks(at(2026, 3, 1), at(2026, 3, 31), 600, 'es').some(t => t.text.includes('mar')), true);
  });

  test('a point says its day, and its time when it has one', () => {
    assert.equal(pointText(at(2026, 1, 10), 0, true, 'en-GB'), '10 Jan 2026');
    assert.equal(pointText(at(2026, 1, 10, 9, 30), 86400000, false, 'en-GB'), '10 Jan 2026, 9:30');
  });

  test('a long line keeps the first, lowest, highest and last point of each pixel', () => {
    const xs = [0, 0.2, 0.4, 0.6, 0.8, 1, 1.5, 2];
    const ys = [5, 9, 1, 4, 3, 7, null, 2];
    assert.deepEqual(thinned(xs, ys), [0, 1, 2, 4, 5, 7]);
    assert.equal(nearest([10, 20, 30], 24), 1);
    assert.equal(nearest([10, 20, 30], 99), 2);
    assert.equal(nearest([], 1), -1);
  });
});

describe('charts over time', () => {
  const format = (n: number) => String(n);
  const base = (over: Partial<ChartSpec>): ChartSpec => ({
    kind: 'line', labels: ['a', 'b', 'c'], stacked: false, width: 400, height: 200, format,
    series: [{ name: 'S', values: [1, 2, 3], color: 'c' }], ...over,
  });
  const dots = (els: El[]) => els.filter(e => e.tag === 'circle').map(e => Number(e.attrs['cx']));

  test('points stand at their distance in time, not one band each', () => {
    const els = chartSvg(base({ times: [at(2026, 1, 1), at(2026, 1, 2), at(2026, 1, 11)], lang: 'en' }));
    const [a, b, c] = dots(els);
    assert.ok(Math.abs((b! - a!) * 10 - (c! - a!)) < 0.01);
    const evenly = dots(chartSvg(base({})));
    assert.ok(Math.abs((evenly[1]! - evenly[0]!) - (evenly[2]! - evenly[1]!)) < 0.01);
  });

  test('a line of more points than fit has no dots, a thinned line, and a frame for the pointer', () => {
    const n = 20000;
    const times = Array.from({ length: n }, (_, i) => at(2026, 1, 1) + i * 60000);
    const spec = base({ labels: times.map(String), times, lang: 'en', series: [{ name: 'S', values: times.map((_, i) => Math.sin(i / 50)), color: 'c' }] });
    const els = chartSvg(spec);
    assert.equal(dots(els).length, 0);
    const line = els.find(e => e.tag === 'polyline')!;
    assert.ok(line.attrs['points']!.split(' ').length < 4 * 400);
    const frame = chartFrame(spec);
    assert.equal(frame.dense, true);
    assert.equal(frame.xs.length, n);
  });

  test('a series on the right has its own scale and numbers on the right', () => {
    const els = chartSvg(base({
      series: [{ name: 'Temp', values: [10, 20, 30], color: 'a' }, { name: 'Load', values: [0.1, 0.5, 0.9], color: 'b', right: true }],
    }));
    const texts = els.filter(e => e.tag === 'text');
    const rightSide = texts.filter(e => e.attrs['text-anchor'] === 'start').map(e => e.text);
    assert.deepEqual(rightSide, ['0', '0.25', '0.5', '0.75', '1']);
    // each line reaches the top of its own scale
    const [temp, load] = els.filter(e => e.tag === 'polyline').map(e => e.attrs['points']!.split(' ').map(p => Number(p.split(',')[1])));
    assert.ok(Math.abs(temp![2]! - load![2]!) < 30);
    // its numbers take the color of its one series
    assert.equal(texts.find(e => e.attrs['text-anchor'] === 'start')!.attrs['fill'], 'b');
  });

  test('a small chart has fewer steps up its side', () => {
    const steps = (height: number) => chartSvg(base({ height, series: [{ name: 'S', values: [0, 100, 50], color: 'c' }] }))
      .filter(e => e.tag === 'text' && e.attrs['text-anchor'] === 'end').length;
    assert.ok(steps(120) < steps(240));
  });

  test('bars on a time axis stand at their moments and never overlap', () => {
    const els = chartSvg(base({ kind: 'bar', times: [at(2026, 1, 1), at(2026, 1, 2), at(2026, 1, 5)], lang: 'en' }));
    const bars = els.filter(e => e.tag === 'rect').map(e => [Number(e.attrs['x']), Number(e.attrs['x']) + Number(e.attrs['width'])]);
    assert.equal(bars.length, 3);
    for (let i = 1; i < bars.length; i++) assert.ok(bars[i]![0]! >= bars[i - 1]![1]!);
  });
});

describe('right-axis in the dialect', () => {
  let host: Host;
  native('show', '[root [object!]]', (_t, f) => value(f.args[0]!));
  beforeEach(async () => {
    host = startHost({ onError: () => {}, loader: { base: 'file:///', read: href => readFile(fileURLToPath(href), 'utf8') } });
    await startUi(host);
  });
  async function ev(src: string): Promise<string> {
    try {
      return mold(await runSource(host, src));
    } catch (e) {
      return assert.fail(`${src}\n  raised: ${form(errorField(e as ObjectCell, 'message'))}`);
    }
  }

  test('a column of a chart keeps right-axis with its label', async () => {
    assert.equal(await ev('c: first layout/only [chart line w [at "When" temp "Temp" load "Load" right-axis]] c/columns'),
      '[at "When" temp "Temp" load ["Load" right-axis]]');
    assert.equal(await ev('c: first layout/only [chart line w [at temp load right-axis]] c/columns'),
      '[at "at" temp "temp" load ["load" right-axis]]');
  });
});
