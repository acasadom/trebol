// An upload: a button that is also a place to drop files, and the list of the
// chosen ones. Files go to Trebol as handles; their bytes stay in the browser.

import { K, string, form, blockOf, type Cell, type ObjectCell } from '../../core/index.ts';
import { activeLanguage, fileSize } from '../index.ts';
import { handleOf } from '../scheduler.ts';
import { fileHandle } from '../net.ts';
import { get, str, own, flag, word, icon } from './faces.ts';
import { type Mounted, host, newId, fire, el } from './mount.ts';
import { int } from './drag.ts';
import { fraction, required } from './fields.ts';

export function buildUpload(face: ObjectCell, m: Mounted): HTMLElement {
  const id = `tb-${newId()}`;
  const wrap = el('div', 'tb-field');
  const label = el('label', 'tb-label');
  label.htmlFor = id;
  const control = el('div', 'tb-control');
  const zone = el('div', 'tb-upload');
  const picker = el('input');
  picker.type = 'file';
  picker.hidden = true;
  picker.tabIndex = -1;
  const choose = el('button', 'tb-button');
  choose.type = 'button';
  choose.id = id;
  const svg = icon('upload');
  if (svg !== null) choose.append(svg);
  choose.append(el('span'));
  const hint = el('span', 'tb-upload-hint');
  const error = el('div', 'tb-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  choose.setAttribute('aria-describedby', error.id);
  const list = el('ul', 'tb-upload-list');
  const track = sentBar(label, id);
  choose.addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => {
    const files = [...(picker.files ?? [])];
    picker.value = '';
    if (files.length > 0) chooseFiles(face, files);
  });
  dropFiles(face, zone, choose);
  zone.append(choose, hint, picker);
  control.append(zone, list, track, error);
  wrap.append(label, control);
  m.label = label;
  m.error = error;
  m.button = choose;
  m.box = list;
  return wrap;
}

/** The accept list of an upload: extensions ("pdf") and types ("image/*"); a photo takes images unless told. */
export function acceptList(face: ObjectCell): string[] {
  const a = get(face, 'accept');
  if (a.t !== K.Block && word(face, 'style') === 'photo') return ['image/*'];
  return a.t === K.Block ? a.s.data.slice(a.i).map(x => form(x).trim().toLowerCase()).filter(x => x !== '') : [];
}

/** The picker's accept attribute for an accept list. */
export function pickerAccept(list: string[]): string {
  return list.map(x => (x.includes('/') || x.startsWith('.') ? x : `.${x}`)).join(',');
}

/** Lets a zone take files dropped on it, unless its button is disabled. */
export function dropFiles(face: ObjectCell, zone: HTMLElement, button: HTMLButtonElement): void {
  const hasFiles = (ev: DragEvent): boolean => ev.dataTransfer?.types.includes('Files') === true;
  zone.addEventListener('dragover', ev => {
    if (!hasFiles(ev) || button.disabled) return;
    ev.preventDefault();
    ev.dataTransfer!.dropEffect = 'copy';
    zone.classList.add('tb-drop-over');
  });
  zone.addEventListener('dragleave', ev => {
    if (!zone.contains(ev.relatedTarget as Node | null)) zone.classList.remove('tb-drop-over');
  });
  zone.addEventListener('drop', ev => {
    zone.classList.remove('tb-drop-over');
    if (!hasFiles(ev) || button.disabled) return;
    ev.preventDefault();
    chooseFiles(face, [...ev.dataTransfer!.files]);
  });
}

/** The bar of how far the files went up, while a fetch with progress sends them. */
export function sentBar(label: HTMLElement, id: string): HTMLElement {
  label.id = `${id}-label`;
  const track = el('div', 'tb-progress tb-upload-progress');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-labelledby', label.id);
  track.hidden = true;
  track.append(el('div', 'tb-progress-bar'));
  return track;
}

export function syncSent(m: Mounted): void {
  const track = m.el.querySelector<HTMLElement>('.tb-upload-progress')!;
  const sent = get(m.face, 'sent');
  const part = fraction(sent) ?? 0;
  track.hidden = sent.t === K.None;
  track.setAttribute('aria-valuenow', String(Math.round(part * 100)));
  (track.firstChild as HTMLElement).style.width = `${part * 100}%`;
}

// A photo: the image itself, a button to choose one and another to take it away. The
// image chosen shows from the browser's memory; one kept elsewhere, from its address.

// A video or a sound: the browser's own player. Captions are one track per language;
// the active language's is the one shown, and it follows set-language.

/** A video's captions as [language, address] pairs: a file alone is in the active language. */
export function captionTracks(f: ObjectCell): [string, string][] {
  const c = get(f, 'captions');
  if (c.t === K.File || c.t === K.Url || c.t === K.String) return [[activeLanguage(host.rt), form(c)]];
  if (c.t !== K.Block) return [];
  const d = c.s.data.slice(c.i);
  const out: [string, string][] = [];
  for (let i = 0; i + 1 < d.length; i += 2) out.push([form(d[i]!), form(d[i + 1]!)]);
  return out;
}

