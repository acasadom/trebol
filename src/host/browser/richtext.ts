// --- rich text -----------------------------------------------------------------------
//
// An editable box whose value is Markdown (see markdown.ts). The box is drawn from
// the tree with text nodes and read back the same way; pasting takes only the text.

import { NONE, native, value, string, text, type ObjectCell, type StringCell } from '../../core/index.ts';
import { parseMd, printMd, appendText, safeHref, type Block, type Inline } from '../markdown.ts';
import { inDevtools } from '../devtools.ts';
import { str, own, flag, word, icon } from './faces.ts';
import { type Mounted, byCtx, newId, fire, el } from './mount.ts';
import { required } from './fields.ts';

export const RICH_TOOLS: readonly [string, string][] = [
  ['bold', 'bold'], ['italic', 'italic'], ['heading', 'heading'],
  ['list', 'bullet-list'], ['list-ordered', 'number-list'], ['link', 'link'],
];

export function inlineNodes(items: Inline[]): Node[] {
  return items.flatMap((x): Node[] => {
    switch (x.k) {
      case 'text': return [document.createTextNode(x.text)];
      case 'br': return [el('br')];
      case 'b': case 'i': {
        const e = el(x.k);
        e.append(...inlineNodes(x.kids));
        return [e];
      }
      case 'a': {
        if (!safeHref(x.href)) return inlineNodes(x.kids);
        const a = el('a');
        a.href = x.href;
        a.rel = 'noopener noreferrer';
        a.target = '_blank';
        a.append(...inlineNodes(x.kids));
        return [a];
      }
    }
  });
}

export function blockNodes(blocks: Block[]): Node[] {
  return blocks.map(b => {
    if (b.k === 'p' || b.k === 'h') {
      const e = b.k === 'p' ? el('p') : el(`h${b.level}` as 'h1' | 'h2' | 'h3');
      e.append(...inlineNodes(b.kids));
      return e;
    }
    const list = el(b.k);
    for (const item of b.items) {
      const li = el('li');
      li.append(...inlineNodes(item));
      list.append(li);
    }
    return list;
  });
}

export function readInline(nodes: Iterable<Node>): Inline[] {
  const out: Inline[] = [];
  for (const n of nodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = (n.textContent ?? '').replace(/\u00a0/g, ' ').replace(/[\n\r]+/g, ' ');
      const last = out[out.length - 1];
      if (t === '') continue;
      if (last?.k === 'text') last.text += t;
      else out.push({ k: 'text', text: t });
    } else if (n instanceof HTMLElement) {
      const kids = readInline(n.childNodes);
      switch (n.tagName) {
        case 'BR': out.push({ k: 'br' }); break;
        case 'B': case 'STRONG': if (kids.length > 0) out.push({ k: 'b', kids }); break;
        case 'I': case 'EM': if (kids.length > 0) out.push({ k: 'i', kids }); break;
        case 'A': if (kids.length > 0) out.push({ k: 'a', href: n.getAttribute('href') ?? '', kids }); break;
        default: out.push(...kids);
      }
    }
  }
  // the browser ends an empty or last line with a <br> that shows nothing
  while (out[out.length - 1]?.k === 'br') out.pop();
  return out;
}

export const RICH_BLOCK = /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|SECTION)$/;

export function readBlocks(box: HTMLElement): Block[] {
  const out: Block[] = [];
  let loose: Node[] = [];
  const flush = (): void => {
    const kids = readInline(loose);
    if (kids.length > 0) out.push({ k: 'p', kids });
    loose = [];
  };
  for (const n of box.childNodes) {
    if (!(n instanceof HTMLElement) || !RICH_BLOCK.test(n.tagName)) {
      loose.push(n);
      continue;
    }
    flush();
    if (n.tagName === 'UL' || n.tagName === 'OL') {
      const items = [...n.children].map(li => readInline(li.childNodes)).filter(x => x.length > 0);
      if (items.length > 0) out.push({ k: n.tagName === 'UL' ? 'ul' : 'ol', items });
    } else if (n.tagName === 'DIV' || n.tagName === 'SECTION' || n.tagName === 'BLOCKQUOTE') {
      out.push(...readBlocks(n));
    } else {
      const kids = readInline(n.childNodes);
      if (kids.length === 0) continue;
      if (n.tagName === 'P') out.push({ k: 'p', kids });
      else out.push({ k: 'h', level: Math.min(3, Number(n.tagName[1])), kids });
    }
  }
  flush();
  return out;
}

