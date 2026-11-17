// --- reading faces -----------------------------------------------------------------

import { K, NONE, mold, form, ctxFind, intern, spell, type Cell, type ObjectCell, type WordCell, type Runtime } from '../../core/index.ts';
import { translate } from '../index.ts';
import { MAX_MOLD, side } from './state.ts';

export function get(face: ObjectCell, name: string): Cell {
  const i = ctxFind(face.ctx, intern(name));
  return i < 0 ? NONE : face.ctx.vals[i]!;
}

export function wordText(v: Cell): string | null {
  return v.t === K.Word || v.t === K.LitWord ? spell((v as WordCell).sym) : null;
}

export function short(s: string, most = 80): string {
  const line = s.replace(/\s+/g, ' ');
  return line.length > most ? line.slice(0, most - 1) + '…' : line;
}

/** How a face is named in the tree, the log and errors: its style, name and text (`field email "Email"`). */
export function faceRef(face: ObjectCell, rt: Runtime): string {
  const style = wordText(get(face, 'style')) ?? 'face';
  const name = wordText(get(face, 'name'));
  const t = get(face, 'text');
  const shown = t.t === K.None ? null : t.t === K.String || t.t === K.Map || t.t === K.Word ? translate(t, rt) : form(t);
  return [style, name, shown !== null && shown !== '' ? `"${short(shown, 40)}"` : null].filter(x => x !== null).join(' ');
}

export function on(face: ObjectCell, name: string): boolean {
  const v = get(face, name);
  return !(v.t === K.None || (v.t === K.Logic && !v.v));
}

export function moldShort(v: Cell, most = MAX_MOLD): string {
  const s = mold(v);
  return s.length > most ? s.slice(0, most - 1) + '…' : s;
}

/** A face's file:line:col and a vscode:// link to it, when the file is in the folder trebol dev serves. */
export function placeOf(face: ObjectCell): { text: string; href: string | null } | null {
  const v = get(face, 'place');
  if (v.t !== K.String) return null;
  const at = form(v);
  const m = /^(.*):(\d+):(\d+)$/.exec(at);
  if (m === null) return { text: at, href: null };
  let url: URL;
  try {
    url = new URL(m[1]!);
  } catch {
    return { text: at, href: null };
  }
  const path = decodeURIComponent(url.pathname);
  const text = `${path.slice(1)}:${m[2]}:${m[3]}`;
  const mine = url.origin === location.origin && !path.startsWith('/@trebol/') && side.root !== null;
  return { text, href: mine ? `vscode://file${side.root!.replace(/\/$/, '')}${path}:${m[2]}:${m[3]}` : null };
}