export function syncMedia(m: Mounted): void {
  const f = m.face;
  const media = m.el as HTMLMediaElement;
  const src = str(f, 'value') ?? '';
  if (media.getAttribute('src') !== src) media.src = src;
  const t = str(f, 'text');
  if (t !== null) media.setAttribute('aria-label', t);
  else media.removeAttribute('aria-label');
  media.loop = flag(f, 'looping');
  // browsers only let what plays on its own do so without sound
  const auto = flag(f, 'autoplay');
  media.muted = flag(f, 'silent') || auto;
  media.autoplay = auto;
  if (!(media instanceof HTMLVideoElement)) return;
  const poster = str(f, 'poster') ?? '';
  if (media.getAttribute('poster') !== poster) media.poster = poster;
  const lang = activeLanguage(host.rt);
  const tracks = captionTracks(f);
  const names = new Intl.DisplayNames([lang], { type: 'language' });
  const now = Array.from(media.querySelectorAll('track'));
  if (now.map(x => `${x.srclang} ${x.getAttribute('src')}`).join('|') !== tracks.map(([l, s]) => `${l} ${s}`).join('|')) {
    media.replaceChildren(...tracks.map(([l, s]) => {
      const track = el('track') as HTMLTrackElement;
      track.kind = 'captions';
      track.srclang = l;
      track.src = s;
      return track;
    }));
  }
  // the captions shown, if any, follow the active language
  const showing = Array.from(media.textTracks).some(x => x.mode === 'showing');
  const pick = tracks.findIndex(([l]) => l === lang);
  media.querySelectorAll('track').forEach((track, i) => {
    track.label = names.of(track.srclang) ?? track.srclang;
    track.default = i === Math.max(0, pick);
    if (showing) track.track.mode = i === Math.max(0, pick) ? 'showing' : 'disabled';
  });
}

/** The address that shows each chosen file, made once and freed when the photo shows another. */
export const shownUrls = new WeakMap<HTMLElement, { blob: Blob; url: string }>();

export function buildPhoto(face: ObjectCell, m: Mounted): HTMLElement {
  const id = `tb-${newId()}`;
  const wrap = el('div', 'tb-field');
  const label = el('label', 'tb-label');
  label.htmlFor = id;
  const control = el('div', 'tb-control');
  const zone = el('div', 'tb-photo');
  // the frame opens the picker for a pointer; the keyboard has the button
  const frame = el('div', 'tb-photo-frame');
  frame.addEventListener('click', () => { if (!choose.disabled) picker.click(); });
  const picker = el('input');
  picker.type = 'file';
  picker.hidden = true;
  picker.tabIndex = -1;
  const actions = el('div', 'tb-photo-actions');
  const choose = el('button', 'tb-button');
  choose.type = 'button';
  choose.id = id;
  const svg = icon('upload');
  if (svg !== null) choose.append(svg);
  choose.append(el('span'));
  const remove = el('button', 'tb-button tb-photo-remove');
  remove.type = 'button';
  remove.addEventListener('click', () => {
    choose.focus();
    void fire('ui-remove-file', face, int(1));
  });
  const error = el('div', 'tb-error');
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  choose.setAttribute('aria-describedby', error.id);
  choose.addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => {
    const files = [...(picker.files ?? [])];
    picker.value = '';
    if (files.length > 0) chooseFiles(face, files);
  });
  dropFiles(face, zone, choose);
  actions.append(choose, remove);
  zone.append(frame, actions, picker);
  control.append(zone, sentBar(label, id), error);
  wrap.append(label, control);
  m.label = label;
  m.error = error;
  m.button = choose;
  m.box = frame;
  return wrap;
}

/** What a photo shows: the image chosen, or the address of one kept elsewhere; null for none. */
export function photoSrc(frame: HTMLElement, v: Cell): string | null {
  const kept = shownUrls.get(frame);
  const file = v.t === K.Object ? handleOf<Blob>(get(v as ObjectCell, 'file'), 'file') : null;
  if (file !== null && kept !== undefined && kept.blob === file) return kept.url;
  if (kept !== undefined) {
    URL.revokeObjectURL(kept.url);
    shownUrls.delete(frame);
  }
  if (file !== null) {
    const url = URL.createObjectURL(file);
    shownUrls.set(frame, { blob: file, url });
    return url;
  }
  return v.t === K.String || v.t === K.Url || v.t === K.File ? form(v) : null;
}

