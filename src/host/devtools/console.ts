// --- console -------------------------------------------------------------------------

import { K, load, LoadError, bindSeries, scriptStart, form, intern, type ObjectCell } from '../../core/index.ts';
import { spawn, taskResult } from '../scheduler.ts';
import { report } from '../index.ts';
import { HISTORY_KEY, MAX_HISTORY, MAX_LOG, side, consoleOut, setConsoleOut, consoleIn, setConsoleIn, consoleFace, setConsoleFace, picked, history, setHistory, back, setBack, running, setRunning, el, write } from './state.ts';
import { moldShort } from './read.ts';

// Load errors that mean "the input is not finished yet" (as in the trebol console).
export const UNFINISHED = /: missing ([\])]|} to close (string|binary))$/;

export function buildConsole(pane: HTMLElement): void {
  setConsoleOut(el('div', 'tb-dev-out'));
  consoleOut.setAttribute('role', 'log');
  consoleOut.setAttribute('aria-label', 'Console output');
  setConsoleFace(el('div', 'tb-dev-face'));
  const row = el('div', 'tb-dev-prompt');
  setConsoleIn(el('textarea', 'tb-dev-in'));
  consoleIn.rows = 1;
  consoleIn.spellcheck = false;
  consoleIn.setAttribute('aria-label', 'Trebol code to run');
  consoleIn.placeholder = 'face/text: "Hello"';
  consoleIn.addEventListener('keydown', consoleKey);
  consoleIn.addEventListener('input', fitInput);
  row.append(el('span', 'tb-dev-sign', '>>'), consoleIn);
  row.addEventListener('click', () => consoleIn.focus());
  pane.append(consoleOut, consoleFace, row);
}

export function fitInput(): void {
  consoleIn.style.height = 'auto';
  consoleIn.style.height = `${Math.min(consoleIn.scrollHeight, 160)}px`;
}

export function setInput(src: string): void {
  consoleIn.value = src;
  fitInput();
  consoleIn.setSelectionRange(src.length, src.length);
}

export function consoleKey(ev: KeyboardEvent): void {
  const src = consoleIn.value;
  if (ev.key === 'Enter' && !ev.shiftKey) {
    if (src.trim() === '' || unfinished(src)) return;
    ev.preventDefault();
    setInput('');
    setRunning(running.then(() => run(src)));
  } else if (ev.key === 'ArrowUp' && !src.slice(0, consoleIn.selectionStart).includes('\n') && back < history.length) {
    ev.preventDefault();
    setBack(back + 1);
    setInput(history[history.length - back]!);
  } else if (ev.key === 'ArrowDown' && !src.slice(consoleIn.selectionEnd).includes('\n') && back > 0) {
    ev.preventDefault();
    setBack(back - 1);
    setInput(back === 0 ? '' : history[history.length - back]!);
  }
}

export function unfinished(src: string): boolean {
  try {
    load(src);
    return false;
  } catch (e) {
    return e instanceof LoadError && UNFINISHED.test(e.message);
  }
}

export function say(kind: 'in' | 'out' | 'value' | 'error', text: string): void {
  const line = el('pre', `tb-dev-said-${kind}`, text);
  const end = consoleOut.scrollTop + consoleOut.clientHeight >= consoleOut.scrollHeight - 4;
  consoleOut.append(line);
  while (consoleOut.childElementCount > MAX_LOG) consoleOut.firstElementChild!.remove();
  if (end) consoleOut.scrollTop = consoleOut.scrollHeight;
}

/** Runs code typed in the console in the app's user context, `face` being the face picked. */
export async function run(src: string): Promise<void> {
  setBack(0);
  if (history[history.length - 1] !== src) history.push(src);
  setHistory(history.slice(-MAX_HISTORY));
  write(() => localStorage, HISTORY_KEY, { lines: history });
  say('in', src.split('\n').map((l, i) => (i === 0 ? '>> ' : '   ') + l).join('\n'));
  consoleOut.scrollTop = consoleOut.scrollHeight;
  let code;
  try {
    code = load(src);
  } catch (e) {
    say('error', `** Syntax error: ${(e as Error).message}`);
    return;
  }
  const rt = side.host.rt;
  bindSeries(code.s, rt.user, true);
  if (picked !== null) bindSeries(code.s, { keys: [intern('face')], vals: [picked], parent: null });
  try {
    const v = await taskResult(spawn(side.host.sch, code.s, scriptStart(code).start));
    if (v.t === K.Error) say('error', form(v));
    else if (v.t !== K.Unset) say('value', `== ${moldShort(v)}`);
  } catch (e) {
    say('error', report(e as ObjectCell));
  }
}

