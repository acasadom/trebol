// Runs the Trebol test suites (test/trebol/*.trb) in Rebol 3 and lists every
// test whose result differs from Trebol's, so differences are decisions and
// not accidents.
//
//   npm run r3check                 compare; fails on a difference not accepted
//   npm run r3check -- --all        also show the accepted ones
//   npm run r3check -- --new f.json write the new differences to f.json, to fill in why
//
// Each test gives true in Trebol (the suites are green), so a difference is a
// test that does not give true in R3. Accepted differences, each with why,
// are in test/r3-differences.json; a test listed there that now agrees is
// reported too, so the list never goes stale. R3 is found at $R3 or
// ~/bin/rebol3 (Oldes Rebol 3, https://github.com/Oldes/Rebol3); without it
// the command says so and does nothing, unless $R3 is set (CI), when it fails.

import { readdirSync, readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { K, load, mold, text, scriptStart, type Cell } from '../src/core/index.ts';

const ROOT = join(import.meta.dirname, '..');
const SUITES = join(ROOT, 'test', 'trebol');
const ACCEPTED = join(ROOT, 'test', 'r3-differences.json');

interface Accepted { test: string; why: string }
interface Test { file: string; group: string; src: string }

/**
 * The test as R3 source. Trebol writes a map as #(...), which this R3 reads as
 * construction syntax; R3 writes maps as #[...].
 */
function moldR3(c: Cell): string {
  switch (c.t) {
    case K.Map: {
      const d = c.s.data;
      const parts: string[] = [];
      for (let i = 0; i + 1 < d.length; i += 2) {
        const k = d[i]!;
        parts.push((k.t === K.Word ? mold({ ...k, t: K.SetWord }) : moldR3(k)) + ' ' + moldR3(d[i + 1]!));
      }
      return `#[${parts.join(' ')}]`;
    }
    case K.Block: return `[${c.s.data.slice(c.i).map(moldR3).join(' ')}]`;
    case K.Paren: return `(${c.s.data.slice(c.i).map(moldR3).join(' ')})`;
  }
  return mold(c);
}

/** Suites of what Trebol has and R3 has not, so nothing in them can agree: machines and fragments. */
const TREBOL_ONLY = new Set(['machine.trb', 'fragment.trb', 'version.trb']);

function suites(): Test[] {
  const out: Test[] = [];
  for (const file of readdirSync(SUITES).filter(f => f.endsWith('.trb') && !TREBOL_ONLY.has(f)).sort()) {
    const code = load(readFileSync(join(SUITES, file), 'utf8'), { file });
    let group = '';
    for (const c of code.s.data.slice(scriptStart(code).start)) {
      if (c.t === K.String) group = text(c);
      else if (c.t === K.Block) out.push({ file, group, src: moldR3(c) });
    }
  }
  return out;
}

/** A braced R3 string holding the text. */
const braced = (s: string): string => '{' + s.replace(/\^/g, '^^').replace(/[{}]/g, m => '^' + m) + '}';

/** What a test gives when Rebol 3 itself stops on it (an assertion of its own, as 3.22.1 on Linux has). */
const CRASHED = '(R3 crashed on this test)';

/** The answer of R3 to each test: run from a test on, and run again past one R3 crashes on. */
function runR3(r3: string, tests: Test[]): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'r3check-'));
  const results: string[] = new Array(tests.length).fill('(no answer: R3 stopped before this test)');
  let from = 1;
  while (from <= tests.length) {
    const lines = [
      'REBOL []',
      'tests: [',
      ...tests.slice(from - 1).map(t => braced(t.src)),
      ']',
      // a word of its own counts the tests: a test may change the position of a series it is given
      `r3check-n: ${from - 1}`,
      'foreach r3check-test tests [',
      '    r3check-n: r3check-n + 1',
      '    r: try [do load r3check-test]',
      '    s: either r == true ["ok"] [replace/all mold/all :r newline " "]',
      '    print ["#" r3check-n s]',
      ']',
    ];
    const script = join(dir, 'check.r3');
    writeFileSync(script, lines.join('\n'));
    let outText: string;
    let crashed = false;
    try {
      outText = execFileSync(r3, ['-qs', script], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      outText = String((e as { stdout?: string }).stdout ?? '');
      crashed = true;
    }
    let last = from - 1;
    for (const l of outText.split('\n')) {
      const m = /^# (\d+) (.*)$/.exec(l);
      if (m) {
        results[Number(m[1]) - 1] = m[2]!;
        last = Number(m[1]);
      }
    }
    if (!crashed) break;
    // the test after the last answered is the one R3 stopped on
    if (last < tests.length) results[last] = CRASHED;
    from = last + 2;
  }
  return results;
}

const r3 = process.env.R3 ?? join(homedir(), 'bin', 'rebol3');
if (!existsSync(r3)) {
  console.log(`No Rebol 3 at ${r3}: set R3 to its path to compare.`);
  // R3 named on purpose (as in CI) and missing is a failure, not a quiet skip.
  process.exit(process.env.R3 === undefined ? 0 : 1);
}
const showAll = process.argv.includes('--all');
const accepted: Accepted[] = existsSync(ACCEPTED) ? JSON.parse(readFileSync(ACCEPTED, 'utf8')) as Accepted[] : [];
const why = new Map(accepted.map(a => [a.test, a.why]));
const tests = suites();
const results = runR3(r3, tests);

let fresh = 0;
const differing = new Set<string>();
const newOnes: Array<{ test: string; why: string; r3: string }> = [];
const crashes: Test[] = [];
tests.forEach((t, i) => {
  const r = results[i]!;
  if (r === 'ok') return;
  // a crash of R3 is R3's own fault, not an answer to compare: said, never accepted nor failed
  if (r === CRASHED) {
    crashes.push(t);
    return;
  }
  differing.add(t.src);
  const reason = why.get(t.src);
  if (reason === undefined) {
    fresh++;
    newOnes.push({ test: t.src, why: '', r3: r.slice(0, 200) });
    console.log(`NEW  ${t.file} / ${t.group}\n     ${t.src}\n     R3: ${r.slice(0, 300)}`);
  } else if (showAll) {
    console.log(`ok   ${t.file} / ${t.group}\n     ${t.src}\n     R3: ${r.slice(0, 200)}\n     why: ${reason}`);
  }
});
const newAt = process.argv.indexOf('--new');
if (newAt >= 0 && process.argv[newAt + 1]) writeFileSync(process.argv[newAt + 1]!, JSON.stringify(newOnes, null, 2) + '\n');
const stale = accepted.filter(a => !differing.has(a.test));
for (const a of stale) console.log(`STALE (R3 now agrees, or the test changed): ${a.test}`);
for (const t of crashes) console.log(`R3 CRASHED (its own bug, not compared): ${t.file} / ${t.group}\n     ${t.src}`);
console.log(`${tests.length} tests, ${differing.size} differ from R3: ${differing.size - fresh} accepted, ${fresh} new; ${stale.length} stale.`);
if (fresh > 0 || stale.length > 0) process.exitCode = 1;
