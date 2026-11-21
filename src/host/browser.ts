// The browser host: boots Trebol in a page, renders faces to the DOM and
// turns DOM events into tasks.
//
// A page needs only:
//
//   <script type="module">import 'trebol/browser';</script>
//   <script type="text/trebol" src="app.trb"></script>
//
// (`trebol dev` resolves `trebol/browser` to this file.)
//
// There is one DOM node per face and no virtual DOM. Setting a field of a
// mounted face marks it dirty (see `ctxSet` in the core); after every round
// of scheduler slices the host copies the fields of the dirty faces to their
// nodes, so `total/text: "42"` shows up without any explicit refresh.
// Changing a series in place (`append f/text "x"`) does not mark the face:
// set the field again to repaint it.
//
// This file boots the page and holds the natives the UI dialect calls (show,
// repaint, apply-theme); the rest lives in browser/, one file per part:
// mount.ts builds a face's node, sync.ts copies fields to it, and each kind of
// face or behaviour (tables.ts, menus.ts, drag.ts, calendar.ts...) has its own.


import { K, NONE, native, value, getWord, intern, spell, text, type ObjectCell, type StringCell } from '../core/index.ts';
import { startHost, startUi, runSource, report, activeLanguage } from './index.ts';
import { spawn } from './scheduler.ts';
import { DEFAULT_THEME, LOOKS, THEME_WORDS, type ThemeParams } from './theme.ts';
import { interCss } from './fonts.ts';
import { addBuiltIn, builtInText } from './modules.ts';
import { devLog } from './devlog.ts';
import { startDevtools } from './devtools.ts';
import { get, str, showOwn, word, children } from './browser/faces.ts';
import { host, byNode, byCtx, dirty, fire, showError, build, setHost } from './browser/mount.ts';
import { seenKeys, setViewKeys } from './browser/events.ts';
import { onPick } from './browser/pick.ts';
import { swipe, onSwipeMove, onSwipeEnd, outsideSwipe } from './browser/swipe.ts';
import { mountedAbove, dragging, endDrag, onPointerDown, onPointerMove, onReorderKey } from './browser/drag.ts';
import { onKeyDown, onViewKey } from './browser/keys.ts';
import { onRowsMoved, onPrint } from './browser/tables.ts';
import { stepsLanded, undoToasts } from './browser/dialogs.ts';
import { sync, react, syncDirty } from './browser/sync.ts';
import { watchShown } from './browser/inplace.ts';
import { screensFace, routeBlock, here, startHistory, undoing, landHistory, unsaved, setScreensFace, setHere, setUndoing } from './browser/screens.ts';
import { root, titleFace, setSheet, setTheme, setRoot, setRootFace, setTitleFace } from './browser/page.ts';
// every part, for what it does as it loads (natives, listeners)
import './browser/faces.ts';
import './browser/mount.ts';
import './browser/events.ts';
import './browser/swipe.ts';
import './browser/drag.ts';
import './browser/menus.ts';
import './browser/calendar.ts';
import './browser/times.ts';
import './browser/keys.ts';
import './browser/count.ts';
import './browser/fields.ts';
import './browser/uploads.ts';
import './browser/widget.ts';
import './browser/lookup.ts';
import './browser/drawings.ts';
import './browser/orbits.ts';
import './browser/row-faces.ts';
import './browser/richtext.ts';
import './browser/tables.ts';
import './browser/trees.ts';
import './browser/toolbars.ts';
import './browser/dialogs.ts';
import './browser/sync.ts';
import './browser/screens.ts';
import './browser/page.ts';

// --- natives -----------------------------------------------------------------------

native('ui-watch', '["Marks an object, series or map a reaction reads, so that a change to it, or in place in it, runs the reactions at the end of the round." value [object! series! map!]]', (_t, f) => {
  const v = f.args[0]!;
  if (v.t === K.Object) (v as ObjectCell).ctx.watch = dirty;
  else watchShown(v, dirty);
  return value(v);
});

native('repaint', '["Redraws the faces that changed." ]', () => {
  // after a change of language: every mounted face shows its values again
  document.documentElement.lang = activeLanguage(host.rt);
  if (titleFace !== null) document.title = str(titleFace, 'text') ?? document.title;
  for (const e of Array.from(document.querySelectorAll<HTMLElement>('[data-tb-own]'))) showOwn(e);
  for (const e of Array.from(document.querySelectorAll('*'))) {
    const m = byNode.get(e);
    if (m !== undefined && m.el === e) sync(m);
  }
  return value(NONE);
});

native('show', '["Draws a face and everything in it." face [object!]]', (_t, f) => {
  const face = f.args[0] as ObjectCell;
  setRootFace(face);
  setViewKeys(null);
  setScreensFace(null);
  document.documentElement.lang = activeLanguage(host.rt);
  const node = build(face);
  if (root !== null) root.replaceWith(node);
  else document.body.append(node);
  setRoot(node);
  const title = children(face).find(c => word(c, 'style') === 'title');
  // a screen names the page itself
  if (title !== undefined && screensFace === null) {
    document.title = str(title, 'text') ?? document.title;
    setTitleFace(title);
  }
  return value(face);
});

