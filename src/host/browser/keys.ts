// --- keys -----------------------------------------------------------------------
//
// Keys as Trebol sees them (event/key), shortcuts of buttons and links, and the keys of the page as a whole.

import { K, TRUE, FALSE, string, form, spell, text, wordOf, char, type Cell, type ObjectCell, type WordCell, type StringCell } from '../../core/index.ts';
import { openPalette, type PaletteEntry } from '../palette.ts';
import { inDevtools } from '../devtools.ts';
import { str, own } from './faces.ts';
import { byCtx, fire } from './mount.ts';
import { fireEvent, seenKeys, viewKeys, shortcuts } from './events.ts';
import { undoToasts, inTextBox } from './dialogs.ts';
import { rootFace } from './page.ts';

export const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Dead', 'Unidentified']);

/** Keys that are characters in Red's event/key. */
export const KEY_CHARS: Record<string, number> = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8 };
/** Keys that are words in Red's event/key. */
export const KEY_WORDS: Record<string, string> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'home', End: 'end',
  PageUp: 'page-up', PageDown: 'page-down', Insert: 'insert', Delete: 'delete',
};

/** A key as Red gives it in event/key: a char! (#"a", #"^M" for Enter) or a word ('left, 'F2). */
export function keyCell(ev: KeyboardEvent): Cell | null {
  if (MODIFIER_KEYS.has(ev.key)) return null;
  const c = KEY_CHARS[ev.key];
  if (c !== undefined) return char(c);
  const cps = [...ev.key];
  if (cps.length === 1) return char(cps[0]!.codePointAt(0)!);
  if (/^F\d+$/.test(ev.key)) return wordOf(K.LitWord, ev.key);
  return wordOf(K.LitWord, KEY_WORDS[ev.key] ?? ev.key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());
}

export function keyWords(ev: KeyboardEvent): [string, Cell][] {
  const b = (x: boolean): Cell => x ? TRUE : FALSE;
  return [['key', keyCell(ev)!], ['ctrl?', b(ev.ctrlKey)], ['shift?', b(ev.shiftKey)], ['alt?', b(ev.altKey)], ['meta?', b(ev.metaKey)], ['typing?', b(inTextBox(ev.target))]];
}

export const APPLE = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const KEY_NAMES: Record<string, string> = {
  esc: 'escape', space: ' ', del: 'delete', up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright',
};

export interface Shortcut { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }

/** "Ctrl+Shift+K" -> its parts; Ctrl also means Cmd on Apple devices. */
export function parseShortcut(spec: string): Shortcut {
  const parts = spec.toLowerCase().split('+').map(p => p.trim());
  const key = parts.pop() ?? '';
  const has = (...names: string[]): boolean => parts.some(p => names.includes(p));
  return { key: KEY_NAMES[key] ?? key, ctrl: has('ctrl', 'control'), shift: has('shift'), alt: has('alt', 'option'), meta: has('meta', 'cmd') };
}

export function matches(ev: KeyboardEvent, s: Shortcut): boolean {
  const ctrl = APPLE ? ev.metaKey || ev.ctrlKey : ev.ctrlKey;
  if (ctrl !== (s.ctrl || (APPLE && s.meta)) || ev.shiftKey !== s.shift || ev.altKey !== s.alt) return false;
  if (!APPLE && ev.metaKey !== s.meta) return false;
  // letters and digits by physical key, so Shift or Alt do not change them
  if (/^[a-z]$/.test(s.key)) return ev.code === `Key${s.key.toUpperCase()}`;
  if (/^[0-9]$/.test(s.key)) return ev.code === `Digit${s.key}`;
  return ev.key.toLowerCase() === s.key;
}

/** How a shortcut is announced (aria-keyshortcuts) and shown (tooltip). */
export function shortcutAria(spec: string): string {
  return spec.split('+').map(p => {
    const w = p.trim().toLowerCase();
    if (w === 'ctrl' || w === 'control') return APPLE ? 'Meta' : 'Control';
    if (w === 'cmd') return 'Meta';
    return p.trim().length === 1 ? p.trim().toUpperCase() : p.trim();
  }).join('+');
}

export function shortcutLabel(spec: string): string {
  return APPLE ? spec.replace(/ctrl|control/i, 'Cmd') : spec;
}

/** Shortcuts beat the browser's own keys; the view's on-key gets keys nobody handled. */
export function onKeyDown(ev: KeyboardEvent): void {
  if (inDevtools(ev.target)) return;
  const modal = Array.from(document.querySelectorAll('dialog[open]')).pop();
  for (const m of shortcuts) {
    if (!m.el.isConnected) { shortcuts.delete(m); continue; }
    const spec = str(m.face, 'shortcut');
    if (spec === null || !matches(ev, parseShortcut(spec))) continue;
    // only what the user can see: not in a hidden tab, a closed dialog or behind a modal
    if (m.el.getClientRects().length === 0 || (modal !== undefined && !modal.contains(m.el))) continue;
    ev.preventDefault();
    seenKeys.add(ev);
    m.el.click();
    return;
  }
  // Ctrl+Z (⌘Z) out of a text box: the Undo of the newest notice on show; a text box undoes its own typing
  if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && ev.key.toLowerCase() === 'z' && undoToasts.size > 0 && modal === undefined && !inTextBox(ev.target)) {
    const newest = [...undoToasts.values()].pop()!;
    ev.preventDefault();
    seenKeys.add(ev);
    newest.querySelector<HTMLButtonElement>('.tb-toast-undo')?.click();
    return;
  }
  // Ctrl+K (⌘K): the palette, unless a button of the app has those keys (above) or a dialog is open
  if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && ev.key.toLowerCase() === 'k' && rootFace !== null && modal === undefined) {
    ev.preventDefault();
    seenKeys.add(ev);
    showPalette(rootFace);
  }
}

/** Opens the palette of the view on show: what it finds comes from ui-palette. */
export function showPalette(view: ObjectCell): void {
  openPalette({
    label: own('palette'),
    placeholder: own('palette-search'),
    nothing: own('palette-none'),
    search: async typed => {
      const got = await fire('ui-palette', view, string(typed));
      if (got.t !== K.Block) return [];
      const d = got.s.data.slice(got.i);
      const out: PaletteEntry[] = [];
      for (let i = 0; i + 3 < d.length; i += 4) {
        const kind = d[i + 1]!.t === K.Word ? spell((d[i + 1] as WordCell).sym) : '';
        const keys = d[i + 2]!.t === K.String ? text(d[i + 2] as StringCell) : null;
        const hint = kind === 'screen' ? own('palette-screen') : keys !== null ? shortcutLabel(keys) : '';
        out.push({ label: form(d[i]!), hint, target: [kind, d[i + 3]!] });
      }
      return out;
    },
    pick: e => {
      const [kind, target] = e.target as [string, Cell];
      // a button or link is clicked, as the user would
      if (kind === 'action' && target.t === K.Object) {
        const m = byCtx.get((target as ObjectCell).ctx);
        if (m?.el.isConnected === true) m.el.click();
      } else void fire('ui-palette-pick', view, wordOf(K.Word, kind), target);
    },
  });
}

export function onViewKey(ev: KeyboardEvent): void {
  if (inDevtools(ev.target)) return;
  if (viewKeys === null || seenKeys.has(ev) || keyCell(ev) === null) return;
  fireEvent(viewKeys, 'on-key', keyWords(ev));
}

