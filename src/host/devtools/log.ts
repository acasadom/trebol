// --- log -----------------------------------------------------------------------------

import { MAX_LOG, logList, setLogList, lastLog, setLastLog, el, button } from './state.ts';

export function buildLog(pane: HTMLElement): void {
  const bar = el('div', 'tb-dev-bar');
  bar.append(button('tb-dev-button', 'Clear', () => {
    logList.replaceChildren();
    setLastLog(null);
  }));
  setLogList(el('ol', 'tb-dev-entries'));
  logList.setAttribute('aria-label', 'What the app did');
  pane.append(bar, logList);
}

/** Adds a line to the log; the same one again (typing in a field) counts instead of adding. */
export function log(kind: string, text: string, key?: string): void {
  if (key !== undefined && lastLog?.key === key && lastLog.li.isConnected) {
    lastLog.count++;
    lastLog.text.textContent = `${text} (×${lastLog.count})`;
    return;
  }
  const li = el('li', `tb-dev-${kind}`);
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const t = el('span', 'tb-dev-text', text);
  li.append(el('time', undefined, time), el('span', 'tb-dev-kind', kind), t);
  const end = logList.scrollTop + logList.clientHeight >= logList.scrollHeight - 4;
  logList.append(li);
  while (logList.childElementCount > MAX_LOG) logList.firstElementChild!.remove();
  if (end) logList.scrollTop = logList.scrollHeight;
  setLastLog(key !== undefined ? { key, li, text: t, count: 1 } : null);
}

