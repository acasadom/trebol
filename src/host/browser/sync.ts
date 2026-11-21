// --- syncing -----------------------------------------------------------------------

import { syncDevice } from './device.ts';
import { syncResize, placeResize } from './resize.ts';
import { K, form, intern, text, blockOf, type Cell, type ObjectCell, type BlockCell, type StringCell } from '../../core/index.ts';
import { translate } from '../index.ts';
import { runNow, type HostTask } from '../scheduler.ts';
import { devLog } from '../devlog.ts';
import { changeScreen, mayMove, unfold, fold, isFolding } from '../motion.ts';
import { get, str, optionText, entriesOf, isGroup, optionsOf, optionsKey, fillSelect, own, display, flag, word } from './faces.ts';
import { type Mounted, host, byNode, byCtx, dirty, reactors, newReactor, reacting, fire, el, INPUTS, syncMark, iconLabel, appendChildren, setNewReactor, setReacting } from './mount.ts';
import { isData } from './drag.ts';
import { rangeText } from './calendar.ts';
import { shortcutAria, shortcutLabel } from './keys.ts';
import { countRun } from './count.ts';
import { syncPick } from './pick.ts';
import { syncSlider, syncProgress, syncIcon, required, syncRadio } from './fields.ts';
import { syncMedia, syncPhoto, syncUpload } from './uploads.ts';
import { syncWidget } from './widget.ts';
import { syncLookup } from './lookup.ts';
import { syncCanvas, syncChart } from './drawings.ts';
import { syncOrbit } from './orbits.ts';
import { syncRowsField, placeEntries } from './row-faces.ts';
import { syncRich } from './richtext.ts';
import { syncRows, morphName } from './tables.ts';
import { menuButton } from './events.ts';
import { syncTree } from './trees.ts';
import { syncToolbar, syncBreadcrumb } from './toolbars.ts';
import { syncDialog, syncTabs, syncSteps, syncSplit } from './dialogs.ts';
import { comingScreen, enteredScreen, setComingScreen } from './screens.ts';
import { sweepSizes } from './sizes.ts';
import { dirtySeries, watchShown, watchChanged, ownersOf } from './inplace.ts';

/** Whether a mounted face is on the page, or on the screen coming. */
function shown(m: Mounted): boolean {
  return m.el.isConnected || comingScreen?.contains(m.el) === true;
}

/** Draws the face from its fields, and watches what they hold for changes in place. */
export function sync(m: Mounted): void {
  draw(m);
  watchShown(m.face.ctx, dirty, m, o => shown(o as Mounted));
}

