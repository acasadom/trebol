// `trebol build [folder] [--out dir]`: the app as one page to put on any web server.
//
// out/index.html (default: folder/build) has inside it the browser runtime, the Inter font and every
// .trb of the folder and its subfolders (not the *.test.trb, node_modules or the out folder), so
// `import`, `do` and `read` of them ask no server and the page opens even from a file. The images,
// sounds, videos, scripts and data files of the folder are copied next to it with the same paths;
// anything else (the app's backend, package.json, dotfiles) stays out. A package the app imports by
// name (`import 'trebol-es`), found in node_modules as Node finds it, goes in too: its package.json
// and its .trb, under node_modules/<name>/, where the page looks for them.
//
// The page has only the fonts its own text needs beyond Latin: Latin and Latin Extended always, the
// Cyrillic, Greek and Vietnamese files only when some .trb has one of their letters. Other letters
// show in the system font.
//
// With --csp the runtime and the fonts go next to the page instead, as trebol.js and fonts/ (every
// font: the browser downloads only those its text needs), so a server whose Content-Security-Policy
// says script-src 'self' and style-src 'self' runs it; such a page needs a web server. The .trb stay
// inside: a <script type="application/json"> is data, which a policy does not block.

import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { K, load, scriptStart, spell, text, type Cell, type StringCell } from '../src/core/index.ts';
import { INTER, interCss, inRange } from '../src/host/fonts.ts';

/** The files copied next to the page, by extension. */
const ASSETS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico',
  '.mp4', '.webm', '.ogg', '.ogv', '.mp3', '.m4a', '.wav', '.vtt',
  '.js', '.mjs', '.css', '.woff2', '.woff', '.pdf',
  '.json', '.csv', '.xml', '.txt', '.md',
]);

/** Files that are the project's, not the app's. */
const LEFT_OUT = new Set(['index.html', 'package.json', 'package-lock.json']);

/** Tells a page made here, so a second build may replace its folder. */
const MARK = '<meta name="generator" content="trebol build">';

/** The fonts every page has: Latin and Latin Extended. */
const ALWAYS = new Set(['inter-latin.woff2', 'inter-latin-ext.woff2']);

export interface Built {
  page: string;
  /** Size of index.html in bytes. */
  size: number;
  /** The .trb files inside the page, by path from it; those of packages under node_modules/. */
  sources: string[];
  /** The files copied next to it. */
  copied: string[];
  /** With --csp, the runtime and fonts written next to it. */
  split: string[];
}

export interface BuildOptions {
  /** The runtime and fonts as files next to the page, for a strict Content-Security-Policy. */
  csp?: boolean;
}

/** The files of the folder, by path from it with / between names, leaving out dotfiles, node_modules and `skip`. */
async function filesOf(root: string, skip: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, e.name);
      if (e.name.startsWith('.') || e.name === 'node_modules' || path === skip) continue;
      if (e.isDirectory()) await walk(path);
      else if (e.isFile()) out.push(relative(root, path).split(sep).join('/'));
    }
  };
  await walk(root);
  return out.sort();
}

/** The packages a source imports by name: the lit-word after each `import`, at any depth. */
function packagesIn(src: string): string[] {
  let code;
  try {
    code = load(src);
  } catch {
    return [];
  }
  const out: string[] = [];
  const walk = (cells: readonly Cell[]): void => {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]!;
      const next = cells[i + 1];
      if (c.t === K.Word && spell(c.sym).toLowerCase() === 'import' && next?.t === K.LitWord) out.push(spell(next.sym));
      else if (c.t === K.Block || c.t === K.Paren) walk(c.s.data.slice(c.i));
    }
  };
  walk(code.s.data.slice(code.i));
  return out;
}

/** The folder of a package: node_modules/<name> in `from` or the nearest folder above it that has one. */
function packageDir(from: string, name: string): string {
  for (let dir = from; ; dir = dirname(dir)) {
    const at = join(dir, 'node_modules', name);
    if (existsSync(join(at, 'package.json'))) return at;
    if (dirname(dir) === dir) throw new Error(`the app imports the package ${name}, which is not in node_modules`);
  }
}

/** The texts of every package the sources import, and of those these import, by path from the page. */
async function packagesOf(root: string, texts: Record<string, string>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const done = new Set<string>();
  const todo = Object.values(texts).flatMap(src => packagesIn(src).map(name => ({ name, from: root })));
  while (todo.length > 0) {
    const { name, from } = todo.shift()!;
    if (done.has(name)) continue;
    done.add(name);
    const dir = packageDir(from, name);
    out[`node_modules/${name}/package.json`] = await readFile(join(dir, 'package.json'), 'utf8');
    for (const f of await filesOf(dir, '')) {
      if (!f.endsWith('.trb') || f.endsWith('.test.trb')) continue;
      const src = await readFile(join(dir, f), 'utf8');
      out[`node_modules/${name}/${f}`] = src;
      for (const n of packagesIn(src)) todo.push({ name: n, from: dir });
    }
  }
  return out;
}

