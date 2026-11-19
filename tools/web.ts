// The website, trebol-lang.com, as one folder of plain files:
//
//   node tools/web.ts [out]          (default: _site)
//
// out/ is the app of site/ built by `trebol build` (the front page, the gallery and the games), out/docs/ is
// the documentation Sphinx built into docs/_build/html (run `npm run docs` first), out/designer/ is the
// designer of trebol-dev (its app/, from a checkout in $TREBOL_DEV or ../trebol-dev) as a demo page, and
// out/404.html sends an address of the documentation from before it moved under docs/ to its new place.

import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildApp } from './bundle.ts';

const ROOT = join(import.meta.dirname, '..');
const DOCS = join(ROOT, 'docs', '_build', 'html');
/** A checkout of trebol-dev, whose app/ is the designer. */
const DESIGNER = resolve(process.env.TREBOL_DEV ?? join(ROOT, '..', 'trebol-dev'), 'app');

/** A page for addresses that are not there: one outside docs/ is tried again under it, once. */
export const NOT_FOUND = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found · Trebol</title>
<script>
  var p = location.pathname;
  if (p.indexOf('/docs/') !== 0) location.replace('/docs' + p + location.search + location.hash);
</script>
</head>
<body style="font-family: system-ui, sans-serif; margin: 3em auto; max-width: 32em; padding: 0 16px">
<h1>Not found</h1>
<p>There is no page here. Try <a href="/">the front page</a> or <a href="/docs/">the documentation</a>.</p>
</body>
</html>
`;

export async function buildWeb(out: string): Promise<void> {
  if (!existsSync(join(DOCS, 'index.html'))) throw new Error('no documentation in docs/_build/html: run npm run docs first');
  rmSync(out, { recursive: true, force: true });
  await buildApp(join(ROOT, 'site'), out);
  cpSync(DOCS, join(out, 'docs'), { recursive: true });
  rmSync(join(out, 'docs', '.buildinfo'), { force: true });
  if (existsSync(join(DESIGNER, 'app.trb'))) await buildApp(DESIGNER, join(out, 'designer'));
  else console.warn(`web: no designer at ${DESIGNER}: designer/ left out`);
  writeFileSync(join(out, '404.html'), NOT_FOUND);
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) {
  const out = resolve(process.argv[2] ?? join(ROOT, '_site'));
  await buildWeb(out);
  console.log(`web: ${out}`);
}
