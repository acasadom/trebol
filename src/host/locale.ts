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