/** Theme parameters from a theme object, keeping defaults for anything missing or unknown. */
export function themeParams(obj: ObjectCell): ThemeParams {
  const look = word(obj, 'look');
  const p: ThemeParams = { ...DEFAULT_THEME, ...(look !== null ? LOOKS[look] : undefined) };
  const num = (n: string): number | null => {
    const v = get(obj, n);
    return v.t === K.Integer ? Number(v.v) : v.t === K.Decimal ? v.v : null;
  };
  p.base = num('base') ?? p.base;
  const given = num('accent');
  p.accent = given ?? (look !== null && num('base') === null && look in LOOKS ? p.accent : (p.base + 180) % 360);
  p.color = Math.min(1, Math.max(0, num('color') ?? p.color));
  if (num('line') === 2 || num('line') === 1) p.line = num('line') as 1 | 2;
  for (const [key, allowed] of Object.entries(THEME_WORDS)) {
    const w = word(obj, key);
    if (w !== null && allowed.includes(w)) (p as unknown as Record<string, string>)[key] = w;
  }
  const font = get(obj, 'font');
  if (font.t === K.Word) p.font = spell(font.sym).toLowerCase();
  else if (font.t === K.String) p.font = text(font as StringCell);
  const headings = get(obj, 'headings');
  if (headings.t === K.Word) p.headings = spell(headings.sym).toLowerCase();
  else if (headings.t === K.String) p.headings = text(headings as StringCell);
  return p;
}

native('apply-theme', '["Changes the look of the whole screen." spec [object!]]', (_t, f) => {
  setTheme(themeParams(f.args[0] as ObjectCell));
  return value(f.args[0]!);
});

// --- boot --------------------------------------------------------------------------

async function boot(): Promise<void> {
  // a page of trebol build has the app's files inside, by their path from the page, and its own fonts
  const files = document.getElementById('trebol-files');
  if (files !== null) {
    for (const [path, src] of Object.entries(JSON.parse(files.textContent ?? '{}') as Record<string, string>)) {
      addBuiltIn(new URL(path, location.href).href, src);
    }
  }
  if (document.querySelector('style[data-tb-fonts], link[data-tb-fonts]') === null) {
    setSheet('fonts', interCss(file => new URL(`fonts/${file}`, import.meta.url).href));
  }
  setTheme(DEFAULT_THEME);
  setHost(startHost({ onError: e => showError(report(e)) }));
  host.sch.afterPump = () => {
    react();
    syncDirty();
    devLog.repainted();
  };
  // an answer kept by cached that comes: the reactions that read it run
  const news = getWord({ t: K.Word, sym: intern('ui-cache-news'), bind: host.rt.lib });
  if (news?.t === K.Object) news.ctx.watch = dirty;
  // the page back into view: what cached kept is asked again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') spawn(host.sch, { data: [{ t: K.Word, sym: intern('ui-caches-again'), bind: host.rt.lib }] }, 0);
    // hidden, maybe closed: what waits for a notice to go is done now (its requests are sent with keepalive)
    else if (undoToasts.size > 0) spawn(host.sch, { data: [{ t: K.Word, sym: intern('ui-toasts-done'), bind: host.rt.lib }] }, 0);
  });
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keydown', onReorderKey);
  // a scroll anywhere: the page, a scroll face, a dialog
  document.addEventListener('scroll', onRowsMoved, { capture: true, passive: true });
  addEventListener('resize', onRowsMoved);
  addEventListener('beforeunload', ev => { if (unsaved) ev.preventDefault(); });
  addEventListener('beforeprint', () => onPrint(true));
  addEventListener('afterprint', () => onPrint(false));
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('click', onPick);
  document.addEventListener('pointermove', onPointerMove, { passive: false });
  document.addEventListener('pointerup', () => endDrag(true));
  document.addEventListener('pointercancel', () => endDrag(false));
  document.addEventListener('pointermove', onSwipeMove, { passive: false });
  document.addEventListener('pointerup', onSwipeEnd);
  document.addEventListener('pointercancel', onSwipeEnd);
  document.addEventListener('pointerdown', outsideSwipe, true);
  document.addEventListener('scroll', outsideSwipe, { capture: true, passive: true });
  addEventListener('resize', outsideSwipe);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && dragging?.on) { ev.preventDefault(); seenKeys.add(ev); endDrag(false); } }, true);
  // a touch drag must not scroll the page
  document.addEventListener('touchmove', ev => { if (dragging?.on || swipe?.on) ev.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', onViewKey);
  const devMark = document.querySelector('meta[name="trebol-dev"]');
  if (devMark !== null) {
    startDevtools({
      host,
      root: devMark.getAttribute('content'),
      faceOf: e => {
        const m = byNode.get(e);
        return m !== undefined && m.el === e ? m.face : null;
      },
      faceAt: e => {
        const m = mountedAbove(e);
        return m === undefined ? null : { face: m.face, el: m.el };
      },
      nodeOf: face => {
        const e = byCtx.get(face.ctx)?.el;
        return e?.isConnected === true ? e : null;
      },
    });
  }
  startHistory();
  window.addEventListener('popstate', stepsLanded);
  window.addEventListener('hashchange', () => {
    if (undoing !== null) {
      setHere(undoing);
      setUndoing(null);
      history.replaceState({ ...here }, '');
      return;
    }
    landHistory();
    if (screensFace !== null) void fire('ui-route', screensFace, routeBlock());
  });
  await startUi(host);
  for (const s of Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="text/trebol"]'))) {
    const src = s.getAttribute('src');
    const url = src !== null ? new URL(src, location.href).href : location.href;
    const code = src !== null ? builtInText(url) ?? await (await fetch(url)).text() : s.textContent ?? '';
    try {
      await runSource(host, code, url);
    } catch (e) {
      showError(e instanceof Error ? e.message : report(e as ObjectCell));
    }
  }
}

void boot();

