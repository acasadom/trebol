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
  lines.push(`  --tb-overlay: ${css(n0(p), dark ? 0.6 : 0.4)};`);
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
.tb-view:has(> .tb-split) { max-width: 1120px; }
.tb-column { display: flex; flex-direction: column; gap: var(--tb-space-4); min-width: 0; }
.tb-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-3); }
.tb-row:has(> .tb-field) { align-items: flex-end; }
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
.tb-check input[type="radio"]:focus-visible { border-radius: 50%; }
.tb-radios { display: flex; flex-wrap: wrap; column-gap: var(--tb-space-5); }
.tb-switch input {
  appearance: none;
  width: 36px;
  height: 20px;
  flex: none;
  border-radius: 10px;
  background: var(--tb-muted);
  position: relative;
  transition: background var(--tb-fast) var(--tb-ease);
}
.tb-switch input::before {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--tb-surface);
  box-shadow: var(--tb-shadow-1);
  transition: transform var(--tb-fast) var(--tb-ease);
}
.tb-switch input:checked { background: var(--tb-primary); }
.tb-switch input:checked::before { transform: translateX(16px); }
.tb-switch input:focus-visible { border-radius: 10px; }
.tb-check input:disabled, .tb-check input:disabled + span { opacity: 0.45; cursor: not-allowed; }

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
.tb-button:disabled, .tb-button[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.tb-button.tb-primary[aria-disabled="true"]:hover { background: var(--tb-primary); border-color: var(--tb-primary); }
.tb-button.tb-has-icon:not(:has(> span:not(:empty))) { padding: 0; width: var(--tb-control); }

.tb-icon { width: 1.25em; height: 1.25em; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.tb-button .tb-icon { width: 18px; height: 18px; }
.tb-icon-face { display: inline-flex; align-self: flex-start; color: var(--tb-text); }
.tb-icon-face .tb-icon { width: 24px; height: 24px; }
.tb-icon-face.tb-small .tb-icon { width: 18px; height: 18px; }
.tb-icon-face.tb-large .tb-icon { width: 32px; height: 32px; }
.tb-icon-face.tb-muted { color: var(--tb-muted); }
.tb-icon-face.tb-primary { color: var(--tb-primary); }
.tb-icon-face.tb-accent { color: var(--tb-accent); }
.tb-icon-face.tb-danger { color: var(--tb-danger); }
.tb-icon-face.tb-success { color: var(--tb-success); }
.tb-icon-face.tb-warning { color: var(--tb-warning); }
.tb-input-icon { position: relative; display: flex; }
.tb-input-icon > .tb-icon { position: absolute; left: var(--tb-space-3); top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: var(--tb-muted); pointer-events: none; }
.tb-input-icon > .tb-input { padding-left: calc(var(--tb-space-3) + 26px); }
.tb-tree-wrap { min-width: 0; }
.tb-tree, .tb-tree ul { list-style: none; margin: 0; padding: 0; }
.tb-tree li { outline: none; }
.tb-tree-row {
  display: flex;
  align-items: center;
  gap: var(--tb-space-1);
  min-height: calc(var(--tb-control) - 8px);
  padding: 0 var(--tb-space-2) 0 calc(var(--tb-level, 0) * 20px + var(--tb-space-1));
  border-radius: var(--tb-radius);
  cursor: pointer;
  user-select: none;
  transition: background var(--tb-fast) var(--tb-ease);
}
.tb-tree-row:hover { background: var(--tb-bg); }
.tb-tree li:focus-visible > .tb-tree-row { box-shadow: inset 0 0 0 2px var(--tb-focus); }
.tb-tree li.tb-selected > .tb-tree-row { background: var(--tb-primary-soft); font-weight: 550; }
.tb-tree-toggle { display: inline-flex; flex: none; width: 20px; height: 20px; align-items: center; justify-content: center; color: var(--tb-muted); border-radius: var(--tb-radius); }
.tb-tree-toggle .tb-icon { width: 16px; height: 16px; transition: transform var(--tb-fast) var(--tb-ease); }
.tb-tree li:not([aria-expanded]) > .tb-tree-row > .tb-tree-toggle { visibility: hidden; }
.tb-tree li[aria-expanded="true"] > .tb-tree-row > .tb-tree-toggle .tb-icon { transform: rotate(90deg); }
.tb-tree-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tb-tree-row.tb-drop-over { box-shadow: inset 0 0 0 2px var(--tb-primary); }

.tb-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--tb-space-1);
  padding: var(--tb-space-1);
  background: var(--tb-surface);
  border: 1px solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
}
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger) { border-color: transparent; background: transparent; }
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger):hover { background: var(--tb-bg); }
.tb-toolbar > .tb-button { padding: 0 var(--tb-space-3); }
.tb-toolbar > .tb-divider { width: 0; height: calc(var(--tb-control) - 12px); margin: 0 var(--tb-space-1); border-top: 0; border-left: 1px solid var(--tb-border); }