export function syncPhoto(m: Mounted, err: string | null): void {
  const f = m.face;
  const t = str(f, 'text') ?? '';
  m.label!.textContent = t;
  m.label!.classList.toggle('tb-required', required(f));
  const readonly = flag(f, 'readonly');
  const choose = m.button!;
  choose.disabled = flag(f, 'disabled') || readonly;
  choose.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
  const frame = m.box!;
  frame.classList.toggle('tb-round', flag(f, 'round'));
  frame.classList.toggle('tb-photo-pick', !choose.disabled);
  const src = photoSrc(frame, get(f, 'value'));
  let img = frame.querySelector('img');
  if (src === null) {
    if (img !== null || frame.firstChild === null) {
      const svg = icon(flag(f, 'round') ? 'user' : 'image');
      frame.replaceChildren(...(svg !== null ? [svg] : []));
    }
  } else {
    if (img === null) {
      img = el('img') as HTMLImageElement;
      frame.replaceChildren(img);
    }
    if (img.getAttribute('src') !== src) img.src = src;
    img.alt = t;
  }
  (choose.lastChild as HTMLElement).textContent = own(src === null ? 'choose-photo' : 'change-photo');
  const remove = m.el.querySelector<HTMLButtonElement>('.tb-photo-remove')!;
  remove.textContent = own('remove-photo');
  remove.hidden = src === null || readonly;
  remove.disabled = choose.disabled;
  // read only, there is nothing to choose: only the photo is left
  (m.el.querySelector('.tb-photo-actions') as HTMLElement).hidden = readonly;
  (m.el.querySelector('input[type="file"]') as HTMLInputElement).accept = pickerAccept(acceptList(f));
  m.error!.textContent = err ?? '';
  syncSent(m);
}



export function accepts(file: File, list: string[]): boolean {
  if (list.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return list.some(x => x.includes('/')
    ? (x.endsWith('/*') ? type.startsWith(x.slice(0, -1)) : type === x)
    : name.endsWith(x.startsWith('.') ? x : `.${x}`));
}

export function chooseFiles(face: ObjectCell, files: File[]): void {
  const list = acceptList(face);
  const ok = files.filter(f => accepts(f, list));
  const taken = flag(face, 'multiple') ? ok : ok.slice(0, 1);
  const cells: Cell[] = [];
  for (const f of taken) cells.push(string(f.name), int(f.size), string(f.type), fileHandle(f));
  const refused = files.filter(f => !accepts(f, list)).map(f => string(f.name));
  void fire('ui-files', face, blockOf(K.Block, cells), blockOf(K.Block, refused));
}

/** A link as the page would follow it, relative ones too; null unless it is http or https. */
export function webHref(url: string): string | null {
  try {
    const u = new URL(url, location.href);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function syncUpload(m: Mounted, err: string | null): void {
  const f = m.face;
  const label = m.label!;
  label.textContent = str(f, 'text') ?? '';
  label.classList.toggle('tb-required', required(f));
  const many = flag(f, 'multiple');
  const choose = m.button!;
  (choose.lastChild as HTMLElement).textContent = own(many ? 'choose-files' : 'choose-file');
  const readonly = flag(f, 'readonly');
  choose.disabled = flag(f, 'disabled') || readonly;
  choose.setAttribute('aria-invalid', err !== null ? 'true' : 'false');
  const zone = choose.parentElement!;
  // read only, there is nothing to choose: only the files are left
  zone.hidden = readonly;
  (zone.querySelector('.tb-upload-hint') as HTMLElement).textContent = own(many ? 'drop-files' : 'drop-file');
  const picker = zone.querySelector('input') as HTMLInputElement;
  picker.multiple = many;
  picker.accept = pickerAccept(acceptList(f));
  m.error!.textContent = err ?? '';
  const v = get(f, 'value');
  const files = v.t === K.Block ? v.s.data.slice(v.i).filter(x => x.t === K.Object) as ObjectCell[] : [];
  const lang = activeLanguage(host.rt);
  const items = files.map((file, i) => {
    const li = el('li');
    // a file kept elsewhere has a url: its name opens it, and an image shows itself small
    const url = str(file, 'url');
    const href = url !== null ? webHref(url) : null;
    const name = el(href !== null ? 'a' : 'span', 'tb-upload-name');
    name.textContent = str(file, 'name') ?? '';
    if (name instanceof HTMLAnchorElement && href !== null) {
      name.href = href;
      name.target = '_blank';
      name.rel = 'noopener';
    }
    if (href !== null && (str(file, 'type') ?? '').startsWith('image/')) {
      const thumb = el('img', 'tb-upload-thumb');
      thumb.src = href;
      thumb.alt = '';
      li.append(thumb);
    }
    const size = el('span', 'tb-upload-size');
    const n = get(file, 'size');
    size.textContent = n.t === K.Integer ? fileSize(Number(n.v), lang) : '';
    if (readonly) {
      li.append(name, size);
      return li;
    }
    const remove = el('button', 'tb-upload-remove');
    remove.type = 'button';
    remove.disabled = choose.disabled;
    remove.setAttribute('aria-label', own('remove-file', name.textContent ?? ''));
    const x = icon('close');
    if (x !== null) remove.append(x);
    remove.addEventListener('click', () => {
      choose.focus();
      void fire('ui-remove-file', f, int(i + 1));
    });
    li.append(name, size, remove);
    return li;
  });
  m.box!.replaceChildren(...items);
  m.box!.hidden = items.length === 0;
  syncSent(m);
}

