// Values in the format of a language: dates, times, numbers, percents and
// money, through Intl. It works wherever Intl does (browser or Node); the
// core keeps its own language-neutral form/mold.

import {
  K, native, value, string, form, text, formatDec, spell, ctxFind, intern, integer, decimal, percent, money, dec,
  decToNumber, I64,
  type Cell, type ObjectCell, type StringCell, type WordCell, type MapCell, type Runtime,
} from '../core/index.ts';

/** How much a number, a percent or an amount is, as a JavaScript number; null for anything else. */
export function amountOf(c: Cell): number | null {
  switch (c.t) {
    case K.Integer: return I64.toNumber(c.v);
    case K.Decimal: case K.Percent: return c.v;
    case K.Money: return decToNumber(c.v);
    default: return null;
  }
}

/** The digits after the point a decimal number is written with. */
function fractionDigits(n: number): number {
  const m = /\.(\d+)|e-(\d+)/.exec(String(n));
  return m === null ? 0 : m[1] !== undefined ? m[1].length : Number(m[2]);
}

/**
 * What a number that counts shows at x on its way to `to` (a text with `count`): a value of the kind of `to`,
 * with no more digits than it has, so the run reads as the number it ends on.
 */
export function countStep(to: Cell, x: number): Cell {
  switch (to.t) {
    case K.Integer: return integer(Math.round(x));
    case K.Money: return money(dec(BigInt(Math.round(x * 10 ** to.v.e)), to.v.e), to.cur);
    case K.Decimal: case K.Percent: {
      const k = 10 ** fractionDigits(to.v);
      const v = Math.round(x * k) / k;
      return to.t === K.Decimal ? decimal(v) : percent(v);
    }
    default: return to;
  }
}

/** The kinds `localize` formats; anything else shows as `form` gives it. */
export const LOCAL_KINDS: ReadonlySet<number> = new Set([K.Date, K.Time, K.Integer, K.Decimal, K.Percent, K.Money]);

const NS_PER_MS = 1e6;
const DAY_NS = 24 * 3600 * 1e9;

function safe(fn: () => string): string | null {
  try { return fn(); } catch { return null; }
}

/** A value in the format of a language tag (`es`, `en-GB`); null when it has no local format. */
export function formatLocal(c: Cell, lang: string): string | null {
  switch (c.t) {
    case K.Integer:
      return safe(() => new Intl.NumberFormat(lang).format(c.v));
    case K.Decimal:
      return safe(() => new Intl.NumberFormat(lang, { maximumSignificantDigits: 15 }).format(c.v));
    case K.Percent:
      return safe(() => new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 2 }).format(c.v));
    case K.Money: {
      // a decimal string keeps every digit; Intl never goes through a float
      const amount = formatDec(c.v) as unknown as number;
      const frac = { minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, c.v.e) };
      return safe(() => new Intl.NumberFormat(lang, c.cur !== ''
        ? { style: 'currency', currency: c.cur, ...frac }
        : frac).format(amount));
    }
    case K.Date: {
      const d = c.v;
      const ms = Date.UTC(d.y, d.m - 1, d.d) + (d.time ?? 0) / NS_PER_MS;
      const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' };
      if (d.time !== null) Object.assign(opts, { hour: 'numeric', minute: '2-digit' });
      // years before 100 would be read as 19xx
      if (d.y < 100) return null;
      return safe(() => new Intl.DateTimeFormat(lang, opts).format(ms));
    }
    case K.Time: {
      if (c.v < 0 || c.v >= DAY_NS) return null;
      const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' };
      if (c.v % 6e10 !== 0) opts.second = '2-digit';
      return safe(() => new Intl.DateTimeFormat(lang, opts).format(c.v / NS_PER_MS));
    }
  }
  return null;
}

/** The decimal and group separators of a language: `,` and `.` in `es`. */
function separators(lang: string): { decimal: string; group: string } {
  let parts: Intl.NumberFormatPart[] = [];
  try { parts = new Intl.NumberFormat(lang).formatToParts(12345.6); } catch { /* unknown language tag */ }
  const find = (type: string): string | undefined => parts.find(p => p.type === type)?.value;
  return { decimal: find('decimal') ?? '.', group: find('group') ?? ',' };
}

/** An amount as it is edited in a language: no thousands, the local decimal separator (`1234,50`). */
export function editLocal(c: Cell, lang: string): string {
  if (c.t !== K.Money) return c.t === K.None ? '' : form(c);
  const amount = formatDec(c.v) as unknown as number;
  const opts = { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, c.v.e) };
  return safe(() => new Intl.NumberFormat(lang, opts).format(amount)) ?? formatDec(c.v);
}

