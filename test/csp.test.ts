import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The browser host must work under a strict Content-Security-Policy (style-src 'self', script-src 'self')
// and never turn text into HTML: no <style> made by script, no style attribute, no HTML parsed from a string,
// no code run from a string. Its CSS goes in constructed style sheets and el.style, which a policy allows.
const HOST = join(import.meta.dirname, '..', 'src', 'host');
const BANNED: [RegExp, string][] = [
  [/createElement\(\s*['"]style['"]|\bel\(\s*['"]style['"]/, 'a <style> element'],
  [/setAttribute\(\s*['"]style['"]|\.cssText\s*=/, 'a style attribute'],
  [/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|createContextualFragment|parseFromString|document\.write/, 'HTML from a string'],
  [/\beval\(|new Function\(/, 'code from a string'],
];

test('csp: the browser host makes no inline style, HTML or code from strings', () => {
  const files = readdirSync(HOST, { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.ts'));
  assert.ok(files.some(f => f.includes('/')), 'the host parts in folders are read too');
  for (const file of files) {
    readFileSync(join(HOST, file), 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;
      for (const [re, what] of BANNED) assert.ok(!re.test(line), `${file}:${i + 1} makes ${what}: ${line.trim()}`);
    });
  }
});
