// The draw dialect and charts as plain elements (src/host/draw.ts, chart.ts),
// and how the UI dialect lays out a canvas and a chart.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { load, mold, native, value, form, errorField, type ObjectCell } from '../src/core/index.ts';
import { startHost, startUi, runSource, type Host } from '../src/host/index.ts';
import { drawSvg, drawColor, DRAW_COLORS, type El } from '../src/host/draw.ts';
import { chartSvg, ticks } from '../src/host/chart.ts';
import { themeCss, DEFAULT_THEME } from '../src/host/theme.ts';

/** The elements as compact text: tag[attr=value ...]{kids} "text". */
function show(els: El[]): string {
  return els.map(e => {
    const a = Object.entries(e.attrs).map(([k, v]) => `${k}=${v}`).join(' ');
    const kids = e.kids.length > 0 ? `{${show(e.kids)}}` : '';
    return `${e.tag}[${a}]${kids}${e.text !== undefined ? ` "${e.text}"` : ''}`;
  }).join(' ');
}

const draw = (src: string) => drawSvg(load(`[${src}]`).s.data[0]!);

describe('draw', () => {
  test('shapes take the pen and fill-pen in force, as in Red', () => {
    const r = draw('fill-pen primary circle 60x60 50 pen off fill-pen red box 0x0 10x20 4');
    assert.equal(r.error, null);
    assert.equal(show(r.kids),
      'circle[cx=60 cy=60 r=50 fill=var(--tb-primary) stroke=var(--tb-text) stroke-width=1 stroke-linecap=butt stroke-linejoin=miter] '
      + 'rect[x=0 y=0 width=10 height=20 fill=var(--tb-c-red) stroke=none stroke-width=1 stroke-linecap=butt stroke-linejoin=miter rx=4]');
  });

  test('a line is never filled; line-width, line-cap and line-join change how it is drawn', () => {
    const r = draw('fill-pen blue line-width 3 line-cap round line-join bevel line 0x0 10x10 20x0');
    assert.equal(show(r.kids),
      'polyline[points=0,0 10,10 20,0 fill=none stroke=var(--tb-text) stroke-width=3 stroke-linecap=round stroke-linejoin=bevel]');
  });

  test('circle with two radii, ellipse by its box, triangle, polygon and curves', () => {
    const r = draw('circle 10x10 5 3 ellipse 0x0 20x10 triangle 0x0 4x0 2x3 polygon 0x0 1x0 1x1 0x1 curve 0x0 5x5 10x0 curve 0x0 1x1 2x1 3x0');
    assert.equal(r.error, null);
    assert.deepEqual(r.kids.map(e => e.tag), ['ellipse', 'ellipse', 'polygon', 'polygon', 'path', 'path']);
    assert.equal(r.kids[1]!.attrs['cx'], '10');
    assert.equal(r.kids[4]!.attrs['d'], 'M0,0 Q5,5 10,0');
    assert.equal(r.kids[5]!.attrs['d'], 'M0,0 C1,1 2,1 3,0');
  });

  test('an arc goes clockwise from three o\'clock; closed makes a slice', () => {
    assert.equal(draw('arc 50x50 10x10 0 90').kids[0]!.attrs['d'], 'M60,50 A10,10 0 0 1 50,60');
    assert.equal(draw('arc 50x50 10x10 0 90 closed').kids[0]!.attrs['d'], 'M50,50 L60,50 A10,10 0 0 1 50,60 Z');
  });

  test('text takes the pen as its color and the font in force', () => {
    const r = draw('pen muted font [size: 20 bold] text 5x5 "Cog"');
    assert.equal(show(r.kids),
      'text[x=5 y=5 dominant-baseline=hanging fill=var(--tb-muted) font-size=20 font-family=var(--tb-font) font-weight=bold] "Cog"');
  });

  test('a transform holds for the rest of its block; push keeps its own pen and transforms', () => {
    const r = draw('push [pen red rotate 45 50x50 line 0x0 1x1] translate 10x0 line 0x0 1x1');
    assert.equal(show(r.kids),
      'g[]{g[transform=rotate(45 50 50)]{polyline[points=0,0 1,1 fill=none stroke=var(--tb-c-red) stroke-width=1 stroke-linecap=butt stroke-linejoin=miter]}} '
      + 'g[transform=translate(10 0)]{polyline[points=0,0 1,1 fill=none stroke=var(--tb-text) stroke-width=1 stroke-linecap=butt stroke-linejoin=miter]}');
  });

  test('what is wrong stops the drawing with a message that says how to write it', () => {
    assert.equal(draw('box 0x0').error, 'draw: box is written box top-left bottom-right [corner-radius]');
    assert.equal(draw('splat 1').error, 'draw: unknown command splat');
    assert.equal(draw('"hi"').error, 'draw: a command was expected, not a string');
    assert.match(draw('pen 255.0.0').error!, /^draw: pen takes a role \(primary .*\), a color \(red .*\) or off$/);
    // what came before the error is still drawn
    assert.equal(draw('circle 1x1 1 line').kids.length, 1);
  });

  test('colors are the theme\'s roles or Red\'s words, and the theme defines every word for light and dark', () => {
    assert.equal(drawColor('accent'), 'var(--tb-accent)');
    assert.equal(drawColor('navy'), 'var(--tb-c-navy)');
    assert.equal(drawColor('off'), null);
    assert.equal(drawColor('chartreuse'), undefined);
    const css = themeCss(DEFAULT_THEME);
    for (const name of Object.keys(DRAW_COLORS)) assert.equal(css.split(`--tb-c-${name}:`).length, 4, name);
  });
});