.tb-breadcrumb ol { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-1); margin: 0; padding: 0; list-style: none; font-size: 14px; }
.tb-breadcrumb li { display: inline-flex; align-items: center; gap: var(--tb-space-1); min-width: 0; }
.tb-breadcrumb li + li::before { content: "›" / ""; color: var(--tb-muted); padding: 0 var(--tb-space-1); }
.tb-crumb { font: inherit; color: var(--tb-muted); background: none; border: 0; padding: var(--tb-space-1); border-radius: var(--tb-radius); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 24ch; }
button.tb-crumb { cursor: pointer; }
button.tb-crumb:hover { color: var(--tb-text); text-decoration: underline; text-underline-offset: 3px; }
button.tb-crumb:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-crumb[aria-current] { color: var(--tb-text); font-weight: 600; }
.tb-crumb-more { display: none !important; }

.tb-link { display: inline-flex; align-items: center; gap: var(--tb-space-1); color: var(--tb-primary); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }

.tb-hidden { display: none !important; }
@media (min-width: 641px) { .tb-narrow-only { display: none !important; } }

.tb-scroll {
  display: flex;
  flex-direction: column;
  gap: var(--tb-space-4);
  min-width: 0;
  max-height: 400px;
  overflow: auto;
  overscroll-behavior: contain;
  padding: var(--tb-space-3);
  border: 1px solid var(--tb-border);
  border-radius: var(--tb-radius);
}
.tb-scroll.tb-small { max-height: 240px; font-size: inherit; }
.tb-scroll.tb-large { max-height: 640px; }
.tb-scroll:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }

.tb-image { display: block; max-width: 100%; height: auto; border-radius: var(--tb-radius); }
.tb-image.tb-small { width: 96px; }
.tb-image.tb-medium { width: 240px; }
.tb-image.tb-large { width: 480px; }
.tb-image.tb-fill { width: 100%; }

.tb-progress-wrap { display: flex; flex-direction: column; gap: var(--tb-space-2); min-width: 0; }
.tb-progress-label { font-size: 14px; font-weight: 550; }
.tb-progress-label[hidden] { display: none; }
.tb-progress { height: 8px; border-radius: 4px; background: var(--tb-border); overflow: hidden; }
.tb-progress-bar { height: 100%; width: 0; border-radius: inherit; background: var(--tb-primary); transition: width 300ms var(--tb-ease); }
.tb-success .tb-progress-bar { background: var(--tb-success); }
.tb-warning .tb-progress-bar { background: var(--tb-warning); }
.tb-danger .tb-progress-bar { background: var(--tb-danger); }
.tb-accent .tb-progress-bar { background: var(--tb-accent); }
.tb-indeterminate .tb-progress-bar { width: 35%; animation: tb-indeterminate 1.4s var(--tb-ease) infinite; }
@keyframes tb-indeterminate { from { transform: translateX(-100%); } to { transform: translateX(290%); } }

