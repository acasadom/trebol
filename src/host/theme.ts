// The theme: a handful of parameters from which every visual value is
// derived, compiled once into CSS custom properties plus a fixed stylesheet.
//
// Colors are computed in OKLCH. Each role has a fixed lightness per mode,
// chosen so text meets WCAG AA on the backgrounds it is used on; the hue
// comes from the theme (`base`, `accent`, `neutral`). `contrast()` checks it
// and the tests run it over every hue.

export interface ThemeParams {
  /** Hue of the primary color, 0-360. */
  base: number;
  /** Hue of the accent color, 0-360. */
  accent: number;
  neutral: 'cool' | 'neutral' | 'warm';
  density: 'compact' | 'normal' | 'comfortable';
  radius: 'sharp' | 'soft' | 'round';
  font: string;
  mode: 'light' | 'dark' | 'auto';
}

export const DEFAULT_THEME: ThemeParams = {
  base: 250, accent: 30, neutral: 'neutral', density: 'normal', radius: 'soft', font: 'inter', mode: 'auto',
};

export interface Oklch { l: number; c: number; h: number }

/** Roles every theme defines, for both modes. */
export const ROLES = [
  'bg', 'surface', 'raised', 'border', 'border-strong', 'text', 'muted',
  'primary', 'primary-hover', 'on-primary', 'accent', 'on-accent',
  'danger', 'on-danger', 'success', 'warning', 'focus',
] as const;
export type Role = (typeof ROLES)[number];

/** Text/background pairs that must reach WCAG AA (4.5:1). */
export const CONTRAST_PAIRS: ReadonlyArray<[Role, Role]> = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'raised'],
  ['muted', 'bg'], ['muted', 'surface'],
  ['on-primary', 'primary'], ['on-primary', 'primary-hover'], ['on-accent', 'accent'], ['on-danger', 'danger'],
  ['danger', 'surface'], ['primary', 'surface'], ['success', 'surface'],
];

const NEUTRAL_HUE = { cool: 255, neutral: 0, warm: 70 } as const;
const NEUTRAL_CHROMA = { cool: 0.012, neutral: 0, warm: 0.01 } as const;

/** The palette for one mode. Lightness values are fixed; hues come from the theme. */
export function palette(t: ThemeParams, dark: boolean): Record<Role, Oklch> {
  const nh = t.neutral === 'neutral' ? t.base : NEUTRAL_HUE[t.neutral];
  const nc = t.neutral === 'neutral' ? 0.006 : NEUTRAL_CHROMA[t.neutral];
  const n = (l: number, scale = 1): Oklch => ({ l, c: nc * scale, h: nh });
  const hue = (l: number, c: number, h: number): Oklch => ({ l, c, h });
  if (!dark) {
    return {
      bg: n(0.975, 1.2),
      surface: n(1, 0),
      raised: n(1, 0),
      border: n(0.9, 1.5),
      'border-strong': n(0.8, 2),
      text: n(0.24, 3),
      muted: n(0.5, 3),
      primary: hue(0.5, 0.16, t.base),
      'primary-hover': hue(0.45, 0.15, t.base),
      'on-primary': n(1, 0),
      accent: hue(0.5, 0.15, t.accent),
      'on-accent': n(1, 0),
      danger: hue(0.52, 0.18, 25),
      'on-danger': n(1, 0),
      success: hue(0.52, 0.13, 150),
      warning: hue(0.78, 0.14, 75),
      focus: hue(0.62, 0.17, t.base),
    };
  }
  return {
    bg: n(0.16, 2),
    surface: n(0.2, 2),
    raised: n(0.23, 2),
    border: n(0.32, 2),
    'border-strong': n(0.42, 2),
    text: n(0.94, 1),
    muted: n(0.72, 2),
    primary: hue(0.74, 0.13, t.base),
    'primary-hover': hue(0.8, 0.11, t.base),
    'on-primary': n(0.18, 2),
    accent: hue(0.74, 0.13, t.accent),
    'on-accent': n(0.18, 2),
    danger: hue(0.72, 0.15, 25),
    'on-danger': n(0.18, 2),
    success: hue(0.74, 0.13, 150),
    warning: hue(0.8, 0.13, 75),
    focus: hue(0.72, 0.15, t.base),
  };
}

// --- color math --------------------------------------------------------------------

/** Linear sRGB of an OKLCH color, clamped to the gamut. */
export function toLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

