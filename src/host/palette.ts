// The palette: Ctrl+K (⌘K on a Mac) opens a box that finds what the page can do.
// What it finds comes from the dialect (ui-palette): the screens, the buttons and
// links on show, the items of their menus, and what the app's on-find gives. Here
// is only the box: typing, and choosing with the keys or the pointer.

export interface PaletteEntry {
  label: string;
  /** What shows at the right: a kind, or the keys of a shortcut; '' for none. */
  hint: string;
  /** What the host needs to do it; the box never looks inside. */
  target: unknown;
}

export interface PaletteHost {
  /** What matches the text typed; the latest asked wins. */
  search(text: string): Promise<PaletteEntry[]>;
  pick(entry: PaletteEntry): void;
  label: string;
  placeholder: string;
  nothing: string;
}

let box: HTMLDialogElement | null = null;
let ids = 0;

export function paletteOpen(): boolean {
  return box !== null && box.isConnected;
}

export function openPalette(h: PaletteHost): void {
  if (paletteOpen()) return;
  const before = document.activeElement as HTMLElement | null;
  const d = document.createElement('dialog');
  d.className = 'tb-dialog tb-palette';
  d.setAttribute('aria-label', h.label);
  const listId = `tb-palette-${++ids}`;
  const input = document.createElement('input');
  input.className = 'tb-input tb-palette-input';
  input.type = 'text';
  input.placeholder = h.placeholder;
  input.setAttribute('aria-label', h.label);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('aria-autocomplete', 'list');
  input.autocomplete = 'off';
  input.spellcheck = false;
  const list = document.createElement('ul');
  list.className = 'tb-palette-list';
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', h.label);
  const none = document.createElement('p');
  none.className = 'tb-palette-none';
  none.textContent = h.nothing;
  none.hidden = true;
  d.append(input, list, none);

  let entries: PaletteEntry[] = [];
  let at = 0;
  let asked = 0;
  const mark = (): void => {
    list.querySelectorAll<HTMLElement>('[role="option"]').forEach((o, i) => o.setAttribute('aria-selected', String(i === at)));
    const chosen = list.children[at] as HTMLElement | undefined;
    if (chosen !== undefined) {
      input.setAttribute('aria-activedescendant', chosen.id);
      chosen.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };
  const draw = (): void => {
    list.replaceChildren(...entries.map((e, i) => {
      const o = document.createElement('li');
      o.className = 'tb-palette-option';
      o.id = `${listId}-${i}`;
      o.setAttribute('role', 'option');
      const label = document.createElement('span');
      label.textContent = e.label;
      o.append(label);
      if (e.hint !== '') {
        const hint = document.createElement('span');
        hint.className = 'tb-palette-hint';
        hint.textContent = e.hint;
        o.append(hint);
      }
      return o;
    }));
    none.hidden = entries.length > 0 || input.value === '';
    mark();
  };
  const ask = async (): Promise<void> => {
    const n = ++asked;
    const got = await h.search(input.value);
    if (n !== asked || !d.isConnected) return;
    entries = got;
    at = 0;
    draw();
  };
  const close = (): void => {
    d.close();
    d.remove();
    box = null;
    if (before?.isConnected === true) before.focus({ preventScroll: true });
  };
  const choose = (i: number): void => {
    const e = entries[i];
    if (e === undefined) return;
    close();
    h.pick(e);
  };
  input.addEventListener('input', () => void ask());
  input.addEventListener('keydown', ev => {
    const n = entries.length;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (n > 0) at = (at + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n;
      mark();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      choose(at);
    }
  });
  list.addEventListener('pointermove', ev => {
    const o = (ev.target as Element).closest('[role="option"]');
    const i = o === null ? -1 : Array.prototype.indexOf.call(list.children, o);
    if (i >= 0 && i !== at) { at = i; mark(); }
  });
  list.addEventListener('click', ev => {
    const o = (ev.target as Element).closest('[role="option"]');
    if (o !== null) choose(Array.prototype.indexOf.call(list.children, o));
  });
  // Escape, or a click on the shade around it
  d.addEventListener('cancel', ev => { ev.preventDefault(); close(); });
  d.addEventListener('click', ev => { if (ev.target === d) close(); });
  box = d;
  document.body.append(d);
  d.showModal();
  input.focus();
  void ask();
}