/* tables: rows become cards on narrow screens */
.tb-table-wrap, .tb-list-wrap { min-width: 0; }
.tb-table-wrap {
  overflow-x: auto;
  background: var(--tb-surface);
  border: 1px solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-1);
}
.tb-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.tb-table th {
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-muted);
  white-space: nowrap;
  padding: var(--tb-space-3) var(--tb-space-4);
  background: var(--tb-bg);
  border-bottom: 1px solid var(--tb-border);
}
.tb-table td { padding: var(--tb-space-3) var(--tb-space-4); border-bottom: 1px solid var(--tb-border); height: var(--tb-control); }
.tb-table tbody tr:last-child td { border-bottom: 0; }
.tb-table .tb-num { text-align: right; font-variant-numeric: tabular-nums; }
.tb-table-wrap:has(tbody:empty) thead { display: none; }
.tb-selectable tbody tr, .tb-selectable .tb-list > li { cursor: pointer; transition: background var(--tb-fast) var(--tb-ease); }
.tb-selectable tbody tr:hover, .tb-selectable .tb-list > li:hover { background: var(--tb-bg); }
.tb-selectable tbody tr:focus-visible, .tb-selectable .tb-list > li:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--tb-focus); }
.tb-table tr.tb-selected, .tb-list > li.tb-selected { background: var(--tb-primary-soft); }
.tb-empty { margin: 0; padding: var(--tb-space-6) var(--tb-space-4); text-align: center; color: var(--tb-muted); }
.tb-empty[hidden] { display: none; }

.tb-list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--tb-surface);
  border: 1px solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-1);
  overflow: hidden;
}
.tb-list:empty { display: none; }
.tb-list > li {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-height: var(--tb-control);
  padding: var(--tb-space-3) var(--tb-space-4);
  border-bottom: 1px solid var(--tb-border);
}
.tb-list > li:last-child { border-bottom: 0; }
.tb-list-primary { font-weight: 550; }
.tb-list-secondary { color: var(--tb-muted); font-size: 13px; }
.tb-list-secondary:empty { display: none; }

/* dialogs: centered window, full screen when narrow */
.tb-dialog {
  border: 0;
  padding: 0;
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  background: var(--tb-raised);
  color: var(--tb-text);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-3);
}
.tb-dialog[open] { display: flex; flex-direction: column; animation: tb-rise 180ms var(--tb-ease); }
.tb-dialog::backdrop { background: var(--tb-overlay); }
.tb-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tb-space-3);
  padding: var(--tb-space-4) var(--tb-space-4) 0 var(--tb-space-6);
}
.tb-dialog-title { margin: 0; font-size: 17px; line-height: 1.35; font-weight: 600; letter-spacing: -0.01em; }
.tb-dialog-close {
  font: inherit;
  font-size: 22px;
  line-height: 1;
  width: var(--tb-control);
  height: var(--tb-control);
  flex: none;
  border: 0;
  border-radius: var(--tb-radius);
  background: transparent;
  color: var(--tb-muted);
  cursor: pointer;
}
.tb-dialog-close:hover { background: var(--tb-bg); color: var(--tb-text); }
.tb-dialog-close:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-dialog-body {
  display: flex;
  flex-direction: column;
  gap: var(--tb-space-4);
  padding: var(--tb-space-4) var(--tb-space-6) var(--tb-space-6);
  overflow: auto;
}
@keyframes tb-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* tabs */
.tb-tabs { display: flex; flex-direction: column; gap: var(--tb-space-5); min-width: 0; }
.tb-tablist { display: flex; gap: var(--tb-space-1); box-shadow: inset 0 -1px 0 var(--tb-border); overflow-x: auto; scrollbar-width: none; }
.tb-tab {
  font: inherit;
  font-size: 14px;
  font-weight: 550;
  min-height: var(--tb-control);
  padding: 0 var(--tb-space-4);
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--tb-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--tb-fast) var(--tb-ease), border-color var(--tb-fast) var(--tb-ease);
}
.tb-tab:hover { color: var(--tb-text); }
.tb-tab[aria-selected="true"] { color: var(--tb-primary); border-bottom-color: var(--tb-primary); }
.tb-tab:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--tb-focus-ring); border-radius: var(--tb-radius) var(--tb-radius) 0 0; }
.tb-tab-panel { display: flex; flex-direction: column; gap: var(--tb-space-4); min-width: 0; }
.tb-tab-panel[hidden] { display: none; }

