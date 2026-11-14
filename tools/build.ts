// Builds the files the npm package runs, as plain JavaScript:
//
//   node tools/build.ts [out]          (default: dist)
//
// out/trebol.js is the browser runtime in one module, with the UI dialect
// (src/ui/*.trb) inside, so a page needs nothing else:
//
//   <script type="module" src=".../trebol.js"></script>
//   <script type="text/trebol" src="app.trb"></script>
//
// out/cli.js is the `trebol` command. Node does not strip the types of a .ts
// file under node_modules, so an installed package cannot run tools/cli.ts.
//
// out/lib/ is what `import 'trebol/core'` (and host, browser) loads: src/ as
// JavaScript with its type declarations, one file per module, so core and host
// share one core. The UI dialect's .trb files go next to it, where the host
// looks for them.

import { build, type BuildOptions, type Plugin } from 'esbuild';
import { cpSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = join(import.meta.dirname, '..');
const SOURCES = 'trebol:sources';

/** A module that puts the UI dialect's sources into the bundle, under the URLs the host imports them by. */
const sources: Plugin = {
  name: 'trebol-sources',
  setup(b) {
    b.onResolve({ filter: /^trebol:sources$/ }, () => ({ path: SOURCES, namespace: 'trebol' }));
    b.onLoad({ filter: /.*/, namespace: 'trebol' }, () => {
      const text = (name: string): string => JSON.stringify(readFileSync(join(ROOT, 'src', 'ui', name), 'utf8'));
      return {
        resolveDir: ROOT,
        loader: 'js',
        contents: `import { addBuiltIn } from './src/host/modules.ts';
import { UI_SOURCE, I18N_SOURCE, TEST_SOURCE } from './src/host/index.ts';
addBuiltIn(UI_SOURCE, ${text('ui.trb')});
addBuiltIn(I18N_SOURCE, ${text('i18n.trb')});
addBuiltIn(TEST_SOURCE, ${text('test.trb')});`,
      };
    });
  },
};

/** Builds trebol.js, cli.js and lib/ into out. The sources module is imported first, so it runs before the boot. */
export async function buildDist(out: string): Promise<void> {
  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  execFileSync(process.execPath, [tsc, '-p', join(ROOT, 'tsconfig.build.json'), '--outDir', join(out, 'lib')], { stdio: 'inherit' });
  cpSync(join(ROOT, 'src', 'ui'), join(out, 'lib', 'ui'), { recursive: true });
  const common: BuildOptions = { bundle: true, format: 'esm', plugins: [sources], logLevel: 'warning', legalComments: 'none' };
  await build({
    ...common,
    stdin: { contents: `import '${SOURCES}'; import './src/host/browser.ts';`, resolveDir: ROOT, loader: 'js' },
    outfile: join(out, 'trebol.js'),
    platform: 'browser',
    target: 'es2022',
    minify: true,
  });
  await build({
    ...common,
    stdin: { contents: `import '${SOURCES}'; import './tools/cli.ts';`, resolveDir: ROOT, loader: 'js' },
    outfile: join(out, 'cli.js'),
    platform: 'node',
    target: 'node22',
    // ws, which the tutorial's supplier uses, is CommonJS and requires Node's modules
    banner: { js: "#!/usr/bin/env -S node --disable-warning=ExperimentalWarning\nimport { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);" },
  });
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) {
  await buildDist(resolve(process.argv[2] ?? join(ROOT, 'dist')));
}
