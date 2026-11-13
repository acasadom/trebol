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
import { K, spell, mold, form, load, intern, ctxFind, type Cell, type BlockCell, type Ctx, type MapCell, type ObjectCell } from '../src/core/index.ts';
import { DEFAULT_THEME, THEME_WORDS, LOOKS } from '../src/host/theme.ts';
import { DRAW_COMMANDS, DRAW_COLORS, DRAW_ROLES } from '../src/host/draw.ts';
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

/** What the reference describes, read from a runtime with the UI dialect loaded. */
interface World {
  /** The functions a program sees, by name: the UI's and the host's before lib's. */
  fns: Map<string, Cell>;
  /** The UI dialect's styles: name -> prototype face. */
  styles: Map<string, ObjectCell>;
  /** The face every style starts from. */
  face: ObjectCell;
}

export async function world(): Promise<World> {
  const loader = { base: 'file:///', read: (href: string) => readFile(fileURLToPath(href), 'utf8') };
  const host = startHost({ loader });
  await startUi(host);
  const fns = new Map<string, Cell>();
  const add = (ctx: Ctx) => ctx.keys.forEach((k, i) => {
    const v = ctx.vals[i];
    const name = spell(k);
    if (v !== undefined && isFunction(v) && !HOST_ONLY.test(name) && !fns.has(name)) fns.set(name, v);
  });
  add(host.rt.user);
  add(host.rt.lib);
  const user = (name: string) => host.rt.user.vals[ctxFind(host.rt.user, intern(name))]!;
  const map = user('styles') as MapCell;
  const styles = new Map<string, ObjectCell>();
  for (let i = 0; i + 1 < map.s.data.length; i += 2) styles.set(form(map.s.data[i]!), map.s.data[i + 1] as ObjectCell);
  return { fns, styles, face: user('face') as ObjectCell };
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

/** The UI dialect's source, where its words are listed. */
const UI_TRB = join(import.meta.dirname, '..', 'src', 'ui', 'ui.trb');
const BROWSER_TS = join(import.meta.dirname, '..', 'src', 'host', 'browser.ts');

/** The lists of words of the dialect in ui.trb (`roles: [primary ...]`), by the name of each list. */
function wordLists(): Map<string, string[]> {
  const code = load(readFileSync(UI_TRB, 'utf8'));
  const d = code.s.data;
  const out = new Map<string, string[]>();
  for (let i = code.i; i + 1 < d.length; i++) {
    const c = d[i]!;
    const next = d[i + 1]!;
    if (c.t === K.SetWord && next.t === K.Block && WORD_LISTS[spell(c.sym)] !== undefined) {
      out.set(spell(c.sym), next.s.data.slice(next.i).map(w => form(w)));
    }
  }
  return out;
}

/** The lists of ui.trb the dialect reads words from, and what a word of each is. */
const WORD_LISTS: Record<string, string> = {
  roles: 'A role', sizes: 'A size', aligns: 'An alignment of the children', valigns: 'A vertical alignment of a row\'s children',
  flags: 'A flag', 'media-flags': 'A flag of a video or a sound', 'simple-rules': 'A rule', 'rule-words': 'A word followed by its value', 'chart-kinds': 'A kind of chart',
};

/** The events a face can have a handler for: the ones the dialect and the host run. */
function events(): string[] {
  const names = new Set<string>();
  for (const m of readFileSync(UI_TRB, 'utf8').matchAll(/'(on-[a-z]+(?:-[a-z]+)*)/g)) names.add(m[1]!);
  for (const m of readFileSync(BROWSER_TS, 'utf8').matchAll(/['"](on-[a-z]+(?:-[a-z]+)*)['"]/g)) names.add(m[1]!);
  return [...names].sort();
}

/** The value a face field holds, as it would be written in a layout. */
function fieldOf(obj: ObjectCell, name: string): Cell | undefined {
  const i = ctxFind(obj.ctx, intern(name));
  return i < 0 ? undefined : obj.ctx.vals[i];
}

/** A page of the reference that is not about functions: what its sections are and what is said of each. */
interface Kind { names: (w: World) => string[]; prefix: string; describe: (w: World, name: string) => string }

const KINDS: Record<string, Kind> = {
  'styles.md': {
    names: w => [...w.styles.keys()],
    prefix: 'style',
    describe: (w, name) => {
      const proto = w.styles.get(name)!;
      const base = form(fieldOf(proto, 'style')!);
      // what it starts with that a plain face does not
      const own = w.face.ctx.keys.map(spell).filter(k => k !== 'style' && mold(fieldOf(proto, k)!) !== mold(fieldOf(w.face, k)!));
      const said: string[] = [];
      if (base !== name) said.push(`Made from [\`${base}\`](#${dialectLabel('style', base)}).`);
      if (own.length > 0) said.push(`It starts with ${own.map(k => `\`${k}: ${mold(fieldOf(proto, k)!)}\``).join(', ')}.`);
      return said.join(' ');
    },
  },
  'dialect.md': {
    names: () => [...new Set([...[...wordLists().values()].flat(), ...events()])],
    prefix: 'word',
    describe: (_w, name) => {
      if (name.startsWith('on-')) return 'An event: the block after it runs when it happens.';
      const lists = [...wordLists()].filter(([, ws]) => ws.includes(name)).map(([l]) => WORD_LISTS[l]!.toLowerCase());
      return lists.length === 0 ? '' : `${lists.join('; ').replace(/^./, c => c.toUpperCase())}.`;
    },
  },
  'draw.md': {
    names: () => Object.keys(DRAW_COMMANDS),
    prefix: 'draw',
    describe: (_w, name) => {
      const said = [`Written \`${DRAW_COMMANDS[name]}\`.`];
      if (name === 'pen' || name === 'fill-pen') {
        said.push(`A color is a role of the theme (${DRAW_ROLES.map(r => `\`${r}\``).join(', ')}), one of Red's color words `
          + `(${Object.keys(DRAW_COLORS).map(c => `\`${c}\``).join(', ')}), or \`off\`.`);
      }
      return said.join(' ');
    },
  },
  'theme.md': {
    names: () => ['look', ...Object.keys(DEFAULT_THEME)],
    prefix: 'theme',
    describe: (_w, name) => {
      const words = name === 'look' ? Object.keys(LOOKS) : THEME_WORDS[name];
      const start = name === 'look' ? 'minimal' : (DEFAULT_THEME as unknown as Record<string, unknown>)[name];
      const said = words === undefined ? [] : [`Takes ${words.map(v => `\`${v}\``).join(', ')}.`];
      // accent's default follows base, so its notes say it
      if (start !== null && start !== undefined && name !== 'accent') said.push(`Without it, \`${String(start)}\`.`);
      return said.join(' ');
    },
  },
};

