// The dev tools of trebol dev: a panel docked at the bottom of the page, opened
// with Ctrl+` or the small button in the corner. Only a page that trebol dev
// serves has them (it adds <meta name="trebol-dev">); a built page never does.
//
//   Faces    the faces on the page as a tree, and what one of them holds:
//            pick one on the page or in the tree; where it was written links
//            to the editor (vscode://).
//   Console  >> and == as in the trebol console, against the running app;
//            `face` is the face picked; print shows here too.
//   Machines the machines the program holds in its words: their states as a
//            tree, the ones they are in marked, and of the one chosen its
//            data, the ways out of its states and the events it takes now.
//   Log      events, requests, toasts, errors and warnings, and each change
//            of state of a machine, newest last.

//
// This file is the panel; the tabs and what they share are in devtools/.

import { K, mold } from '../core/index.ts';
import { output } from './index.ts';
import { devLog } from './devlog.ts';
import { type DevSide, type Tab, STATE_KEY, HISTORY_KEY, side, setSide, state, setState, panel, setPanel, opener, setOpener, outline, setOutline, pickButton, setPickButton, consoleIn, consoleFace, logList, tabs, picked, picking, setHistory, treeFrame, setTreeFrame, el, button, read, write } from './devtools/state.ts';
import { wordText, short, faceRef } from './devtools/read.ts';
import { faceKey, buildFaces, drawTree, drawDetail, point, placeOutline, setPicking, pickMove, pickDown, pickClick } from './devtools/faces.ts';
import { buildMachines, noteMachines, drawMachines } from './devtools/machines.ts';
import { buildConsole, say } from './devtools/console.ts';
import { buildLog, log } from './devtools/log.ts';
export { faceRef } from './devtools/read.ts';
export type { DevSide } from './devtools/state.ts';

// --- the panel -----------------------------------------------------------------------

/** Starts the dev tools on a page served by trebol dev; not in a frame (the documentation's examples). */
export function startDevtools(s: DevSide): void {
  if (window !== window.top) return;
  setSide(s);
  setState(read(() => sessionStorage, STATE_KEY, state));
  setHistory(read<{ lines: string[] }>(() => localStorage, HISTORY_KEY, { lines: [] }).lines);

  setPanel(el('section', 'tb-dev-tools'));
  panel.popover = 'manual';
  panel.setAttribute('aria-label', 'Trebol dev tools');
  const grip = el('div', 'tb-dev-grip');
  grip.addEventListener('pointerdown', resizeFrom);
  const head = el('header');
  const list = el('div', 'tb-dev-tabs');
  list.setAttribute('role', 'tablist');
  head.append(list);
  const body = el('div', 'tb-dev-body');
  for (const [tab, label] of [['faces', 'Faces'], ['machines', 'Machines'], ['console', 'Console'], ['log', 'Log']] as const) {
    const b = button('tb-dev-tab', label, () => openTab(tab));
    b.setAttribute('role', 'tab');
    b.id = `tb-dev-tab-${tab}`;
    const pane = el('div', `tb-dev-pane tb-dev-${tab}`);
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', b.id);
    list.append(b);
    body.append(pane);
    tabs.set(tab, { button: b, pane });
  }
  setPickButton(button('tb-dev-button', 'Pick', () => setPicking(!picking)));
  pickButton.title = 'Click a face on the page to see it here';
  pickButton.setAttribute('aria-pressed', 'false');
  const close = button('tb-dev-button', 'Close', () => setOpen(false));
  close.title = 'Close (Ctrl+`)';
  head.append(el('span', 'tb-dev-space'), pickButton, close);
  panel.append(grip, head, body);
  // keys typed here are not for a face around the panel, and Escape does not close a dialog it is in
  panel.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape') ev.preventDefault();
  });
  buildFaces(tabs.get('faces')!.pane);
  buildMachines(tabs.get('machines')!.pane);
  buildConsole(tabs.get('console')!.pane);
  buildLog(tabs.get('log')!.pane);

  setOpener(button('tb-dev-opener', 'Trebol', () => setOpen(true)));
  opener.popover = 'manual';
  opener.title = 'Dev tools (Ctrl+`)';
  setOutline(el('div', 'tb-dev-outline'));
  outline.popover = 'manual';
  outline.setAttribute('aria-hidden', 'true');
  document.body.append(panel, opener, outline);

  addEventListener('keydown', ev => {
    if (ev.ctrlKey && !ev.altKey && !ev.metaKey && ev.code === 'Backquote') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      setOpen(!state.open);
    } else if (picking && ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      setPicking(false);
    }
  }, true);
  addEventListener('pointermove', pickMove, true);
  addEventListener('pointerdown', pickDown, true);
  addEventListener('click', pickClick, true);
  addEventListener('scroll', () => placeOutline(), { capture: true, passive: true });
  addEventListener('resize', () => {
    setHeight(state.height);
    placeOutline();
  });

  hook();
  openTab(state.tab);
  setOpen(state.open);
}