function draw(m: Mounted): void {
  const f = m.face;
  const style = word(f, 'style') ?? '';
  const role = word(f, 'role');
  const t = str(f, 'text');
  const hidden = flag(f, 'hidden');
  const err = str(f, 'error');
  const cls: string[] = [];
  // a face shown or hidden after it was first on the page unfolds or folds away
  const wasHidden = m.el.classList.contains('tb-hidden');
  const turned = style !== 'dialog' && hidden !== wasHidden && m.el.dataset['tb'] !== undefined && m.el.isConnected && mayMove();
  if (hidden && style !== 'dialog' && !(turned || isFolding(m.el))) cls.push('tb-hidden');
  if (flag(f, 'fill')) cls.push('tb-fill');
  if (flag(f, 'narrow-only')) cls.push('tb-narrow-only');
  if (flag(f, 'wide-only')) cls.push('tb-wide-only');
  if (flag(f, 'fit')) cls.push('tb-fit');
  if (flag(f, 'segmented')) cls.push('tb-segmented');
  if (flag(f, 'drop')) cls.push('tb-drop-zone');
  if (role !== null && !INPUTS.has(style)) cls.push(`tb-${role}`);
  const size = word(f, 'size');
  if (size !== null) cls.push(`tb-${size}`);
  const align = word(f, 'align');
  if (align !== null && style === 'row') cls.push(`tb-${align}`);
  const valign = word(f, 'valign');
  if (valign !== null && style === 'row') cls.push(`tb-${valign}`);
  if (err !== null) cls.push('tb-invalid');
  if (flag(f, 'pending')) cls.push('tb-pending');
  setExtra(m.el, cls);
  // the rows of a table or list carry its morph name, each with its key
  const morph = style === 'table' || style === 'list' ? null : morphName(get(f, 'morph'));
  if (morph !== null) m.el.dataset['tbMorph'] = morph;
  // a menu code wrote as in a layout (["Copy" copy]) is made into its items, as the layout makes them
  const menu = get(f, 'menu');
  if (menu.t === K.Block && (menu as BlockCell).s.data.slice((menu as BlockCell).i).some(x => x.t !== K.Object)) void fire('ui-menu-of', f);
  else delete m.el.dataset['tbMorph'];
  if (turned && hidden && !isFolding(m.el)) fold(m.el, () => { if (flag(m.face, 'hidden')) setExtra(m.el, [...(m.el.dataset['tb'] ?? '').split(' ').filter(Boolean), 'tb-hidden']); });
  else if (!hidden && (turned || isFolding(m.el))) unfold(m.el);
  // shown as it is, but it and its children cannot be used
  m.el.inert = flag(f, 'inert');
  // with on-select, a click on it chooses the face under the pointer
  syncPick(m, m.el.inert);
  // a face you can drag takes the focus, so the keyboard reaches its menu and moves it
  if (flag(f, 'drag') && !isData(m) && m.el.tabIndex < 0) m.el.tabIndex = 0;
  space(m.el, 'padding', get(f, 'pad'));
  space(m.el, 'gap', get(f, 'gap'));

  if (style === 'radio') return syncRadio(m, err);
  if (style === 'slider') return syncSlider(m, err);
  if (style === 'upload') return syncUpload(m, err);
  if (style === 'photo') return syncPhoto(m, err);
  if (style === 'widget') return syncWidget(m, err);
  if (style === 'lookup') return syncLookup(m, err);
  if (style === 'rich') return syncRich(m, err);
  if (m.input !== null) {
    if (m.label !== null) {
      m.label.textContent = t ?? '';
      m.label.classList.toggle('tb-required', required(f) && style !== 'check');
    }
    const v = get(f, 'value');
    if (m.input instanceof HTMLInputElement && m.input.type === 'checkbox') {
      m.input.checked = v.t === K.Logic && v.v;
    } else {
      // options given by code after the face was made
      if (m.input instanceof HTMLSelectElement) {
        if (m.input.dataset.options !== optionsKey(f)) fillSelect(m.input, f);
      }
      const want = v.t === K.None ? str(f, 'typed') ?? '' : style === 'date-range' ? rangeText(v)
        : style === 'money' || style === 'date' || style === 'time' ? display(v) : form(v);
      // never fight the user's typing: with the focus, only a value code set is drawn (set-values
      // after Enter sent the form); a read-only field has no typing to fight
      const theirs = document.activeElement === m.input && !flag(f, 'readonly') && (m.typing > 0 || v === m.typed);
      if (!theirs && m.input.value !== want) m.input.value = want;
      const hint = str(f, 'hint');
      if (m.input instanceof HTMLSelectElement) {
        const select = m.input;
        // a required choice shows its hint until one is picked, and cannot be put back to none;
        // one not required keeps the empty option to clear it
        const empty = select.options[0]!;
        empty.textContent = hint ?? own('choose');
        empty.disabled = empty.hidden = required(f);
        optionsOf(f).forEach((o, i) => {
          const opt = select.options[i + 1];
          if (opt) opt.textContent = optionText(o);
        });
        const groups = select.querySelectorAll('optgroup');
        entriesOf(f).filter(isGroup).forEach((g, i) => {
          if (groups[i]) groups[i]!.label = translate(g.title, host.rt);
        });
      }
      else if (hint !== null) m.input.placeholder = hint;
    }
    const readonly = flag(f, 'readonly');
    // text can be read-only; a choice or a checkbox can only be disabled
    const typing = m.input instanceof HTMLTextAreaElement || (m.input instanceof HTMLInputElement && m.input.type !== 'checkbox');
    if (typing) (m.input as HTMLInputElement | HTMLTextAreaElement).readOnly = readonly;
    m.input.disabled = flag(f, 'disabled') || (readonly && !typing);
    if (style === 'date' || style === 'date-range' || style === 'time') {
      const pick = m.input.nextElementSibling as HTMLButtonElement;
      pick.disabled = m.input.disabled || readonly;
      const what = style === 'date' ? 'choose-date' : style === 'time' ? 'choose-time' : 'choose-dates';
      pick.setAttribute('aria-label', t !== null ? own(`${what}-of`, t) : own(what));
    }
    m.input.setAttribute('aria-required', required(f) ? 'true' : 'false');
    m.input.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
    if (m.error !== null) m.error.textContent = err ?? '';
    return;
  }
  switch (style) {
    case 'code': {
      // code is shown as written: never translated, never formatted for the language
      const tv = get(f, 'text');
      m.el.textContent = tv.t === K.None ? '' : form(tv);
      break;
    }
    case 'title': case 'heading': case 'text': {
      const tv = get(f, 'text');
      if (flag(f, 'count') && countRun(m, tv)) break;
      m.el.textContent = tv.t === K.None ? '' : tv.t === K.Map || tv.t === K.Word ? translate(tv, host.rt) : display(tv);
      break;
    }
    case 'tile': {
      (m.label ?? m.el).textContent = t ?? '';
      syncMark(m);
      break;
    }
    case 'button': case 'link': {
      // a menu code gave it after it was shown
      if (get(f, 'menu').t === K.Block && get(f, 'action').t !== K.Block) menuButton(m);
      (m.label ?? m.el).textContent = t ?? '';
      const named = iconLabel(f);
      if (named !== null) m.el.setAttribute('aria-label', named);
      else m.el.removeAttribute('aria-label');
      const keys = str(f, 'shortcut');
      if (keys !== null) m.el.setAttribute('aria-keyshortcuts', shortcutAria(keys));
      else m.el.removeAttribute('aria-keyshortcuts');
      // in a toolbar, narrow screens show only the icon, so the text goes in the tooltip too
      const bar = m.label !== null && m.el.parentElement?.classList.contains('tb-toolbar') === true;
      const tip = named ?? (keys !== null || bar ? t : null);
      m.el.title = tip === null ? '' : keys === null ? tip : `${tip} (${shortcutLabel(keys)})`;
      break;
    }
    // its data may have changed: the dialect deals the cards to their lanes again, if they moved
    case 'board': void fire('ui-board', f); break;
    case 'progress': syncProgress(m); return;
    case 'canvas': syncCanvas(m); return;
    case 'chart': syncChart(m); return;
    case 'orbit': syncOrbit(m); return;
    case 'icon': syncIcon(m); return;
    case 'video': case 'audio': syncMedia(m); return;
    case 'image': {
      const img = m.el as HTMLImageElement;
      const src = str(f, 'value') ?? '';
      if (img.getAttribute('src') !== src) img.src = src;
      img.alt = t ?? '';
      img.classList.toggle('tb-round', flag(f, 'round'));
      // a size, as in Red: the image fills it, cut to fit
      const ext = get(f, 'extent');
      img.style.width = ext.t === K.Pair ? `${ext.x}px` : '';
      img.style.height = ext.t === K.Pair ? `${ext.y}px` : '';
      return;
    }
    case 'table': case 'list': syncRows(m); return;
    case 'rows': syncRowsField(m, err); break;
    case 'tree': syncTree(m); return;
    case 'breadcrumb': syncBreadcrumb(m); return;
    case 'toolbar': {
      if (t !== null) m.el.setAttribute('aria-label', t);
      else m.el.removeAttribute('aria-label');
      break;
    }
    case 'desktop': case 'backdrop': {
      const src = str(f, 'value');
      m.el.style.backgroundImage = src !== null ? `url(${JSON.stringify(src)})` : '';
      break;
    }
    case 'dialog': syncDialog(m); break;
    case 'tabs': syncTabs(m); return;
    case 'steps': syncSteps(m); return;
    // a step that comes to apply or not changes the bar of its steps
    case 'step': {
      const up = m.el.parentElement === null ? undefined : byNode.get(m.el.parentElement);
      if (up !== undefined) syncSteps(up);
      break;
    }
    case 'split': syncSplit(m); return;
    case 'tab': if (m.button !== null) m.button.textContent = t ?? ''; break;
    case 'panel': {
      let h = m.el.querySelector<HTMLElement>(':scope > .tb-panel-title');
      if (t === null) h?.remove();
      else {
        if (h === null) {
          h = el('h2', 'tb-panel-title');
          m.el.prepend(h);
        }
        h.textContent = t;
      }
      break;
    }
    case 'scroll': {
      if (t !== null) m.el.setAttribute('aria-label', t);
      else m.el.removeAttribute('aria-label');
      break;
    }
    case 'grid': {
      const cols = get(f, 'cols');
      m.el.style.setProperty('--tb-cols', cols.t === K.Integer ? String(cols.v) : '2');
      // [1 4 1]: a column per weight, never narrower than what it holds (with fit, what it holds scrolls inside
      // it, so it can be); [small 1 small]: small, medium and large are columns of a width the theme sets
      const weights = cols.t === K.Block ? cols.s.data.slice(cols.i).filter(c => c.t === K.Integer || c.t === K.Word) : [];
      const least = flag(f, 'fit') ? '0' : 'min-content';
      const resize = flag(f, 'resize');
      // with resize, columns by count are written as weights, so a handle can size them
      const written = weights.length > 0
        ? weights.map(w => (w.t === K.Word ? `var(--tb-track-${form(w)})` : `minmax(${least}, ${form(w)}fr)`))
        : resize ? Array<string>(cols.t === K.Integer ? Number(cols.v) : 2).fill(`minmax(${least}, 1fr)`) : [];
      syncResize(m.el, f, written, resize);
      break;
    }
  }
  if (style === 'toolbar') syncToolbar(m.el);
  if (style === 'device') syncDevice(m.el);
  if (m.el instanceof HTMLButtonElement) {
    // a submit stays focusable while the form has errors; clicking it shows them
    if (flag(f, 'submit')) m.el.setAttribute('aria-disabled', flag(f, 'disabled') ? 'true' : 'false');
    else m.el.disabled = flag(f, 'disabled');
  }
  // children replaced by code: rebuild this container
  const kids = get(f, 'pane');
  if (kids.t === K.Block && (m.kids as BlockCell | undefined)?.s !== kids.s) {
    m.kids = kids;
    if (style === 'rows') {
      placeEntries(m);
      void fire('ui-pane', f);
      return;
    }
    const box = m.box ?? m.el;
    if (style === 'screens') placeScreen(m, box);
    else {
      const keep = box.querySelector(':scope > .tb-panel-title');
      box.replaceChildren(...(keep ? [keep] : []));
      appendChildren(box, f, style);
    }
    if (style === 'grid') placeResize(box);
    // let the dialect link the new faces to their view and form
    void fire('ui-pane', f);
  }
  if (style === 'screens') settleScreen(m.box ?? m.el, f);
}