describe('chart', () => {
  const format = (n: number) => String(n);

  test('axis steps are round numbers that cover the values', () => {
    assert.deepEqual(ticks(0, 1450), [0, 500, 1000, 1500]);
    assert.deepEqual(ticks(-3, 7), [-4, -2, 0, 2, 4, 6, 8]);
    assert.deepEqual(ticks(0, 0), [0, 0.2, 0.4, 0.6, 0.8, 1]);
    // counts of things never step by halves
    assert.deepEqual(ticks(0, 11, true), [0, 5, 10, 15]);
    assert.deepEqual(ticks(0, 2, true), [0, 1, 2]);
  });

  test('bars: one per value, side by side, each with its label and value as a tooltip', () => {
    const els = chartSvg({
      kind: 'bar', labels: ['Jan', 'Feb'], stacked: false, width: 400, height: 200, format,
      series: [{ name: 'Repairs', values: [100, 200], color: 'var(--tb-primary)' }, { name: 'Parts', values: [50, null], color: 'var(--tb-accent)' }],
    });
    const bars = els.filter(e => e.tag === 'rect');
    assert.equal(bars.length, 3);
    assert.deepEqual(bars.map(b => b.kids[0]!.text), ['Jan, Repairs: 100', 'Feb, Repairs: 200', 'Jan, Parts: 50']);
    // Feb's repairs bar is twice as tall as Jan's
    assert.equal(Number(bars[1]!.attrs['height']), 2 * Number(bars[0]!.attrs['height']));
    assert.deepEqual(els.filter(e => e.tag === 'text').map(e => e.text), ['0', '50', '100', '150', '200', 'Jan', 'Feb']);
  });

  test('stacked bars sit on each other', () => {
    const els = chartSvg({
      kind: 'bar', labels: ['Jan'], stacked: true, width: 400, height: 200, format,
      series: [{ name: 'A', values: [100], color: 'a' }, { name: 'B', values: [100], color: 'b' }],
    });
    const [a, b] = els.filter(e => e.tag === 'rect');
    assert.equal(a!.attrs['x'], b!.attrs['x']);
    assert.equal(Number(b!.attrs['y']) + Number(b!.attrs['height']), Number(a!.attrs['y']));
  });

  test('line and area: a line and a dot per value; an area is filled below its line', () => {
    const spec = { labels: ['a', 'b', 'c'], stacked: false, width: 300, height: 150, format, series: [{ name: 'S', values: [1, 3, 2], color: 'c' }] };
    const line = chartSvg({ ...spec, kind: 'line' });
    assert.equal(line.filter(e => e.tag === 'polyline').length, 1);
    assert.equal(line.filter(e => e.tag === 'circle').length, 3);
    const area = chartSvg({ ...spec, kind: 'area' });
    assert.equal(area.filter(e => e.tag === 'polygon').length, 1);
  });

  test('a pie has a slice per label of the first series, with its share in the tooltip', () => {
    const els = chartSvg({
      kind: 'pie', labels: ['Brakes', 'Chains', 'None'], stacked: false, width: 200, height: 200, format,
      series: [{ name: 'S', values: [3, 1, 0], color: 'c' }],
    });
    assert.deepEqual(els.map(e => e.kids[0]!.text), ['Brakes: 3 (75%)', 'Chains: 1 (25%)']);
  });

  test('nothing to draw draws nothing', () => {
    assert.deepEqual(chartSvg({ kind: 'bar', labels: [], series: [], stacked: false, width: 1, height: 1, format }), []);
  });
});