export function luminance(c: Oklch): number {
  const [r, g, b] = toLinearRgb(c);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors. */
export function contrast(x: Oklch, y: Oklch): number {
  const a = luminance(x);
  const b = luminance(y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const css = (c: Oklch, alpha?: number): string =>
  `oklch(${(c.l * 100).toFixed(1)}% ${c.c.toFixed(3)} ${c.h.toFixed(1)}${alpha === undefined ? '' : ` / ${alpha}`})`;

// --- tokens ------------------------------------------------------------------------

const SPACE = [0, 4, 8, 12, 16, 24, 32, 48];
const DENSITY = { compact: 0.85, normal: 1, comfortable: 1.2 } as const;
const RADIUS = { sharp: 2, soft: 8, round: 16 } as const;
const FONTS: Record<string, string> = {
  inter: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

function colorVars(t: ThemeParams, dark: boolean): string {
  const p = palette(t, dark);
  const lines = ROLES.map(r => `  --tb-${r}: ${css(p[r])};`);
  lines.push(`  --tb-focus-ring: ${css(p.focus, dark ? 0.5 : 0.35)};`);
  lines.push(`  --tb-danger-soft: ${css(p.danger, dark ? 0.16 : 0.08)};`);
  lines.push(`  --tb-primary-soft: ${css(p.primary, dark ? 0.16 : 0.08)};`);
  const shadow = dark ? '0 0 0 1px oklch(100% 0 0 / 0.06)' : `0 1px 2px ${css(n0(p), 0.06)}`;
  lines.push(`  --tb-shadow-1: ${shadow}, 0 1px 3px ${css(n0(p), dark ? 0.4 : 0.08)};`);
  lines.push(`  --tb-shadow-2: ${shadow}, 0 4px 12px ${css(n0(p), dark ? 0.5 : 0.08)};`);
  lines.push(`  --tb-shadow-3: ${shadow}, 0 12px 32px ${css(n0(p), dark ? 0.6 : 0.12)};`);
  lines.push(`  color-scheme: ${dark ? 'dark' : 'light'};`);
  return lines.join('\n');
}

const n0 = (p: Record<Role, Oklch>): Oklch => ({ l: 0.2, c: p.text.c, h: p.text.h });

function sizeVars(t: ThemeParams): string {
  const k = DENSITY[t.density];
  const lines = SPACE.map((px, i) => `  --tb-space-${i}: ${Math.round(px * k)}px;`);
  const r = RADIUS[t.radius];
  lines.push(`  --tb-radius: ${r}px;`, `  --tb-radius-lg: ${Math.round(r * 1.5)}px;`);
  lines.push(`  --tb-control: ${Math.max(40, Math.round(44 * k))}px;`);
  lines.push(`  --tb-font: ${FONTS[t.font] ?? `"${t.font}", ${FONTS['system']}`};`);
  lines.push(`  --tb-mono: ${FONTS['mono']};`);
  lines.push('  --tb-ease: cubic-bezier(0.2, 0, 0, 1);', '  --tb-fast: 150ms;');
  return lines.join('\n');
}

/** The full stylesheet for a theme: tokens, then the fixed component rules. */
export function themeCss(t: ThemeParams): string {
  const light = colorVars(t, false);
  const dark = colorVars(t, true);
  let colors: string;
  if (t.mode === 'light') colors = `:root {\n${light}\n}`;
  else if (t.mode === 'dark') colors = `:root {\n${dark}\n}`;
  else colors = `:root {\n${light}\n}\n@media (prefers-color-scheme: dark) {\n:root {\n${dark}\n}\n}`;
  return `:root {\n${sizeVars(t)}\n}\n${colors}\n${COMPONENTS}`;
}

/** Component rules. Only token variables appear here, never raw values of color. */
const COMPONENTS = String.raw`
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background: var(--tb-bg);
  color: var(--tb-text);
  font-family: var(--tb-font);
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.tb-view {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--tb-space-7) var(--tb-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--tb-space-5);
}
.tb-view.tb-wide { max-width: 1120px; }
.tb-column { display: flex; flex-direction: column; gap: var(--tb-space-4); min-width: 0; }
.tb-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-3); }
.tb-row.tb-center { justify-content: center; }
.tb-row.tb-right { justify-content: flex-end; }
.tb-row.tb-spread { justify-content: space-between; }
.tb-fill { flex: 1 1 0; min-width: 0; }
.tb-grid { display: grid; gap: var(--tb-space-4); grid-template-columns: repeat(var(--tb-cols, 2), minmax(0, 1fr)); }
.tb-panel {
  background: var(--tb-raised);
  border: 1px solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-1);
  padding: var(--tb-space-6);
  display: flex;
  flex-direction: column;
  gap: var(--tb-space-5);
}
.tb-panel > .tb-panel-title { margin: 0; font-size: 17px; line-height: 1.35; font-weight: 600; letter-spacing: -0.01em; }
.tb-divider { border: 0; border-top: 1px solid var(--tb-border); margin: var(--tb-space-2) 0; width: 100%; }

.tb-title { margin: 0; font-size: 28px; line-height: 1.2; font-weight: 650; letter-spacing: -0.02em; }
.tb-heading { margin: 0; font-size: 20px; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em; }
.tb-text { margin: 0; }
.tb-small { font-size: 13px; }
.tb-muted { color: var(--tb-muted); }
.tb-text.tb-danger { color: var(--tb-danger); }
.tb-text.tb-success { color: var(--tb-success); }
.tb-text.tb-primary { color: var(--tb-primary); }

/* forms: labels and controls aligned in two columns */
.tb-form {
  display: grid;
  grid-template-columns: minmax(120px, max-content) minmax(0, 1fr);
  column-gap: var(--tb-space-5);
  row-gap: var(--tb-space-4);
  align-items: start;
}
.tb-form > * { grid-column: 1 / -1; }
.tb-form > .tb-field { display: contents; }
.tb-form > .tb-field > .tb-label { grid-column: 1; padding-top: calc((var(--tb-control) - 1.5em) / 2); }
.tb-form > .tb-field > .tb-control { grid-column: 2; }
.tb-form > .tb-actions, .tb-form > .tb-check-row { grid-column: 2; }
.tb-field { display: flex; flex-direction: column; gap: var(--tb-space-2); min-width: 0; }
.tb-control { display: flex; flex-direction: column; gap: var(--tb-space-1); min-width: 0; }
.tb-label { font-weight: 550; font-size: 14px; color: var(--tb-text); }
.tb-required::after { content: " *"; color: var(--tb-muted); font-weight: 400; }
.tb-input {
  font: inherit;
  color: var(--tb-text);
  background: var(--tb-surface);
  border: 1px solid var(--tb-border-strong);
  border-radius: var(--tb-radius);
  min-height: var(--tb-control);
  padding: 0 var(--tb-space-3);
  width: 100%;
  transition: border-color var(--tb-fast) var(--tb-ease), box-shadow var(--tb-fast) var(--tb-ease);
}
textarea.tb-input { padding: var(--tb-space-2) var(--tb-space-3); min-height: calc(var(--tb-control) * 2.5); resize: vertical; }
select.tb-input { appearance: none; background-image: linear-gradient(45deg, transparent 50%, var(--tb-muted) 50%), linear-gradient(135deg, var(--tb-muted) 50%, transparent 50%); background-position: calc(100% - 18px) 50%, calc(100% - 13px) 50%; background-size: 5px 5px; background-repeat: no-repeat; padding-right: var(--tb-space-6); }
.tb-input::placeholder { color: var(--tb-muted); opacity: 0.8; }
.tb-input:hover { border-color: var(--tb-muted); }
.tb-input:focus { outline: none; border-color: var(--tb-primary); box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-invalid .tb-input { border-color: var(--tb-danger); }
.tb-invalid .tb-input:focus { box-shadow: 0 0 0 3px var(--tb-danger-soft); }
.tb-error { color: var(--tb-danger); font-size: 13px; min-height: 0; }
.tb-error:empty { display: none; }
.tb-hint { color: var(--tb-muted); font-size: 13px; }
.tb-pending .tb-input { background-image: linear-gradient(90deg, transparent, var(--tb-primary-soft), transparent); background-size: 200% 100%; animation: tb-pending 1.2s linear infinite; }
@keyframes tb-pending { from { background-position: 200% 0; } to { background-position: -200% 0; } }

.tb-check-row { display: flex; }
.tb-check { display: inline-flex; align-items: center; gap: var(--tb-space-3); min-height: var(--tb-control); cursor: pointer; }
.tb-check input { width: 18px; height: 18px; margin: 0; accent-color: var(--tb-primary); cursor: pointer; }
.tb-check input:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); border-radius: 4px; }

.tb-actions { display: flex; flex-wrap: wrap; gap: var(--tb-space-3); padding-top: var(--tb-space-2); }
.tb-button {
  font: inherit;
  font-weight: 600;
  font-size: 14px;
  min-height: var(--tb-control);
  padding: 0 var(--tb-space-5);
  border-radius: var(--tb-radius);
  border: 1px solid var(--tb-border-strong);
  background: var(--tb-surface);
  color: var(--tb-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--tb-space-2);
  transition: background var(--tb-fast) var(--tb-ease), border-color var(--tb-fast) var(--tb-ease), box-shadow var(--tb-fast) var(--tb-ease), opacity var(--tb-fast) var(--tb-ease);
}
.tb-button:hover { background: var(--tb-bg); border-color: var(--tb-muted); }
.tb-button:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-button.tb-primary { background: var(--tb-primary); border-color: var(--tb-primary); color: var(--tb-on-primary); box-shadow: var(--tb-shadow-1); }
.tb-button.tb-primary:hover { background: var(--tb-primary-hover); border-color: var(--tb-primary-hover); }
.tb-button.tb-accent { background: var(--tb-accent); border-color: var(--tb-accent); color: var(--tb-on-accent); }
.tb-button.tb-danger { background: var(--tb-danger); border-color: var(--tb-danger); color: var(--tb-on-danger); }
.tb-button:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.tb-link { color: var(--tb-primary); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }

.tb-hidden { display: none !important; }

@media (max-width: 640px) {
  .tb-view { padding: var(--tb-space-5) var(--tb-space-4); }
  .tb-form { grid-template-columns: minmax(0, 1fr); }
  .tb-form > .tb-field { display: flex; }
  .tb-form > .tb-field > .tb-label, .tb-form > .tb-field > .tb-control,
  .tb-form > .tb-actions, .tb-form > .tb-check-row { grid-column: 1; padding-top: 0; }
  .tb-row { flex-direction: column; align-items: stretch; }
  .tb-grid { grid-template-columns: minmax(0, 1fr); }
  .tb-actions > .tb-button { flex: 1 1 auto; }
}
@media (pointer: coarse) { :root { --tb-control: 44px; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;