/* split: two panes and a handle; one pane at a time when narrow */
.tb-split { display: grid; grid-template-columns: minmax(0, var(--tb-split, 40%)) auto minmax(0, 1fr); align-items: start; }
.tb-split-pane { display: flex; flex-direction: column; gap: var(--tb-space-4); min-width: 0; }
.tb-split-pane:focus { outline: none; }
.tb-split-handle {
  align-self: stretch;
  width: var(--tb-space-5);
  cursor: col-resize;
  touch-action: none;
  display: flex;
  justify-content: center;
  border-radius: var(--tb-radius);
}
.tb-split-handle::before { content: ""; width: 1px; background: var(--tb-border); transition: background var(--tb-fast) var(--tb-ease), width var(--tb-fast) var(--tb-ease); }
.tb-split-handle:hover::before { width: 3px; background: var(--tb-border-strong); }
.tb-split-handle:focus-visible { outline: none; }
.tb-split-handle:focus-visible::before { width: 3px; background: var(--tb-focus); }
.tb-split-back { display: none; }

/* menus: in the top layer, placed by the host */
.tb-menu {
  position: fixed;
  inset: auto;
  margin: 0;
  min-width: 180px;
  max-width: min(320px, calc(100vw - 16px));
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  padding: var(--tb-space-1);
  background: var(--tb-raised);
  color: var(--tb-text);
  border: 1px solid var(--tb-border);
  border-radius: var(--tb-radius);
  box-shadow: var(--tb-shadow-3);
  animation: tb-pop 120ms var(--tb-ease);
}
.tb-menu-item {
  display: flex;
  align-items: center;
  gap: var(--tb-space-3);
  width: 100%;
  min-height: 36px;
  padding: 0 var(--tb-space-3);
  border: 0;
  border-radius: calc(var(--tb-radius) - 2px);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.tb-menu-item > span:not(.tb-menu-gap) { flex: 1; }
.tb-menu-item svg { width: 16px; height: 16px; flex: none; color: var(--tb-muted); }
.tb-menu-gap { width: 16px; flex: none; }
.tb-menu-item:focus { outline: none; background: var(--tb-primary-soft); }
.tb-menu-item[aria-expanded="true"] { background: var(--tb-bg); }
.tb-menu-divider { height: 1px; margin: var(--tb-space-1) calc(-1 * var(--tb-space-1)); background: var(--tb-border); }
@keyframes tb-pop { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }

/* drag and drop */
.tb-drag-active, .tb-drag-active * { user-select: none; cursor: grabbing !important; }
.tb-dragging { opacity: 0.4; }
.tb-drop-zone { min-height: var(--tb-control); }
.tb-drop-over { outline: 2px dashed var(--tb-focus-ring); outline-offset: 4px; border-radius: var(--tb-radius); }
.tb-drop-line {
  position: fixed;
  height: 2px;
  border-radius: 1px;
  background: var(--tb-primary);
  pointer-events: none;
  z-index: 2147483647;
}
.tb-drop-line.tb-across { width: 2px; }
.tb-drag-ghost {
  position: fixed;
  left: 0;
  top: 0;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: var(--tb-space-2) var(--tb-space-3);
  background: var(--tb-raised);
  color: var(--tb-text);
  border: 1px solid var(--tb-border);
  border-radius: var(--tb-radius);
  box-shadow: var(--tb-shadow-3);
  font-size: 14px;
  font-weight: 500;
  pointer-events: none;
  z-index: 2147483647;
}

/* toasts */
.tb-toasts {
  position: fixed;
  inset: auto 0 var(--tb-space-5) 0;
  margin: 0 auto;
  width: max-content;
  max-width: calc(100vw - 32px);
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--tb-space-2);
}
.tb-toast {
  display: flex;
  align-items: center;
  gap: var(--tb-space-3);
  padding: var(--tb-space-3) var(--tb-space-5);
  min-height: var(--tb-control);
  background: var(--tb-text);
  color: var(--tb-bg);
  border-radius: var(--tb-radius);
  box-shadow: var(--tb-shadow-3);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  animation: tb-rise 180ms var(--tb-ease);
}
.tb-toast.tb-success::before, .tb-toast.tb-warning::before, .tb-toast.tb-primary::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
  background: var(--tb-primary);
}
.tb-toast.tb-success::before { background: var(--tb-success); }
.tb-toast.tb-warning::before { background: var(--tb-warning); }
.tb-toast.tb-danger { background: var(--tb-danger); color: var(--tb-on-danger); }