/**
 * A screen is made away from the page; the page keeps the one it has until `entering`
 * ends, or shows the new one empty, as gray bars, if its on-enter takes long.
 */
export function placeScreen(m: Mounted, box: HTMLElement): void {
  const coming = el('div');
  setComingScreen(coming);
  appendChildren(coming, m.face, 'screens');
  settleScreen(box, m.face);
}

export function settleScreen(box: HTMLElement, f: ObjectCell): void {
  const entering = flag(f, 'entering');
  box.toggleAttribute('aria-busy', entering);
  if (entering) {
    // an on-enter that keeps the user waiting: the new screen comes now, gray where its data will be
    if (comingScreen !== null && loadingTimer === null) {
      loadingTimer = setTimeout(() => {
        loadingTimer = null;
        if (comingScreen === null || !flag(f, 'entering')) return;
        showComing(box, f, true);
      }, LOADING_AFTER);
    }
    return;
  }
  if (loadingTimer !== null) clearTimeout(loadingTimer);
  loadingTimer = null;
  if (comingScreen === null) delete box.dataset['tbLoading'];
  else showComing(box, f, false);
}

/** Puts the screen made last on the page, when the browser has its picture of it; one entering since waits for its own. */
export function showComing(box: HTMLElement, f: ObjectCell, loading: boolean): void {
  if (comingScreen === null) return;
  changeScreen(box, comingScreen, () => {
    const entering = flag(f, 'entering');
    if (comingScreen === null || (entering && !loading)) return;
    box.replaceChildren(...comingScreen.childNodes);
    setComingScreen(null);
    box.toggleAttribute('data-tb-loading', entering);
    enteredScreen(box);
    sweepSizes();   // the screen that left took its faces with it
  });
}