/** The title in the header of app.trb, or null. */
function titleOf(src: string): string | null {
  let header;
  try {
    header = scriptStart(load(src)).header;
  } catch {
    return null; // the page shows the load error when it runs
  }
  if (header === null) return null;
  const d = header.s.data;
  for (let i = header.i; i + 1 < d.length; i++) {
    const c = d[i]!;
    const v = d[i + 1]!;
    if (c.t === K.SetWord && spell(c.sym).toLowerCase() === 'title' && v.t === K.String) return text(v as StringCell);
  }
  return null;
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** JavaScript that can sit inside a <script>: no `</script` or `<!--` in its text (`\x3C` is `<` in a string or a regex). */
export function scriptSafe(js: string): string {
  return js.replace(/<(\/script|!--)/gi, '\\x3C$1');
}

/** The browser runtime: dist/trebol.js next to the built command, or built from src/ in a checkout. */
async function runtime(): Promise<string> {
  const built = join(import.meta.dirname, 'trebol.js');
  if (existsSync(built)) return readFile(built, 'utf8');
  // a path esbuild cannot follow, so the built command does not take esbuild in
  const tools = pathToFileURL(join(import.meta.dirname, 'build.ts')).href;
  const { runtimeJs } = (await import(tools)) as { runtimeJs: () => Promise<string> };
  return runtimeJs();
}

/** Fonts folder of the runtime in use: dist/fonts, or src/host/fonts in a checkout. */
function fontsDir(): string {
  const built = join(import.meta.dirname, 'fonts');
  return existsSync(built) ? built : join(import.meta.dirname, '..', 'src', 'host', 'fonts');
}

/** Builds the app in `folder` into `out`; throws an Error with a message for the user when it cannot. */
export async function buildApp(folder: string, out?: string, options: BuildOptions = {}): Promise<Built> {
  const root = resolve(folder);
  const dest = resolve(out ?? join(root, 'build'));
  if (!existsSync(join(root, 'app.trb'))) throw new Error(`no app.trb in ${folder}`);
  if (dest === root || root.startsWith(dest + sep)) throw new Error('the out folder cannot hold the app');
  if (existsSync(dest)) {
    const entries = await readdir(dest);
    const ours = entries.includes('index.html') && (await readFile(join(dest, 'index.html'), 'utf8')).includes(MARK);
    if (entries.length > 0 && !ours) throw new Error(`${dest} has files not made by trebol build; give another --out`);
  }

  const files = await filesOf(root, dest);
  const sources = files.filter(f => f.endsWith('.trb') && !f.endsWith('.test.trb'));
  const copied = files.filter(f => ASSETS.has(extname(f).toLowerCase()) && !LEFT_OUT.has(f));
  const clash = options.csp ? copied.find(f => f === 'trebol.js' || f.startsWith('fonts/')) : undefined;
  if (clash !== undefined) throw new Error(`${clash} would take the place of the runtime or its fonts; move it to build with --csp`);
  const texts: Record<string, string> = {};
  for (const f of sources) texts[f] = await readFile(join(root, f), 'utf8');
  const packages = await packagesOf(root, texts);
  Object.assign(texts, packages);

  // the letters of the app choose its fonts
  const used = new Set<number>();
  for (const src of Object.values(texts)) for (const ch of src) if (ch.codePointAt(0)! > 0x24f) used.add(ch.codePointAt(0)!);
  const faces = INTER.filter(f => ALWAYS.has(f.file) || [...used].some(cp => inRange(f.range, cp)));
  const fonts = fontsDir();
  const data = new Map<string, string>();
  for (const f of faces) data.set(f.file, (await readFile(join(fonts, f.file))).toString('base64'));
  const license = (await readFile(join(fonts, 'OFL.txt'), 'utf8')).trim();

  const title = escapeHtml(titleOf(texts['app.trb']!) ?? 'Trebol');
  // < as < keeps the JSON from closing its script
  const json = JSON.stringify(texts).replace(/</g, '\\u003c');
  const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${MARK}
<title>${title}</title>
`;
  const tail = `<script type="text/trebol" src="app.trb"></script>
</head>
<body></body>
</html>
`;
  const page = options.csp
    ? `${head}<script type="application/json" id="trebol-files">${json}</script>
<script type="module" src="trebol.js"></script>
${tail}`
    : `${head}<!-- The font Inter:
${license.replace(/--/g, '- -')}
-->
<style data-tb-fonts>
${interCss(file => `data:font/woff2;base64,${data.get(file)}`, faces)}
</style>
<script type="application/json" id="trebol-files">${json}</script>
<script type="module">${scriptSafe(await runtime())}</script>
${tail}`;

  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await writeFile(join(dest, 'index.html'), page);
  const split: string[] = [];
  if (options.csp) {
    await writeFile(join(dest, 'trebol.js'), await runtime());
    await mkdir(join(dest, 'fonts'));
    for (const f of [...INTER.map(i => i.file), 'OFL.txt']) await cp(join(fonts, f), join(dest, 'fonts', f));
    split.push('trebol.js', 'fonts/');
  }
  for (const f of copied) {
    await mkdir(dirname(join(dest, f)), { recursive: true });
    await cp(join(root, f), join(dest, f));
  }
  return { page: join(dest, 'index.html'), size: (await stat(join(dest, 'index.html'))).size, sources: [...sources, ...Object.keys(packages).filter(f => f.endsWith('.trb'))], copied, split };
}