function dialectLabel(prefix: string, name: string): string {
  return label(name).replace(/^fn-/, `${prefix}-`);
}

/** Every function, for an operator to name the one it calls. */
let known = new Map<string, Cell>();

/** The pages of docs/reference, by file name. */
export async function pages(): Promise<Map<string, string>> {
  const w = await world();
  known = w.fns;
  const topics = readTopics();
  const out = new Map<string, string>();
  const where = new Map<string, string>();
  for (const t of topics) {
    const body = [`# ${t.title}`, t.intro];
    const kind = KINDS[t.file.replace(/^\d+-/, '')];
    if (kind !== undefined) {
      const want = kind.names(w);
      const have = t.sections.map(s => s.name);
      const missing = want.filter(n => !have.includes(n));
      const unknown = have.filter(n => !want.includes(n));
      if (missing.length > 0) throw new Error(`${t.file}: no section for ${missing.join(' ')}`);
      if (unknown.length > 0) throw new Error(`${t.file}: ${unknown.join(' ')} not in the dialect`);
      for (const s of t.sections) {
        const said = kind.describe(w, s.name);
        body.push(`(${dialectLabel(kind.prefix, s.name)})=\n## ${esc(s.name)}\n\n${[said, s.notes].filter(x => x !== '').join('\n\n')}`);
      }
      out.set(t.file.replace(/^\d+-/, ''), `${GENERATED}\n\n${body.filter(b => b !== '').join('\n\n')}\n`);
      continue;
    }
    for (const s of t.sections) {
      const fn = known.get(s.name);
      if (fn === undefined) throw new Error(`${t.file}: ${s.name} is not a function`);
      if (where.has(s.name)) throw new Error(`${t.file}: ${s.name} is in ${where.get(s.name)} already`);
      where.set(s.name, t.file);
      body.push(`(${label(s.name)})=\n## ${esc(s.name)}\n\n${describe(s.name, fn)}` + (s.notes === '' ? '' : `\n\n${s.notes}`));
    }
    out.set(t.file.replace(/^\d+-/, ''), `${GENERATED}\n\n${body.filter(b => b !== '').join('\n\n')}\n`);
  }
  for (const file of Object.keys(KINDS)) {
    if (!topics.some(t => t.file.replace(/^\d+-/, '') === file)) throw new Error(`docs/_reference has no page for ${file}`);
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