/**
 * An amount typed in a language as Trebol reads it (`1234.5`), or null when it is not one.
 * Currency signs and spaces are dropped. Thousands only count in groups of three; a single
 * other separator is the decimal one, so `12.5` is twelve and a half in `es` too.
 */
export function readLocal(s: string, lang: string): string | null {
  const { decimal, group } = separators(lang);
  const sep = (ch: string): boolean => ch === decimal || ch === group || ch === '.' || ch === ',';
  let t = [...s].filter(ch => /[0-9+-]/.test(ch) || sep(ch)).join('');
  if (t.includes(decimal)) {
    const [whole, ...rest] = t.split(decimal);
    if (rest.length > 1) return null;
    t = `${grouped(whole!, group)}.${rest[0]}`;
  } else if (/^[+-]?\d{1,3}([.,]\d{3})+$/.test(t) && [...t].filter(sep).every(ch => ch === group)) {
    t = grouped(t, group);
  } else if ([...t].filter(sep).length === 1) {
    t = t.replace(/[.,]/, '.');
  }
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(t) ? t : null;
}

/** The whole part of an amount without its thousands separators. */
function grouped(whole: string, group: string): string {
  return whole.split(group).join('');
}

/** The order of day, month and year in the dates of a language: `dmy` in `es`, `mdy` in `en`. */
function dateOrder(lang: string): string {
  let parts: Intl.DateTimeFormatPart[] = [];
  try { parts = new Intl.DateTimeFormat(lang, { timeZone: 'UTC' }).formatToParts(Date.UTC(2026, 10, 23)); } catch { /* unknown language tag */ }
  const order = parts.map(p => p.type[0]).filter(c => c === 'd' || c === 'm' || c === 'y').join('');
  return order.length === 3 ? order : 'dmy';
}

/**
 * A date typed in a language as Trebol reads it (`2026-11-03`), or null when it is not one.
 * Day, month and year go in the order of the language with any separator; `2026-11-03`
 * reads in every language, and a two-digit year is in this century.
 */