describe('draw stretched and seen through', () => {
  const at = (src: string, x: number) => drawSvg(load(`[${src}]`).s.data[0]!, { x, y: 1 });

  test('a stretched drawing spreads where things are, never how big they are', () => {
    const r = at('line-width 2 line 0x10 50x20 100x0 circle 100x16 3.5 ellipse 10x0 4x6 text 50x0 "a"', 3);
    assert.equal(r.error, null);
    const [line, circle, ellipse, txt] = r.kids;
    assert.equal(line!.attrs['points'], '0,10 150,20 300,0');
    assert.equal(line!.attrs['stroke-width'], '2');
    assert.deepEqual([circle!.attrs['cx'], circle!.attrs['cy'], circle!.attrs['r']], ['300', '16', '3.5']);
    // the corner spreads, the size does not
    assert.deepEqual([ellipse!.attrs['cx'], ellipse!.attrs['rx'], ellipse!.attrs['ry']], ['32', '2', '3']);
    assert.equal(txt!.attrs['x'], '150');
    assert.equal(txt!.attrs['font-size'], '15');
  });

  test('a stretched arc spreads its center, not its radii; translate and push spread too', () => {
    const r = at('translate 10x0 push [arc 20x10 5x5 0 90]', 2);
    assert.equal(r.error, null);
    assert.equal(r.kids[0]!.attrs['transform'], 'translate(20 0)');
    assert.equal(r.kids[0]!.kids[0]!.kids[0]!.attrs['d'], 'M45,10 A5,5 0 0 1 40,15');
  });

  test('a percent after a color draws that much of it, what is under it showing through', () => {
    const r = draw('fill-pen primary 14% pen danger 50% box 0x0 10x10 fill-pen raised pen off circle 5x5 2');
    assert.equal(r.error, null);
    assert.equal(r.kids[0]!.attrs['fill'], 'color-mix(in oklch, var(--tb-primary) 14%, transparent)');
    assert.equal(r.kids[0]!.attrs['stroke'], 'color-mix(in oklch, var(--tb-danger) 50%, transparent)');
    assert.equal(r.kids[1]!.attrs['fill'], 'var(--tb-raised)');
    assert.equal(r.kids[1]!.attrs['stroke'], 'none');
    assert.equal(draw('pen primary 100% line 0x0 1x1').kids[0]!.attrs['stroke'], 'var(--tb-primary)');
    assert.equal(draw('pen off 20% line 0x0 1x1').kids[0]!.attrs['stroke'], 'none');
    assert.equal(draw('pen border-strong line 0x0 1x1').kids[0]!.attrs['stroke'], 'var(--tb-border-strong)');
  });
});

describe('canvas and chart in the dialect', () => {
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

  test('a canvas keeps its extent, its text and its draw block; setting draw replaces it', async () => {
    assert.equal(await ev('c: first (layout/only [canvas 120x80 "Logo" [circle 60x40 30]]) reduce [c/style c/extent c/text c/draw]'),
      '[canvas 120x80 "Logo" [circle 60x40 30]]');
    assert.equal(await ev('c: first layout/only [canvas [line 0x0 1x1]] c/extent'), '300x150');
  });

  test('a canvas takes stretch', async () => {
    assert.equal(await ev('c: first layout/only [canvas 100x32 stretch [line 0x0 100x32]] reduce [c/extent c/stretch]'), '[100x32 true]');
    assert.equal(await ev('c: first layout/only [canvas 100x32 [line 0x0 1x1]] c/stretch'), 'false');
  });

  test('a chart takes its kind, its label, its columns and stacked', async () => {
    assert.equal(await ev(`
      v: layout [chart line income "Income" [month "Month" repairs "Repairs"] stacked]
      c: first v/pane
      reduce [c/style c/kind c/text c/columns c/stacked]
    `), '[chart line "Income" [month "Month" repairs "Repairs"] true]');
    assert.equal(await ev('c: first layout/only [chart sales [m n]] reduce [c/kind c/columns]'), '[bar [m "m" n "n"]]');
  });
});

