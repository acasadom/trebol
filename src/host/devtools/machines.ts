// --- machines ------------------------------------------------------------------------

import { K, NONE, mold, form, ctxFind, intern, spell, type Cell, type ObjectCell, type WordCell, type BlockCell, type Ctx } from '../../core/index.ts';
import { spawn, taskResult } from '../scheduler.ts';
import { side, el, button } from './state.ts';
import { wordText, short, moldShort } from './read.ts';
import { log } from './log.ts';

/** A machine the program holds: the word (or object/field) it is in. */
export interface Found { name: string; m: ObjectCell }

export let machineList: HTMLElement;
export let machineDetail: HTMLElement;
/** The machine chosen, by its context, and the state chosen in it (its key as mold gives it). */
export let chosen: { ctx: Ctx; state: string | null } | null = null;
/** What each machine's state was at the last repaint, for the log. */
export const seenState = new WeakMap<Ctx, string>();
export let drawing = 0;

export function buildMachines(pane: HTMLElement): void {
  machineList = el('div', 'tb-dev-tree');
  machineList.setAttribute('aria-label', 'Machines and their states');
  machineDetail = el('div', 'tb-dev-detail');
  pane.append(machineList, machineDetail);
}

export function field(o: ObjectCell, name: string): Cell | null {
  const i = ctxFind(o.ctx, intern(name));
  return i < 0 ? null : o.ctx.vals[i]!;
}

export function isMachine(v: Cell): v is ObjectCell {
  return v.t === K.Object && field(v as ObjectCell, 'nodes') !== null && field(v as ObjectCell, 'queue') !== null
    && field(v as ObjectCell, 'scope') !== null && field(v as ObjectCell, 'state') !== null;
}

/** The machines in the words of the program, and in the fields of the objects in them; no others. */
export function findMachines(): Found[] {
  const out: Found[] = [];
  const seen = new Set<Ctx>();
  const user = side.host.rt.user;
  const add = (name: string, v: Cell): void => {
    if (!isMachine(v) || seen.has(v.ctx)) return;
    seen.add(v.ctx);
    out.push({ name, m: v });
  };
  user.keys.forEach((k, i) => {
    const v = user.vals[i]!;
    add(spell(k), v);
    if (v.t === K.Object && !isMachine(v) && field(v as ObjectCell, 'style') === null) {
      const o = v as ObjectCell;
      o.ctx.keys.forEach((f, j) => add(`${spell(k)}/${spell(f)}`, o.ctx.vals[j]!));
    }
  });
  return out;
}

/** A line in the log for each machine whose state changed since the last repaint. */
export function noteMachines(): void {
  for (const { name, m } of findMachines()) {
    const now = mold(field(m, 'state') ?? NONE);
    const was = seenState.get(m.ctx);
    seenState.set(m.ctx, now);
    if (was !== undefined && was !== now) log('machine', `${name}: ${was} → ${now}`);
  }
}

/** The value after a word in a block of plain data, as graph-of gives it. */
export function pickKey(b: Cell | null, key: string): Cell | null {
  if (b === null || b.t !== K.Block) return null;
  const d = (b as BlockCell).s.data.slice((b as BlockCell).i);
  for (let i = 0; i + 1 < d.length; i += 2) if (wordText(d[i]!) === key) return d[i + 1]!;
  return null;
}

export function pairs(b: Cell | null): [Cell, Cell][] {
  if (b === null || b.t !== K.Block) return [];
  const d = (b as BlockCell).s.data.slice((b as BlockCell).i);
  const out: [Cell, Cell][] = [];
  for (let i = 0; i + 1 < d.length; i += 2) out.push([d[i]!, d[i + 1]!]);
  return out;
}

/** The values of a block or a path. */
export function items(b: Cell | null): Cell[] {
  return b === null || (b.t !== K.Block && b.t !== K.Path) ? [] : (b as BlockCell).s.data.slice((b as BlockCell).i);
}

export function truthy(v: Cell | null): boolean {
  return v !== null && !(v.t === K.None || (v.t === K.Logic && !v.v));
}

export async function graphOf(m: ObjectCell): Promise<Cell> {
  const fn: WordCell = { t: K.Word, sym: intern('graph-of'), bind: side.host.rt.lib };
  return taskResult(spawn(side.host.sch, { data: [fn, m] } as unknown as BlockCell['s'], 0));
}

/** A way as one line: `on start → work`, with where and set when it has them. */
export function wayText(w: Cell): string {
  const on = pickKey(w, 'on');
  const ev = on !== null && on.t === K.Block ? items(on).map(form).join(' ') : null;
  const to = pickKey(w, 'to');
  const parts: string[] = [];
  if (ev !== null) parts.push(`on ${ev}`);
  if (to !== null) parts.push(`→ ${mold(to)}`);
  else {
    const branches = items(pickKey(w, 'branches')).map(b => `${wordText(items(b)[0]!) === 'else' ? 'else ' : ''}${mold(pickKey(b, 'to') ?? NONE)}`);
    parts.push(`→ ${wordText(items(w)[2]!) ?? 'choose'} [${branches.join(' | ')}]`);
  }
  const where = pickKey(w, 'where');
  if (truthy(where)) parts.push(`where ${short(mold(where!), 40)}`);
  const set = pickKey(w, 'set');
  if (truthy(set)) parts.push(`set ${short(mold(set!), 40)}`);
  if (ev === null) parts.unshift('at once');
  return parts.join(' ');
}