/** How long, in ms, a screen's on-enter may take before the screen comes without its data. */
export const LOADING_AFTER = 300;
export let loadingTimer: ReturnType<typeof setTimeout> | null = null;

/** Sets a spacing property to a step of the theme's scale, or back to the stylesheet's. */
export function space(e: HTMLElement, prop: string, v: Cell): void {
  if (v.t === K.Integer) e.style.setProperty(prop, `var(--tb-space-${v.v})`);
  else e.style.removeProperty(prop);
}

/** Sets the face-driven classes, keeping the base classes from build. */
export function setExtra(e: HTMLElement, cls: string[]): void {
  const prev = (e.dataset['tb'] ?? '').split(' ').filter(Boolean);
  for (const c of prev) if (!cls.includes(c)) e.classList.remove(c);
  for (const c of cls) e.classList.add(c);
  e.dataset['tb'] = cls.join(' ');
}

/**
 * Runs the reactions whose facets changed in this round, at once, so the repaint
 * that follows shows them: ui-react, given the faces on the page that have any.
 */
export function react(): void {
  for (const m of reactors) if (!m.el.isConnected && comingScreen?.contains(m.el) !== true) reactors.delete(m);
  sweepSizes(n => comingScreen?.contains(n) === true);
  if (reacting !== null || reactors.size === 0 || (dirty.length === 0 && dirtySeries.length === 0 && !newReactor)) return;
  setNewReactor(false);
  const faces = blockOf(K.Block, [...reactors].map(m => m.face));
  const ht = runNow(host.sch, { data: [{ t: K.Word, sym: intern('ui-react'), bind: host.rt.lib }, faces] }, 0);
  const warn = (t: HostTask) => {
    if (t.state !== 'done' || t.result.t !== K.Block) return;
    for (const c of (t.result as BlockCell).s.data) {
      console.warn(`Trebol: ${text(c as StringCell)}`);
      devLog.note('warning', text(c as StringCell));
    }
  };
  if (ht.state === 'done') warn(ht);
  else if (ht.state !== 'failed') {
    setReacting(ht);
    ht.watchers.push(t => {
      setReacting(null);
      // what changed while it waited is checked at the end of this round
      setNewReactor(true);
      warn(t);
    });
  }
}

/** Draws again the faces whose fields were set, and those showing a series or row changed in place. */
export function syncDirty(): void {
  const ctxs = dirty.splice(0);
  const series = dirtySeries.splice(0);
  for (const ctx of ctxs) ctx.dirty = false;
  for (const s of series) s.dirty = false;
  const owners = new Set<object>();
  for (const ctx of ctxs) {
    const m = byCtx.get(ctx);
    if (m !== undefined) owners.add(m);
  }
  ownersOf(series, ctxs, owners);
  watchChanged(series, ctxs, dirty, o => shown(o as Mounted));
  for (const m of owners as Set<Mounted>) if (shown(m)) sync(m);
}