export function buildRich(face: ObjectCell, m: Mounted): HTMLElement {
  const id = `tb-${newId()}`;
  const wrap = el('div', 'tb-field');
  const label = el('div', 'tb-label');
  label.id = id;
  const control = el('div', 'tb-control');
  const shell = el('div', 'tb-rich');
  const tools = el('div', 'tb-rich-tools');
  tools.setAttribute('role', 'toolbar');
  const box = el('div', 'tb-input tb-rich-box');
  box.setAttribute('role', 'textbox');
  box.setAttribute('aria-multiline', 'true');
  box.setAttribute('aria-labelledby', id);
  const linkRow = el('div', 'tb-rich-link');
  linkRow.hidden = true;
  const linkInput = el('input', 'tb-input');
  linkInput.type = 'url';
  const linkOk = el('button', 'tb-button tb-small');
  linkOk.type = 'button';
  linkRow.append(linkInput, linkOk);
  const error = el('div', 'tb-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  box.setAttribute('aria-describedby', error.id);
  label.addEventListener('click', () => box.focus());
  keepCarets();

  const changed = (): void => {
    if (inserting) return;
    const md = printMd(readBlocks(box));
    if (md === m.shown) return;
    m.shown = md;
    void fire('ui-input', face, md === '' ? NONE : string(md));
  };
  box.addEventListener('input', changed);
  box.addEventListener('paste', ev => {
    ev.preventDefault();
    document.execCommand('insertText', false, ev.clipboardData?.getData('text/plain') ?? '');
  });
  box.addEventListener('drop', ev => ev.preventDefault());
  wrap.addEventListener('focusout', ev => {
    if (!wrap.contains(ev.relatedTarget as Node | null) && !inDevtools(ev.relatedTarget)) void fire('ui-blur', face);
  });

  let saved: Range | null = null;
  const inHeading = (): boolean => {
    const n = getSelection()?.anchorNode ?? null;
    return (n instanceof Element ? n : n?.parentElement)?.closest('h1, h2, h3') != null;
  };
  const command = (what: string): void => {
    box.focus();
    switch (what) {
      case 'bold': case 'italic': document.execCommand(what); break;
      case 'heading': document.execCommand('formatBlock', false, inHeading() ? 'P' : 'H2'); break;
      case 'bullet-list': document.execCommand('insertUnorderedList'); break;
      case 'number-list': document.execCommand('insertOrderedList'); break;
      case 'link': {
        const s = getSelection();
        saved = s !== null && s.rangeCount > 0 && box.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
        linkRow.hidden = false;
        linkInput.value = '';
        linkInput.removeAttribute('aria-invalid');
        linkInput.focus();
        return;
      }
    }
    changed();
  };
  for (const [name, what] of RICH_TOOLS) {
    const b = el('button', 'tb-rich-tool');
    b.type = 'button';
    b.dataset['tool'] = what;
    const svg = icon(name);
    if (svg !== null) b.append(svg);
    // pressing a tool keeps the selection in the text
    b.addEventListener('mousedown', ev => ev.preventDefault());
    b.addEventListener('click', () => command(what));
    tools.append(b);
  }
  const addLink = (): void => {
    const typed = linkInput.value.trim();
    const url = /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`;
    if (typed === '' || !safeHref(url)) {
      linkInput.setAttribute('aria-invalid', 'true');
      return;
    }
    linkRow.hidden = true;
    box.focus();
    const s = getSelection();
    if (saved !== null && s !== null) {
      s.removeAllRanges();
      s.addRange(saved);
    }
    if (saved === null || saved.collapsed) document.execCommand('insertText', false, typed);
    if (saved !== null && !saved.collapsed) document.execCommand('createLink', false, url);
    else {
      // what was just typed becomes the link
      const r = getSelection()?.getRangeAt(0);
      if (r !== undefined) {
        const node = r.startContainer;
        const start = Math.max(0, r.startOffset - typed.length);
        const whole = document.createRange();
        whole.setStart(node, start);
        whole.setEnd(node, r.startOffset);
        s?.removeAllRanges();
        s?.addRange(whole);
        document.execCommand('createLink', false, url);
      }
    }
    changed();
  };
  linkOk.addEventListener('click', addLink);
  linkInput.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      addLink();
    } else if (ev.key === 'Escape') {
      ev.stopPropagation();
      linkRow.hidden = true;
      box.focus();
    }
  });
  shell.append(tools, linkRow, box);
  control.append(shell, error);
  wrap.append(label, control);
  m.label = label;
  m.error = error;
  m.box = box;
  return wrap;
}

export function syncRich(m: Mounted, err: string | null): void {
  const f = m.face;
  const box = m.box!;
  m.label!.textContent = str(f, 'text') ?? '';
  m.label!.classList.toggle('tb-required', required(f));
  const shell = box.parentElement!;
  const readonly = flag(f, 'readonly');
  const disabled = flag(f, 'disabled');
  const locked = readonly || disabled;
  box.contentEditable = locked ? 'false' : 'true';
  box.tabIndex = disabled ? -1 : 0;
  box.setAttribute('aria-readonly', locked ? 'true' : 'false');
  box.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  box.setAttribute('aria-required', required(f) ? 'true' : 'false');
  box.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
  const tools = shell.querySelector<HTMLElement>('.tb-rich-tools')!;
  tools.hidden = locked;
  tools.setAttribute('aria-label', str(f, 'text') ?? '');
  for (const b of tools.querySelectorAll<HTMLButtonElement>('button')) {
    const name = own(b.dataset['tool']!);
    b.setAttribute('aria-label', name);
    b.title = name;
  }
  const linkRow = shell.querySelector<HTMLElement>('.tb-rich-link')!;
  if (locked) linkRow.hidden = true;
  linkRow.querySelector('input')!.placeholder = own('link-url');
  linkRow.querySelector('button')!.textContent = own('link-add');
  m.error!.textContent = err ?? '';
  // never fight the user's typing: only what code set is drawn again
  const md = str(f, 'value') ?? '';
  if (md !== m.shown && document.activeElement !== box) {
    m.shown = md;
    box.replaceChildren(...blockNodes(parseMd(md)));
    richCaret.delete(box);
  }
}

// --- inserting text at the cursor ---------------------------------------------------
//
// insert-text puts text where the user's cursor was, even after a click on a button or
// a choice took the focus away: an input keeps its selection, a rich text box has
// its last one kept here.

/** Inputs that have had the focus, so a cursor of their own. */
export const hadCaret = new WeakSet<Element>();
/** The last selection inside each rich text box. */
export const richCaret = new WeakMap<HTMLElement, Range>();
/** While insert-text writes in a rich text box, its own input event is not the user's. */
export let inserting = false;

export let keepingCarets = false;

export function keepCarets(): void {
  if (keepingCarets) return;
  keepingCarets = true;
  document.addEventListener('selectionchange', () => {
    const s = getSelection();
    if (s === null || s.rangeCount === 0) return;
    const n = s.anchorNode;
    const box = (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>('.tb-rich-box');
    if (box != null) richCaret.set(box, s.getRangeAt(0).cloneRange());
  });
}

native('insert-at-caret', '["The value of a field, area or rich text with text put where its cursor was; the cursor goes after it." face [object!] text [string!]]', (_t, f) => {
  const face = f.args[0] as ObjectCell;
  const add = text(f.args[1] as StringCell);
  const rich = word(face, 'style') === 'rich';
  const was = str(face, 'value') ?? '';
  const m = byCtx.get(face.ctx);
  if (m === undefined || !m.el.isConnected) return value(string(rich ? appendText(was, add) : was + add));
  if (rich) {
    const box = m.box!;
    const at = richCaret.get(box);
    box.focus();
    const s = getSelection()!;
    if (at !== undefined && box.contains(at.commonAncestorContainer)) {
      s.removeAllRanges();
      s.addRange(at);
    } else {
      s.selectAllChildren(box);
      s.collapseToEnd();
    }
    inserting = true;
    try {
      document.execCommand('insertText', false, add);
    } finally {
      inserting = false;
    }
    const md = printMd(readBlocks(box));
    m.shown = md;
    return value(string(md));
  }
  const input = m.input as HTMLInputElement | HTMLTextAreaElement;
  const end = input.value.length;
  const [from, to] = hadCaret.has(input) ? [input.selectionStart ?? end, input.selectionEnd ?? end] : [end, end];
  input.focus();
  input.setRangeText(add, from, to, 'end');
  return value(string(input.value));
});