export function readDate(s: string, lang: string): string | null {
  const nums = s.trim().split(/[^0-9]+/).filter(n => n !== '');
  if (nums.length !== 3) return null;
  const order = nums[0]!.length === 4 ? 'ymd' : dateOrder(lang);
  const at = (c: string): number => Number(nums[order.indexOf(c)]);
  let y = at('y');
  const m = at('m'), d = at('d');
  if (nums[order.indexOf('y')]!.length <= 2) y += 2000;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (y < 100 || t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Two dates typed for a range, as `2026-11-03 2026-11-10` with the start first, or null. They are
 * written apart by a dash with spaces around it, as `3/11/2026 – 10/11/2026` or `3/11/2026 - 10/11/2026`,
 * or by a space alone; a range typed end first is turned round.
 */
export function readRange(s: string, lang: string): string | null {
  let parts = s.trim().split(/\s*[\u2013\u2014]\s*|\s+-\s+/);
  if (parts.length === 1) parts = s.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const [a, b] = parts.map(p => readDate(p, lang));
  if (a == null || b == null) return null;
  return a <= b ? `${a} ${b}` : `${b} ${a}`;
}

/**
 * A time typed in any language, as `09:30`, or null: `9:30`, `9.30`, `9h30`, `930`, `21`, and with am or pm,
 * `9:30 pm` or `9pm`. Minutes go from 00 to 59 and hours from 0 to 23, or 1 to 12 with am or pm.
 */
export function readTime(s: string): string | null {
  const t = /^(\d{1,2})(?:\s*[:.h]\s*(\d{2})|(\d{2}))?\s*h?\s*(?:([ap])\.?\s*m\.?)?$/i.exec(s.trim());
  if (t === null) return null;
  let h = Number(t[1]);
  const m = Number(t[2] ?? t[3] ?? 0);
  const half = t[4]?.toLowerCase();
  if (m > 59) return null;
  if (half !== undefined) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (half === 'p' ? 12 : 0);
  } else if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** The first day of the week in a language, 1 for Monday to 7 for Sunday. */
export function weekStart(lang: string): number {
  try {
    const loc = new Intl.Locale(lang) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const first = (loc.getWeekInfo?.() ?? loc.weekInfo)?.firstDay;
    if (first !== undefined) return first;
    // without week data, only regions known to start on Sunday
    return ['US', 'CA', 'MX', 'BR', 'JP', 'IL', 'PH'].includes(loc.maximize().region ?? '') ? 7 : 1;
  } catch {
    return 1;
  }
}

/** The active language: `i18n/language` of the user context, `en` if there is none. */
export function activeLanguage(rt: Runtime): string {
  const i = ctxFind(rt.lib, intern('i18n'));
  const obj = i < 0 ? null : rt.lib.vals[i]!;
  if (obj === null || obj.t !== K.Object) return 'en';
  const o = obj as ObjectCell;
  const j = ctxFind(o.ctx, intern('language'));
  const lang = j < 0 ? null : o.ctx.vals[j]!;
  if (lang?.t === K.Word || lang?.t === K.LitWord) return spell((lang as WordCell).sym);
  if (lang?.t === K.String) return text(lang as StringCell);
  return 'en';
}

/** A field of the user's `i18n` object, or null. */
function i18nField(rt: Runtime, name: string): Cell | null {
  const i = ctxFind(rt.lib, intern('i18n'));
  const obj = i < 0 ? null : rt.lib.vals[i]!;
  if (obj === null || obj.t !== K.Object) return null;
  const j = ctxFind((obj as ObjectCell).ctx, intern(name));
  return j < 0 ? null : (obj as ObjectCell).ctx.vals[j]!;
}

/** The value under a key of a map (a word or a string key, any case), or null. */
export function mapAt(m: MapCell, key: string): Cell | null {
  const d = m.s.data;
  const k = key.toLowerCase();
  for (let i = 0; i + 1 < d.length; i += 2) {
    const c = d[i]!;
    const name = c.t === K.String ? text(c as StringCell) : 'sym' in c ? spell((c as WordCell).sym) : null;
    if (name !== null && name.toLowerCase() === k) return d[i + 1]!;
  }
  return null;
}

/**
 * A text of the interface in the active language, as `tr` gives it: a string
 * as is, a text per language (a map) in the active language, then the main
 * one, then any, and a word through the dictionary `i18n/texts`.
 */
export function translate(c: Cell, rt: Runtime): string {
  if (c.t === K.String) return text(c as StringCell);
  if (c.t === K.Map) {
    const main = i18nField(rt, 'main');
    const t = mapAt(c as MapCell, activeLanguage(rt))
      ?? (main !== null && 'sym' in main ? mapAt(c as MapCell, spell((main as WordCell).sym)) : null)
      ?? (c as MapCell).s.data.find((v, i) => i % 2 === 1 && v.t === K.String)
      ?? null;
    return t === null ? '' : translate(t, rt);
  }
  if (c.t === K.Word || c.t === K.LitWord) {
    const texts = i18nField(rt, 'texts');
    const t = texts?.t === K.Map ? mapAt(texts as MapCell, spell((c as WordCell).sym)) : null;
    return t === null ? spell((c as WordCell).sym) : translate(t, rt);
  }
  return form(c);
}

/**
 * One of Trebol's own texts (the map `i18n/ui`) in the active language, with
 * `#1`, `#2`... replaced by the arguments. A key that is missing shows as is.
 */
export function uiText(rt: Runtime, key: string, ...args: string[]): string {
  const ui = i18nField(rt, 'ui');
  const t = ui?.t === K.Map ? mapAt(ui as MapCell, key) : null;
  let out = t === null ? key : translate(t, rt);
  args.forEach((a, i) => { out = out.replaceAll(`#${i + 1}`, a); });
  return out;
}

/** A value as it shows on screen in a language: local format, or `form`. */
export function shown(c: Cell, lang: string): string {
  return formatLocal(c, lang) ?? form(c);
}

/** A size in bytes as it reads in a language: 89 bytes, 12 kB, 3.4 MB. */
export function fileSize(bytes: number, lang: string): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'];
  let n = bytes;
  let u = 0;
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  try {
    // short bytes read "89 byte" in English: whole words for bytes, symbols above
    const display = u === 0 ? 'long' : 'short';
    return new Intl.NumberFormat(lang, { style: 'unit', unit: units[u], unitDisplay: display, maximumFractionDigits: u === 0 ? 0 : 1 }).format(n);
  } catch {
    return `${bytes} B`;
  }
}

native('format-local', '["The value as text in the way of a language: dates, numbers, money." value [any-type!] language [word! string!]]', (_t, f) => {
  const l = f.args[1]!;
  const lang = l.t === K.String ? text(l as StringCell) : spell((l as WordCell).sym);
  return value(string(shown(f.args[0]!, lang)));
});