/** Keys typed in the panel are not the app's: its shortcuts and on-key leave them. */
export function inDevtools(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.tb-dev-tools') !== null;
}

/**
 * Puts the panel, its opener and the outline inside the dialog on show, or back in the body: while a
 * modal dialog is open everything outside it is inert, the panel too.
 */
export function home(): void {
  const modals = document.querySelectorAll('dialog:modal');
  const into = modals.length > 0 ? modals[modals.length - 1]! : document.body;
  if (panel.parentElement === into) return;
  for (const e of [panel, opener, outline]) {
    const shown = e.matches(':popover-open');
    into.append(e);
    if (shown) e.showPopover();
  }
}

export function setOpen(open: boolean): void {
  state.open = open;
  write(() => sessionStorage, STATE_KEY, state);
  home();
  if (open) {
    opener.hidePopover();
    panel.showPopover();
    setHeight(state.height);
    refresh();
    if (state.tab === 'console') consoleIn.focus();
  } else {
    setPicking(false);
    point(null);
    const focused = panel.contains(document.activeElement);
    panel.hidePopover();
    opener.showPopover();
    if (focused) opener.focus();
    document.body.style.paddingBottom = '';
  }
}

export function setHeight(h: number): void {
  state.height = Math.round(Math.max(140, Math.min(h, innerHeight - 60)));
  panel.style.height = `${state.height}px`;
  // the end of the page stays reachable above the panel
  if (state.open) document.body.style.paddingBottom = `${state.height}px`;
}

export function resizeFrom(ev: PointerEvent): void {
  ev.preventDefault();
  const grip = ev.currentTarget as HTMLElement;
  grip.setPointerCapture(ev.pointerId);
  const move = (e: PointerEvent): void => setHeight(innerHeight - e.clientY);
  const up = (): void => {
    grip.removeEventListener('pointermove', move);
    grip.removeEventListener('pointerup', up);
    write(() => sessionStorage, STATE_KEY, state);
  };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up);
}

export function openTab(tab: Tab): void {
  state.tab = tab;
  write(() => sessionStorage, STATE_KEY, state);
  for (const [t, { button: b, pane }] of tabs) {
    b.setAttribute('aria-selected', String(t === tab));
    b.tabIndex = t === tab ? 0 : -1;
    pane.hidden = t !== tab;
  }
  refresh();
  placeOutline();
  if (tab === 'console' && state.open) consoleIn.focus();
  if (tab === 'log') logList.scrollTop = logList.scrollHeight;
}

/** What the host tells: events, requests, notes and repaints. */
export function hook(): void {
  devLog.event = (fn, face, args) => {
    if (fn === 'ui-blur') return;
    let what = fn.replace(/^ui-/, '');
    let rest = args;
    if (fn === 'ui-event' && args[0] !== undefined) {
      what = wordText(args[0]) ?? what;
      rest = [];
    }
    const shown = rest.length > 0 && rest[0]!.t !== K.Object ? ' ' + short(mold(rest[0]!), 60) : '';
    log('event', `${what} · ${faceRef(face, side.host.rt)}${shown}`, `${fn} ${faceKey(face)}`);
  };
  devLog.request = (verb, url, status, ms, problem) => {
    let where = url;
    try {
      const u = new URL(url, location.href);
      if (u.origin === location.origin) where = u.pathname + u.search;
    } catch {
      // not a URL: shown as given
    }
    const outcome = status !== null ? String(status) : `failed (${problem ?? 'network'})`;
    log(status !== null && status < 400 ? 'request' : 'failed', `${verb} ${where} ${outcome} · ${ms} ms`);
  };
  devLog.note = (kind, text) => log(kind, text);
  devLog.repainted = () => {
    home();
    noteMachines();
    if (!state.open) return;
    placeOutline();
    if ((state.tab === 'faces' || state.tab === 'machines') && treeFrame === 0) setTreeFrame(requestAnimationFrame(() => {
      setTreeFrame(0);
      refresh();
    }));
  };
  const line = output.line;
  output.line = text => {
    line(text);
    say('out', text);
  };
}

export function refresh(): void {
  if (!state.open) return;
  if (state.tab === 'faces') {
    drawTree();
    drawDetail();
  }
  if (state.tab === 'machines') void drawMachines();
  consoleFace.textContent = picked !== null ? `face: ${faceRef(picked, side.host.rt)}` : 'face: none (pick one in Faces)';
}

