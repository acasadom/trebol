// `trebol build [folder] [--out dir]`: the app as one page to put on any web server.
//
// out/index.html (default: folder/build) has inside it the browser runtime, the Inter font and every
// .trb of the folder and its subfolders (not the *.test.trb, node_modules or the out folder), so
// `import`, `do` and `read` of them ask no server and the page opens even from a file. The images,
// sounds, videos, scripts and data files of the folder are copied next to it with the same paths;
// anything else (the app's backend, package.json, dotfiles) stays out.
//
// The page has only the fonts its own text needs beyond Latin: Latin and Latin Extended always, the
// Cyrillic, Greek and Vietnamese files only when some .trb has one of their letters. Other letters
// show in the system font.

import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { K, load, scriptStart, spell, text, type StringCell } from '../src/core/index.ts';
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
  /** The .trb files inside the page, by path from it. */
  sources: string[];
  /** The files copied next to it. */
  copied: string[];
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
export async function buildApp(folder: string, out?: string): Promise<Built> {
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
  const texts: Record<string, string> = {};
  for (const f of sources) texts[f] = await readFile(join(root, f), 'utf8');

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
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${MARK}
<title>${title}</title>
<!-- The font Inter:
${license.replace(/--/g, '- -')}
-->
<style data-tb-fonts>
${interCss(file => `data:font/woff2;base64,${data.get(file)}`, faces)}
</style>
<script type="application/json" id="trebol-files">${json}</script>
<script type="module">${scriptSafe(await runtime())}</script>
<script type="text/trebol" src="app.trb"></script>
</head>
<body></body>
</html>
`;

  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await writeFile(join(dest, 'index.html'), page);
  for (const f of copied) {
    await mkdir(dirname(join(dest, f)), { recursive: true });
    await cp(join(root, f), join(dest, f));
  }
  return { page: join(dest, 'index.html'), size: (await stat(join(dest, 'index.html'))).size, sources, copied };
}
