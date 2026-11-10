// Writes the reference of the documentation (docs/reference/) from two sources:
//
//   npm run reference
//
// - the functions themselves: what each spec says (its description, arguments and
//   their types, refinements, what it returns), read from a runtime with the UI
//   dialect loaded, so it never drifts from the code;
// - docs/_reference/*.md, written by hand: one file per topic, in order, with a
//   `# Title`, an introduction, and a `## name` section for each function of the
//   topic, holding notes and examples only where they help (often none).
//
// Every function a program can call belongs to exactly one topic; test/reference.test.ts
// checks that, and that the pages written are the ones this would write.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { K, spell, mold, form, type Cell, type BlockCell, type Ctx } from '../src/core/index.ts';
import { startHost, startUi } from '../src/host/index.ts';

const DOCS = join(import.meta.dirname, '..', 'docs');
export const NOTES = join(DOCS, '_reference');
export const OUT = join(DOCS, 'reference');

/** Functions the host calls from DOM events: no program calls them. */
const HOST_ONLY = /^ui-/;

interface Topic { file: string; title: string; intro: string; sections: Array<{ name: string; notes: string }> }

/** The topics in docs/_reference, in the order of their file names. */
export function readTopics(dir = NOTES): Topic[] {
  return readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'index.md').sort().map(file => {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');
    const title = /^# (.+)$/.exec(lines[0] ?? '')?.[1];
    if (title === undefined) throw new Error(`${file}: the first line must be "# Title"`);
    // the introduction, then one block of lines per `## name` (a `##` inside a code block is code)
    const parts: Array<{ name: string; lines: string[] }> = [{ name: '', lines: [] }];
    let fence = false;
    for (const line of lines.slice(1)) {
      if (/^```/.test(line)) fence = !fence;
      const m = fence ? null : /^## (\S+)\s*$/.exec(line);
      if (m !== null) parts.push({ name: m[1]!, lines: [] });
      else parts[parts.length - 1]!.lines.push(line);
    }
    const [intro, ...sections] = parts.map(p => ({ name: p.name, notes: p.lines.join('\n').trim() }));
    return { file, title, intro: intro!.notes, sections };
  });
}

/** The functions a program sees, by name: the UI's and the host's before lib's. */
export async function functions(): Promise<Map<string, Cell>> {
  const loader = { base: 'file:///', read: (href: string) => readFile(fileURLToPath(href), 'utf8') };
  const host = startHost({ loader });
  await startUi(host);
  const out = new Map<string, Cell>();
  const add = (ctx: Ctx) => ctx.keys.forEach((k, i) => {
    const v = ctx.vals[i];
    const name = spell(k);
    if (v !== undefined && isFunction(v) && !HOST_ONLY.test(name) && !out.has(name)) out.set(name, v);
  });
  add(host.rt.user);
  add(host.rt.lib);
  return out;
}

function isFunction(c: Cell): boolean {
  return c.t === K.Native || c.t === K.Op || c.t === K.Function;
}

/** The spec block of a function; of an operator, the function it calls. */
function specOf(c: Cell): BlockCell {
  const p = (c as { p: { specBlock?: BlockCell; fn?: Cell } }).p;
  return p.fn !== undefined ? specOf(p.fn) : p.specBlock!;
}

interface Entry { name: string; doc: string | null; types: Cell[] | null; args: Entry[] }

/** What a spec says, read as `help` reads it. */
function readSpec(spec: BlockCell): { about: string | null; args: Entry[]; refs: Entry[]; ret: Entry | null } {
  let about: string | null = null;
  const args: Entry[] = [];
  const refs: Entry[] = [];
  let ret: Entry | null = null;
  let target = args;
  let entry: Entry | null = null;
  for (const item of spec.s.data.slice(spec.i)) {
    if (item.t === K.Refinement && spell(item.sym) === 'local') break;
    if (item.t === K.String) {
      if (entry !== null) entry.doc = form(item);
      else about = form(item);
    } else if (item.t === K.Block) {
      if (entry !== null) entry.types = item.s.data.slice(item.i);
    } else if (item.t === K.Refinement) {
      entry = { name: mold(item), doc: null, types: null, args: [] };
      refs.push(entry);
      target = entry.args;
    } else if (item.t === K.SetWord) {
      entry = ret = { name: mold(item), doc: null, types: null, args: [] };
    } else if (item.t === K.Word || item.t === K.LitWord || item.t === K.GetWord) {
      entry = { name: mold(item), doc: null, types: null, args: [] };
      target.push(entry);
    }
  }
  return { about, args, refs, ret };
}

/** Text for Markdown: the characters MyST would read as markup are escaped. */
function esc(s: string): string {
  return s.replace(/[\\`*_[\]<>|]/g, c => `\\${c}`);
}

/** The label of a function's section: `fn-` and its name, with any sign spelled out. */
export function label(name: string): string {
  return 'fn-' + name.replace(/[^a-z0-9-]/g, c => `-${c.charCodeAt(0).toString(16)}`);
}

function types(e: Entry): string {
  return e.types === null || e.types.length === 0 ? 'any value' : e.types.map(t => `\`${form(t)}\``).join(' ');
}

/** The generated part of a function's section. */
function describe(name: string, fn: Cell): string {
  const { about, args, refs, ret } = readSpec(specOf(fn));
  const out: string[] = [];
  const op = fn.t === K.Op;
  const usage = op
    ? `${args[0]?.name ?? 'value1'} ${name} ${args[1]?.name ?? 'value2'}`
    : [name, ...args.map(a => a.name)].join(' ');
  if (about !== null) out.push(esc(about));
  if (op) {
    const called = (fn as { p: { fn: Cell } }).p.fn;
    const of = [...known.entries()].find(([n, c]) => c === called && n !== name)?.[0];
    if (of !== undefined) {
      out.push(`An operator, written between its values: \`${usage}\` is \`${[of, ...args.map(a => a.name)].join(' ')}\` `
        + `(see [\`${of}\`](#${label(of)})).`);
    }
  }
  out.push('```text\n' + usage + '\n```');
  // one list: the arguments, then the refinements (each with the arguments it takes), as `name (types): what it is`
  const item = (name: string, takes: string, docs: Array<string | null>) => {
    const said = docs.filter(d => d !== null).map(d => esc(d!)).join('; ');
    return `- \`${name}\`${takes === '' ? '' : ` (${takes})`}${said === '' ? '' : `: ${said}`}`;
  };
  const items = [
    ...args.map(a => item(a.name, types(a), [a.doc])),
    ...refs.map(r => item(
      [r.name, ...r.args.map(a => a.name)].join(' '),
      r.args.length === 1 ? types(r.args[0]!) : r.args.map(a => `\`${a.name}\` ${types(a)}`).join(', '),
      [r.doc, ...r.args.map(a => (a.doc === null ? null : `${a.name}: ${a.doc}`))],
    )),
  ];
  if (items.length > 0) out.push(items.join('\n'));
  if (ret !== null && ret.types !== null) {
    out.push(`Gives ${types(ret)}${ret.doc === null ? '.' : `: ${esc(ret.doc)}`}`);
  }
  return out.join('\n\n');
}

/** Every function, for an operator to name the one it calls. */
let known = new Map<string, Cell>();

/** The pages of docs/reference, by file name. */
export async function pages(): Promise<Map<string, string>> {
  known = await functions();
  const topics = readTopics();
  const out = new Map<string, string>();
  const where = new Map<string, string>();
  for (const t of topics) {
    const body = [`# ${t.title}`, t.intro];
    for (const s of t.sections) {
      const fn = known.get(s.name);
      if (fn === undefined) throw new Error(`${t.file}: ${s.name} is not a function`);
      if (where.has(s.name)) throw new Error(`${t.file}: ${s.name} is in ${where.get(s.name)} already`);
      where.set(s.name, t.file);
      body.push(`(${label(s.name)})=\n## ${esc(s.name)}\n\n${describe(s.name, fn)}` + (s.notes === '' ? '' : `\n\n${s.notes}`));
    }
    out.set(t.file.replace(/^\d+-/, ''), `${GENERATED}\n\n${body.filter(b => b !== '').join('\n\n')}\n`);
  }
  const missing = [...known.keys()].filter(n => !where.has(n));
  if (missing.length > 0) throw new Error(`no topic in docs/_reference for: ${missing.join(' ')}`);
  out.set('index.md', index(topics, readFileSync(join(NOTES, 'index.md'), 'utf8').trim(), [...where.keys()]));
  return out;
}

const GENERATED = '<!-- Written by tools/reference.ts (npm run reference) from docs/_reference: change those, not this. -->';

function index(topics: Topic[], intro: string, names: string[]): string {
  const toc = topics.map(t => t.file.replace(/^\d+-/, '').replace(/\.md$/, '')).join('\n');
  const groups = new Map<string, string[]>();
  for (const n of names.sort((a, b) => a.localeCompare(b, 'en'))) {
    const key = /^[a-z]/.test(n) ? n[0]!.toUpperCase() : 'Signs';
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === 'Signs' ? -1 : b === 'Signs' ? 1 : a.localeCompare(b)));
  const az = keys.map(k => `### ${k}\n\n${groups.get(k)!.map(n => `[\`${n}\`](#${label(n)})`).join(' · ')}`);
  return `${GENERATED}\n\n${intro}\n\n\`\`\`{toctree}\n:maxdepth: 1\n\n${toc}\n\`\`\`\n\n## Every function\n\n${az.join('\n\n')}\n`;
}

/** Writes docs/reference, replacing what was there. */
export async function writeReference(): Promise<void> {
  const out = await pages();
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  for (const [file, text] of out) writeFileSync(join(OUT, file), text);
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) {
  try {
    await writeReference();
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
