// --- what the dev tools share ------------------------------------------------------
//
// What the dev tools need from the host, the panel's elements and state, and small helpers to make and keep them.

import type { ObjectCell } from '../../core/index.ts';
import type { Host } from '../index.ts';

/** What the dev tools need from the browser host. */
export interface DevSide {
  host: Host;
  /** The folder trebol dev serves, to link a face to its file; null if unknown. */
  root: string | null;
  /** The face whose own node this is, if any. */
  faceOf(e: Element): ObjectCell | null;
  /** The face of a node or of the nearest node around it that is one. */
  faceAt(e: Element): { face: ObjectCell; el: HTMLElement } | null;
  /** The node of a face on the page, if it is on the page. */
  nodeOf(face: ObjectCell): HTMLElement | null;
}

export type Tab = 'faces' | 'machines' | 'console' | 'log';

/** The panel's state, kept across the reloads of live reload. */
export interface State { open: boolean; tab: Tab; height: number }

export const STATE_KEY = 'trebol-dev';
export const HISTORY_KEY = 'trebol-dev-history';
export const MAX_HISTORY = 100;
export const MAX_LOG = 500;
export const MAX_MOLD = 2000;

export let side: DevSide;
export function setSide(v: DevSide): void {
  side = v;
}
export let state: State = { open: false, tab: 'faces', height: 320 };
export function setState(v: State): void {
  state = v;
}
export let panel: HTMLElement;
export function setPanel(v: HTMLElement): void {
  panel = v;
}
export let opener: HTMLButtonElement;
export function setOpener(v: HTMLButtonElement): void {
  opener = v;
}
export let outline: HTMLElement;
export function setOutline(v: HTMLElement): void {
  outline = v;
}
export let pickButton: HTMLButtonElement;
export function setPickButton(v: HTMLButtonElement): void {
  pickButton = v;
}
export let tree: HTMLElement;
export function setTree(v: HTMLElement): void {
  tree = v;
}
export let detail: HTMLElement;
export function setDetail(v: HTMLElement): void {
  detail = v;
}
export let consoleOut: HTMLElement;
export function setConsoleOut(v: HTMLElement): void {
  consoleOut = v;
}
export let consoleIn: HTMLTextAreaElement;
export function setConsoleIn(v: HTMLTextAreaElement): void {
  consoleIn = v;
}
export let consoleFace: HTMLElement;
export function setConsoleFace(v: HTMLElement): void {
  consoleFace = v;
}
export let logList: HTMLElement;
export function setLogList(v: HTMLElement): void {
  logList = v;
}
export const tabs = new Map<Tab, { button: HTMLButtonElement; pane: HTMLElement }>();

/** The face chosen in Faces, `face` in Console. */
export let picked: ObjectCell | null = null;
export function setPicked(v: ObjectCell | null): void {
  picked = v;
}
/** The face under the pointer or the tree row the pointer is on. */
export let pointed: ObjectCell | null = null;
export function setPointed(v: ObjectCell | null): void {
  pointed = v;
}
export let picking = false;
export function storePicking(v: typeof picking): void {
  picking = v;
}
export let history: string[] = [];
export function setHistory(v: string[]): void {
  history = v;
}
export let back = 0;
export function setBack(v: typeof back): void {
  back = v;
}
export let lastLog: { key: string; li: HTMLElement; text: HTMLElement; count: number } | null = null;
export function setLastLog(v: { key: string; li: HTMLElement; text: HTMLElement; count: number } | null): void {
  lastLog = v;
}
export let treeFrame = 0;
export function setTreeFrame(v: typeof treeFrame): void {
  treeFrame = v;
}
/** The code typed so far runs one piece after another. */
export let running: Promise<void> = Promise.resolve();
export function setRunning(v: Promise<void>): void {
  running = v;
}

export function el<T extends keyof HTMLElementTagNameMap>(tag: T, cls?: string, content?: string): HTMLElementTagNameMap[T] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (content !== undefined) e.textContent = content;
  return e;
}

export function button(cls: string, content: string, act: () => void): HTMLButtonElement {
  const b = el('button', cls, content);
  b.type = 'button';
  b.addEventListener('click', act);
  return b;
}

export function read<T>(store: () => Storage, key: string, fallback: T): T {
  try {
    const v = store().getItem(key);
    return v === null ? fallback : { ...fallback, ...(JSON.parse(v) as T) };
  } catch {
    return fallback;
  }
}

export function write(store: () => Storage, key: string, v: unknown): void {
  try {
    store().setItem(key, JSON.stringify(v));
  } catch {
    // a private window or blocked storage: the panel forgets, nothing else
  }
}

