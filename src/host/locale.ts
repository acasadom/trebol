// Values in the format of a language: dates, times, numbers, percents and
// money, through Intl. It works wherever Intl does (browser or Node); the
// core keeps its own language-neutral form/mold.

import {
  K, native, value, string, form, text, formatDec, spell, ctxFind, intern,
  type Cell, type ObjectCell, type StringCell, type WordCell, type Runtime,
} from '../core/index.ts';

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

/** The active language: `i18n/language` of the user context, `en` if there is none. */
export function activeLanguage(rt: Runtime): string {
  const i = ctxFind(rt.user, intern('i18n'));
  const obj = i < 0 ? null : rt.user.vals[i]!;
  if (obj === null || obj.t !== K.Object) return 'en';
  const o = obj as ObjectCell;
  const j = ctxFind(o.ctx, intern('language'));
  const lang = j < 0 ? null : o.ctx.vals[j]!;
  if (lang?.t === K.Word || lang?.t === K.LitWord) return spell((lang as WordCell).sym);
  if (lang?.t === K.String) return text(lang as StringCell);
  return 'en';
}

/** A value as it shows on screen in a language: local format, or `form`. */
export function shown(c: Cell, lang: string): string {
  return formatLocal(c, lang) ?? form(c);
}

native('format-local', '[value [any-type!] language [word! string!]]', (_t, f) => {
  const l = f.args[1]!;
  const lang = l.t === K.String ? text(l as StringCell) : spell((l as WordCell).sym);
  return value(string(shown(f.args[0]!, lang)));
});