@media (max-width: 640px) {
  .tb-wide-only { display: none !important; }
  .tb-split { display: block; }
  .tb-split-handle { display: none; }
  .tb-split[data-pane="1"] > .tb-split-pane:last-child, .tb-split[data-pane="2"] > .tb-split-pane:first-child { display: none; }
  .tb-split-back { display: inline-flex; align-self: flex-start; padding: 0 var(--tb-space-3); border: 0; background: transparent; color: var(--tb-primary); }
  .tb-view { padding: var(--tb-space-5) var(--tb-space-4); }
  .tb-form { grid-template-columns: minmax(0, 1fr); }
  .tb-form > .tb-field { display: flex; }
  .tb-form > .tb-field > .tb-label, .tb-form > .tb-field > .tb-control,
  .tb-form > .tb-actions, .tb-form > .tb-check-row { grid-column: 1; padding-top: 0; }
  .tb-row:has(> .tb-field) { flex-direction: column; align-items: stretch; }
  .tb-grid { grid-template-columns: minmax(0, 1fr); }
  .tb-actions > .tb-button { flex: 1 1 auto; }
  .tb-table-wrap { overflow: visible; background: none; border: 0; box-shadow: none; }
  .tb-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .tb-table, .tb-table tbody, .tb-table tr, .tb-table td { display: block; }
  .tb-table tbody { display: flex; flex-direction: column; gap: var(--tb-space-3); }
  .tb-table tr {
    padding: var(--tb-space-3) var(--tb-space-4);
    background: var(--tb-surface);
    border: 1px solid var(--tb-border);
    border-radius: var(--tb-radius-lg);
    box-shadow: var(--tb-shadow-1);
  }
  .tb-table td, .tb-table tbody tr:last-child td {
    display: flex;
    justify-content: space-between;
    gap: var(--tb-space-4);
    height: auto;
    padding: var(--tb-space-1) 0;
    border: 0;
    text-align: right;
  }
  .tb-table td::before { content: attr(data-label); color: var(--tb-muted); font-weight: 500; text-align: left; }
  .tb-toolbar > .tb-button.tb-has-icon { padding: 0; width: var(--tb-control); }
  .tb-toolbar > .tb-button.tb-has-icon > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .tb-crumb-middle { display: none !important; }
  .tb-crumb-more { display: inline-flex !important; }
  .tb-dialog { width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; margin: 0; border-radius: 0; }
}
@media (pointer: coarse) { :root { --tb-control: 44px; } }
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
  .tb-indeterminate .tb-progress-bar { width: 100%; opacity: 0.35; }
}
`;