export async function drawMachines(): Promise<void> {
  const ticket = ++drawing;
  const found = findMachines();
  const graphs: Cell[] = [];
  for (const f of found) {
    try {
      graphs.push(await graphOf(f.m));
    } catch {
      graphs.push(NONE);
    }
  }
  if (ticket !== drawing) return;
  const top = machineList.scrollTop;
  machineList.replaceChildren();
  machineDetail.replaceChildren();
  if (found.length === 0) {
    machineList.append(el('p', 'tb-dev-hint', 'No machine in the words of the program.'));
    return;
  }
  if (chosen === null || !found.some(f => f.m.ctx === chosen!.ctx)) chosen = { ctx: found[0]!.m.ctx, state: null };
  found.forEach((f, i) => {
    const g = graphs[i]!;
    const head = button('tb-dev-node tb-dev-machine-head', `${f.name}  ${mold(field(f.m, 'state') ?? NONE)}`, () => {
      chosen = { ctx: f.m.ctx, state: null };
      void drawMachines();
    });
    if (chosen!.ctx === f.m.ctx && chosen!.state === null) head.setAttribute('aria-current', 'true');
    machineList.append(head);
    for (const [key, info] of pairs(pickKey(g, 'states'))) {
      const k = mold(key);
      const depth = key.t === K.Path ? items(key).length : 1;
      const name = key.t === K.Path ? form(items(key).at(-1)!) : form(key);
      const kind = wordText(pickKey(info, 'kind') ?? NONE);
      const marks = [
        truthy(pickKey(info, 'initial')) ? '›' : ' ',
        kind === 'final' ? '(final)' : kind === 'parallel' ? '(parallel)' : '',
      ];
      const row = button('tb-dev-node', `${marks[0]} ${name} ${marks[1]}`.trimEnd(), () => {
        chosen = { ctx: f.m.ctx, state: k };
        void drawMachines();
      });
      row.style.paddingLeft = `${8 + depth * 14}px`;
      if (truthy(pickKey(info, 'on'))) row.classList.add('tb-dev-on');
      if (chosen!.ctx === f.m.ctx && chosen!.state === k) row.setAttribute('aria-current', 'true');
      machineList.append(row);
    }
  });
  machineList.scrollTop = top;
  const at = found.findIndex(f => f.m.ctx === chosen!.ctx);
  drawMachine(found[at]!, graphs[at]!);
}

export function drawMachine(f: Found, g: Cell): void {
  const d = machineDetail;
  d.append(el('h3', undefined, chosen!.state === null ? f.name : `${f.name} · ${chosen!.state}`));
  const dl = el('dl');
  const row = (k: string, v: string): void => {
    dl.append(el('dt', undefined, k), el('dd', undefined, v));
  };
  const states = pairs(pickKey(g, 'states'));
  const on = new Set(states.filter(([, info]) => truthy(pickKey(info, 'on'))).map(([k]) => mold(k)));
  const ways = items(pickKey(g, 'ways'));
  row('state', mold(field(f.m, 'state') ?? NONE));
  const data = field(f.m, 'data');
  if (data !== null && data.t === K.Object) {
    const o = data as ObjectCell;
    row('data', o.ctx.keys.map((k, i) => `${spell(k)}: ${moldShort(o.ctx.vals[i]!, 200)}`).join('\n') || '(none)');
  }
  // what can? says yes to: the events of the ways out of the states it is in
  const now = new Set<string>();
  for (const w of ways) {
    const from = pickKey(w, 'from');
    if (from !== null && on.has(mold(from))) for (const e of items(pickKey(w, 'on'))) now.add(form(e));
  }
  row('takes now', now.size > 0 ? [...now].join(' ') : '(nothing)');
  if (truthy(field(f.m, 'done'))) row('done', mold(field(f.m, 'outcome') ?? NONE));
  if (chosen!.state !== null) {
    const info = states.find(([k]) => mold(k) === chosen!.state)?.[1] ?? null;
    for (const n of ['kind', 'timeout', 'outcome', 'invoke', 'for', 'defer']) {
      const v = pickKey(info, n);
      if (v !== null && truthy(v) && !(v.t === K.Block && items(v).length === 0)) row(n, n === 'invoke' && v.t === K.Block ? 'a machine of its own' : moldShort(v, 200));
    }
    if (truthy(pickKey(info, 'run'))) row('run', moldShort(pickKey(info, 'run')!, 200));
  }
  const mine = ways.filter(w => chosen!.state === null || mold(pickKey(w, 'from') ?? NONE) === chosen!.state);
  if (mine.length > 0) {
    row('ways', mine.map(w => (chosen!.state === null ? `${mold(pickKey(w, 'from') ?? NONE)} ` : '') + wayText(w)).join('\n'));
  }
  d.append(dl);
}

