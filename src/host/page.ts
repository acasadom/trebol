// What a program asks of the browser around the page: open another address in
// a new tab, and put text on the clipboard or take it from there, as R3's
// browse and Red's write-clipboard / read-clipboard.
//
// They go through `page`, so the console can open the system's browser and
// the tests can watch what was asked; a host without them gives an access error.

import { NONE, UNSET, native, value, string, text, logic, throwError, type Cell, type StringCell } from '../core/index.ts';

const nav = (): Navigator | undefined => (globalThis as { navigator?: Navigator }).navigator;

/** Where the page natives reach the browser. Tests and the console point them elsewhere. */
export const page = {
  /** Opens an address in a new tab; false when this host cannot. */
  open: (url: string): boolean => {
    const win = (globalThis as { window?: Window }).window;
    if (win === undefined) return false;
    // with noopener window.open gives null, so the new tab is cut off by hand
    const tab = win.open(url, '_blank');
    if (tab !== null) tab.opener = null;
    return true;
  },
  /** Puts text on the clipboard; null when this host has no clipboard. */
  writeClipboard: (s: string): Promise<boolean> | null => {
    const c = nav()?.clipboard;
    return c === undefined ? null : c.writeText(s).then(() => true, () => false);
  },
  /** The text on the clipboard, or null when there is none or the user refused; null at once when this host has no clipboard. */
  readClipboard: (): Promise<string | null> | null => {
    const c = nav()?.clipboard;
    return c === undefined ? null : c.readText().then(s => s, () => null);
  },
};

native('browse', '["Opens a web address in a new tab." url [url! file!]]', (_t, f) => {
  if (!page.open(text(f.args[0] as StringCell))) return throwError('access', 'no-browse', 'this host cannot open web addresses');
  return value(UNSET);
});

native('write-clipboard', '["Puts text on the clipboard; true when it is there." data [string!]]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  const p = page.writeClipboard(text(f.args[0] as StringCell));
  if (p === null) return throwError('access', 'no-clipboard', 'this host has no clipboard');
  return { k: 'await', p: p.then(logic) };
});

native('read-clipboard', '["The text on the clipboard, or none; the browser may ask the user first."]', (_t, f, v) => {
  if (f.phase === 1) return value(v!);
  f.phase = 1;
  const p = page.readClipboard();
  if (p === null) return throwError('access', 'no-clipboard', 'this host has no clipboard');
  return { k: 'await', p: p.then((s): Cell => s === null || s === '' ? NONE : string(s)) };
});
