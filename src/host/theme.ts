// The theme: a handful of parameters from which every visual value is
// derived, compiled once into CSS custom properties plus a fixed stylesheet.
//
// Colors are computed in OKLCH. Each role has a fixed lightness per mode,
// chosen so text meets WCAG AA on the backgrounds it is used on; the hue
// comes from the theme (`base`, `accent`, `neutral`). `contrast()` checks it
// and the tests run it over every hue.

import { DRAW_COLORS } from './draw.ts';

/** modern: today's flat controls; classic recalls Rebol/View, cupertino the Mac, fusion Qt, fluent Windows 11. */
export type Skin = 'modern' | 'classic' | 'cupertino' | 'fusion' | 'fluent';

export interface ThemeParams {
  /** Hue of the primary color, 0-360. */
  base: number;
  /** Hue of the accent color, 0-360. */
  accent: number;
  neutral: 'cool' | 'neutral' | 'warm';
  density: 'compact' | 'normal' | 'comfortable';
  radius: 'sharp' | 'soft' | 'round';
  font: string;
  /** Font of titles and headings; the same as `font` if it is not given. */
  headings: string | null;
  mode: 'light' | 'dark' | 'auto';
  /** How much color the primary and accent have, 0-1; 0 is black and white. */
  color: number;
  /** Thickness of borders, in px. */
  line: 1 | 2;
  /** Whether panels and buttons cast a shadow. */
  depth: 'flat' | 'soft' | 'lifted';
  /** How the same icons are drawn. */
  icons: 'fine' | 'round' | 'sharp' | 'bold';
  /** How the controls are built: see SKINS. */
  skin: Skin;
}

export const DEFAULT_THEME: ThemeParams = {
  base: 250, accent: 30, neutral: 'neutral', density: 'normal', radius: 'soft', font: 'inter', headings: null, mode: 'auto',
  color: 1, line: 1, depth: 'soft', icons: 'round', skin: 'modern',
};

/** The theme parameters that take a word, and the words each takes. */
export const THEME_WORDS: Record<string, readonly string[]> = {
  neutral: ['cool', 'neutral', 'warm'],
  density: ['compact', 'normal', 'comfortable'],
  radius: ['sharp', 'soft', 'round'],
  mode: ['light', 'dark', 'auto'],
  depth: ['flat', 'soft', 'lifted'],
  icons: ['fine', 'round', 'sharp', 'bold'],
  skin: ['modern', 'classic', 'cupertino', 'fusion', 'fluent'],
};

/** The looks: complete sets of parameters with a name. `theme [look: civic base: 200]` starts from one. */
export const LOOKS: Record<string, Partial<ThemeParams>> = {
  minimal: {},
  paper: { base: 40, accent: 150, neutral: 'warm', headings: 'serif', radius: 'sharp', depth: 'flat', icons: 'fine' },
  civic: { base: 255, accent: 75, neutral: 'cool', font: 'system', radius: 'sharp', line: 2, depth: 'flat', icons: 'sharp' },
  soft: { base: 175, accent: 30, density: 'comfortable', radius: 'round', depth: 'lifted', icons: 'round' },
  ink: { color: 0, font: 'system', headings: 'mono', radius: 'sharp', line: 2, depth: 'flat', icons: 'bold' },
  classic: { base: 240, accent: 45, color: 0.7, font: 'sans', density: 'compact', radius: 'sharp', depth: 'flat', icons: 'sharp', skin: 'classic' },
  cupertino: { base: 255, accent: 330, font: 'system', radius: 'soft', depth: 'soft', icons: 'round', skin: 'cupertino' },
  fusion: { base: 240, accent: 30, color: 0.8, font: 'noto', radius: 'sharp', depth: 'flat', icons: 'sharp', skin: 'fusion' },
  fluent: { base: 250, accent: 25, font: 'segoe', radius: 'soft', depth: 'soft', icons: 'fine', skin: 'fluent' },
};

/** Skins whose greys take a hint of the base hue; the others are plain grey. */
const TINTED: ReadonlySet<Skin> = new Set(['fluent']);

/** Lightness of the neutral roles, and of the primary, for the skins that change them: [light, dark]. */
const TONES: Partial<Record<Skin, Record<'bg' | 'surface' | 'raised' | 'border' | 'border-strong' | 'muted' | 'primary', [number, number]>>> = {
  // a light window, group boxes a shade darker, controls lighter than the window in the dark
  cupertino: { bg: [0.945, 0.23], surface: [1, 0.29], raised: [0.925, 0.26], border: [0.86, 0.37], 'border-strong': [0.76, 0.45], muted: [0.48, 0.74], primary: [0.52, 0.7] },
  // group boxes are the window itself; in the dark, wells are darker and frames darker still
  fusion: { bg: [0.95, 0.31], surface: [1, 0.25], raised: [0.95, 0.31], border: [0.84, 0.24], 'border-strong': [0.7, 0.2], muted: [0.46, 0.76], primary: [0.5, 0.72] },
  // a calm window under white layers
  fluent: { bg: [0.955, 0.2], surface: [0.995, 0.27], raised: [0.985, 0.24], border: [0.9, 0.33], 'border-strong': [0.78, 0.42], muted: [0.47, 0.74], primary: [0.48, 0.78] },
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
  const p = basePalette(t, dark);
  const tones = TONES[t.skin];
  if (tones === undefined) return p;
  const i = dark ? 1 : 0;
  for (const role of ['bg', 'surface', 'raised', 'border', 'border-strong', 'muted'] as const) {
    const l = tones[role][i];
    p[role] = { l, c: l >= 0.99 || !TINTED.has(t.skin) ? 0 : p.bg.c, h: p.bg.h };
  }
  p.primary = { ...p.primary, l: tones.primary[i] };
  p['primary-hover'] = { ...p['primary-hover'], l: tones.primary[i] + (dark ? 0.05 : -0.05) };
  return p;
}

function basePalette(t: ThemeParams, dark: boolean): Record<Role, Oklch> {
  const nh = t.neutral === 'neutral' ? t.base : NEUTRAL_HUE[t.neutral];
  const nc = (t.neutral === 'neutral' ? 0.006 : NEUTRAL_CHROMA[t.neutral]) * t.color;
  // with no color, what stands out does so by being as dark or as light as the text
  const ink = t.color === 0;
  const n = (l: number, scale = 1): Oklch => ({ l, c: nc * scale, h: nh });
  // what warns or confirms keeps its color in every look
  const signal = (l: number, c: number, h: number): Oklch => ({ l, c, h });
  const hue = (l: number, c: number, h: number): Oklch => ({ l, c: c * t.color, h });
  // classic: a grey window (panels too: their edges set them apart), white wells for what is typed
  if (t.skin === 'classic') return {
    bg: n(dark ? 0.33 : 0.85, 2),
    surface: n(dark ? 0.25 : 1, dark ? 2 : 0),
    raised: n(dark ? 0.33 : 0.85, 2),
    border: n(dark ? 0.22 : 0.7, 2),
    'border-strong': n(dark ? 0.18 : 0.52, 2),
    text: n(dark ? 0.95 : 0.18, dark ? 1 : 3),
    muted: n(dark ? 0.8 : 0.38, 3),
    primary: hue(dark ? 0.8 : 0.45, 0.12, t.base),
    'primary-hover': hue(dark ? 0.85 : 0.4, 0.12, t.base),
    'on-primary': n(dark ? 0.18 : 1, dark ? 2 : 0),
    accent: hue(dark ? 0.8 : 0.48, 0.13, t.accent),
    'on-accent': n(dark ? 0.18 : 1, dark ? 2 : 0),
    danger: signal(dark ? 0.75 : 0.5, dark ? 0.15 : 0.18, 25),
    'on-danger': n(dark ? 0.18 : 1, dark ? 2 : 0),
    success: signal(dark ? 0.76 : 0.48, 0.13, 150),
    warning: signal(dark ? 0.8 : 0.78, 0.14, 75),
    focus: hue(dark ? 0.75 : 0.5, 0.15, t.base),
  };
  if (!dark) {
    return {
      bg: n(0.975, 1.2),
      surface: n(1, 0),
      raised: n(1, 0),
      border: n(0.9, 1.5),
      'border-strong': n(0.8, 2),
      text: n(0.24, 3),
      muted: n(0.5, 3),
      primary: hue(ink ? 0.24 : 0.5, 0.16, t.base),
      'primary-hover': hue(ink ? 0.36 : 0.45, 0.15, t.base),
      'on-primary': n(1, 0),
      accent: hue(0.5, 0.15, t.accent),
      'on-accent': n(1, 0),
      danger: signal(0.52, 0.18, 25),
      'on-danger': n(1, 0),
      success: signal(0.52, 0.13, 150),
      warning: signal(0.78, 0.14, 75),
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
    primary: hue(ink ? 0.94 : 0.74, 0.13, t.base),
    'primary-hover': hue(ink ? 0.84 : 0.8, 0.11, t.base),
    'on-primary': n(0.18, 2),
    accent: hue(0.74, 0.13, t.accent),
    'on-accent': n(0.18, 2),
    danger: signal(0.72, 0.15, 25),
    'on-danger': n(0.18, 2),
    success: signal(0.74, 0.13, 150),
    warning: signal(0.8, 0.13, 75),
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

const encode = (x: number): number => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const decode = (x: number): number => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

/** Luminance of `c` at `alpha` over a pixel of gray `px` (0 black, 1 white), blended as browsers do. */
export function luminanceOver(c: Oklch, alpha: number, px: number): number {
  const [r, g, b] = toLinearRgb(c).map(x => decode(alpha * encode(x) + (1 - alpha) * px)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The worst contrast of `fg` on the background at `alpha` over any image: a black or a white one. */
export function contrastOverImage(fg: Oklch, bg: Oklch, alpha: number): number {
  const t = luminance(fg);
  return Math.min(...[0, 1].map(px => {
    const b = luminanceOver(bg, alpha, px);
    return (Math.max(t, b) + 0.05) / (Math.min(t, b) + 0.05);
  }));
}

/**
 * The alpha of the veil over a backdrop: the least that keeps text AA on any image. Muted text would
 * need a veil almost opaque, so on a backdrop it takes the color of the text.
 */
export function scrimAlpha(p: Record<Role, Oklch>): number {
  let alpha = 0.5;
  while (alpha < 1 && contrastOverImage(p.text, p.bg, alpha) < 4.6) alpha = Math.round((alpha + 0.01) * 100) / 100;
  return alpha;
}

const css = (c: Oklch, alpha?: number): string =>
  `oklch(${(c.l * 100).toFixed(1)}% ${c.c.toFixed(3)} ${c.h.toFixed(1)}${alpha === undefined ? '' : ` / ${alpha}`})`;

// --- tokens ------------------------------------------------------------------------

const SPACE = [0, 4, 8, 12, 16, 24, 32, 48];
const CONTROL: Partial<Record<Skin, number>> = { classic: 34, cupertino: 30, fusion: 30, fluent: 32 };
const DENSITY = { compact: 0.85, normal: 1, comfortable: 1.2 } as const;
const RADIUS = { sharp: 2, soft: 8, round: 16 } as const;
const ICONS = {
  fine: { stroke: 1.5, cap: 'round', join: 'round' },
  round: { stroke: 2, cap: 'round', join: 'round' },
  sharp: { stroke: 2, cap: 'square', join: 'miter' },
  bold: { stroke: 2.75, cap: 'butt', join: 'miter' },
} as const;
const FONTS: Record<string, string> = {
  inter: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  noto: '"Noto Sans", "DejaVu Sans", Ubuntu, Cantarell, "Segoe UI", Roboto, sans-serif',
  segoe: '"Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
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
  lines.push(`  --tb-scrim: ${css(p.bg, scrimAlpha(p))};`);
  const shadow = dark ? '0 0 0 1px oklch(100% 0 0 / 0.06)' : `0 1px 2px ${css(n0(p), 0.06)}`;
  const k = t.depth === 'lifted' ? 2 : 1;
  // a flat look has no shadows, but what floats over the page still needs one
  lines.push(`  --tb-shadow-1: ${t.depth === 'flat' ? 'none' : `${shadow}, 0 ${k}px ${3 * k}px ${css(n0(p), dark ? 0.4 : 0.08)}`};`);
  lines.push(`  --tb-shadow-2: ${t.depth === 'flat' ? 'none' : `${shadow}, 0 ${4 * k}px ${12 * k}px ${css(n0(p), dark ? 0.5 : 0.08)}`};`);
  lines.push(`  --tb-shadow-3: ${shadow}, 0 ${12 * k}px ${32 * k}px ${css(n0(p), dark ? 0.6 : 0.12)};`);
  const g = (l: number): string => css({ l, c: p.bg.c, h: p.bg.h });
  if (t.skin === 'classic') {
    // the two edges of what stands out or sinks in, and the faces of buttons and bars
    lines.push(`  --tb-bevel-hi: ${g(dark ? 0.5 : 1)};`, `  --tb-bevel-lo: ${g(dark ? 0.15 : 0.55)};`);
    lines.push(`  --tb-face-hi: ${g(dark ? 0.47 : 0.97)};`, `  --tb-face-lo: ${g(dark ? 0.36 : 0.8)};`);
  }
  // the chosen segment of a segmented control
  if (t.skin === 'cupertino') lines.push(`  --tb-segment: ${g(dark ? 0.47 : 1)};`);
  if (t.skin === 'fusion') lines.push(`  --tb-face-hi: ${g(dark ? 0.37 : 0.99)};`, `  --tb-face-lo: ${g(dark ? 0.32 : 0.91)};`);
  // focus is drawn in the color of the text, and what is hovered or chosen is a shade of it
  if (t.skin === 'fluent') lines.push(`  --tb-focus-ring: ${css(p.text)};`, `  --tb-subtle: ${css(p.text, dark ? 0.08 : 0.06)};`);
  // Red's color words, for drawings and charts: each one light enough, or dark enough, for this mode
  for (const [name, c] of Object.entries(DRAW_COLORS)) lines.push(`  --tb-c-${name}: ${css({ l: dark ? c.dark : c.light, c: c.c, h: c.h })};`);
  lines.push(`  color-scheme: ${dark ? 'dark' : 'light'};`);
  return lines.join('\n');
}

const n0 = (p: Record<Role, Oklch>): Oklch => ({ l: 0.2, c: p.text.c, h: p.text.h });

function sizeVars(t: ThemeParams): string {
  const k = DENSITY[t.density];
  const lines = SPACE.map((px, i) => `  --tb-space-${i}: ${Math.round(px * k)}px;`);
  const r = RADIUS[t.radius];
  lines.push(`  --tb-radius: ${r}px;`, `  --tb-radius-lg: ${Math.round(r * 1.5)}px;`);
  // a skin's controls are small, as on a desktop; a touch screen still gets 44px (below)
  const control = CONTROL[t.skin];
  lines.push(`  --tb-control: ${control !== undefined ? Math.round(control * k) : Math.max(40, Math.round(44 * k))}px;`);
  lines.push(`  --tb-font: ${FONTS[t.font] ?? `"${t.font}", ${FONTS['system']}`};`);
  lines.push(`  --tb-headings: ${t.headings === null ? 'var(--tb-font)' : FONTS[t.headings] ?? `"${t.headings}", ${FONTS['system']}`};`);
  lines.push(`  --tb-mono: ${FONTS['mono']};`);
  lines.push(`  --tb-line: ${t.line}px;`);
  const icon = ICONS[t.icons];
  lines.push(`  --tb-icon-stroke: ${icon.stroke};`, `  --tb-icon-cap: ${icon.cap};`, `  --tb-icon-join: ${icon.join};`);
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
  // an embedding page (the documentation's live examples) may force one: <html data-tb-scheme="dark">
  else colors = `:root {\n${light}\n}\n@media (prefers-color-scheme: dark) {\n:root:not([data-tb-scheme="light"]) {\n${dark}\n}\n}\n:root[data-tb-scheme="dark"] {\n${dark}\n}`;
  return `:root {\n${sizeVars(t)}\n}\n${colors}\n${COMPONENTS}${SKINS[t.skin]}`;
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
  font-variant-numeric: tabular-nums;
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
.tb-view.tb-small { max-width: 480px; font-size: inherit; }
.tb-view.tb-large { max-width: 1120px; }
.tb-view.tb-fill { max-width: none; }
.tb-column { display: flex; flex-direction: column; gap: var(--tb-space-4); min-width: 0; }
.tb-screens, .tb-screen { display: flex; flex-direction: column; gap: var(--tb-space-4); min-width: 0; }
.tb-screen:focus { outline: none; }
/* entering a screen focuses its title for screen readers; it is not a control, so no ring */
.tb-screen :is(h1, h2)[tabindex="-1"]:focus { outline: none; }
.tb-screens[aria-busy] { cursor: progress; }
.tb-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-3); }
.tb-row:where(:not(.tb-top, .tb-middle, .tb-bottom)):has(> .tb-field) { align-items: flex-end; }
/* with fields, a text beside them sits on the line of the controls, not on their labels */
.tb-row:where(:not(.tb-top, .tb-middle, .tb-bottom)):has(> .tb-field) > :is(.tb-text, .tb-heading) { margin-bottom: max(0px, calc((var(--tb-control) - 1lh) / 2)); }
.tb-row.tb-top { align-items: flex-start; }
.tb-row.tb-middle { align-items: center; }
.tb-row.tb-bottom { align-items: flex-end; }
.tb-row.tb-center { justify-content: center; }
.tb-row.tb-right { justify-content: flex-end; }
.tb-row.tb-spread { justify-content: space-between; }
.tb-fill { flex: 1 1 0; min-width: 0; }
.tb-view:has(.tb-desktop) { min-height: 100dvh; box-sizing: border-box; }
.tb-view:has(.tb-desktop) .tb-screens, .tb-screen:has(> .tb-desktop) { flex: 1 1 auto; }
.tb-view:has(.tb-fit) .tb-screens, .tb-screen:has(> .tb-fit) { flex: 1 1 auto; min-height: 0; }
.tb-view:has(.tb-fit) { height: 100dvh; box-sizing: border-box; }
.tb-fit { flex: 1 1 auto; min-height: 0; }
.tb-fit > * { min-height: 0; overflow: auto; }
.tb-fit > * > * { flex-shrink: 0; }
.tb-desktop {
  flex: 1 1 auto;
  min-height: 240px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: var(--tb-space-3);
  padding: var(--tb-space-5);
  border-radius: var(--tb-radius);
  background-color: color-mix(in oklch, var(--tb-primary) 9%, var(--tb-bg));
  background-size: cover;
  background-position: center;
}
/* an image behind what holds it, under a veil that keeps text on it AA; muted text needs the text's color there */
:has(> .tb-backdrop) { position: relative; isolation: isolate; --tb-muted: var(--tb-text); }
.tb-backdrop { position: absolute; inset: 0; z-index: -1; border-radius: inherit; background-size: cover; background-position: center; pointer-events: none; }
.tb-backdrop::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: var(--tb-scrim); }
/* the backdrop of the view or of a screen is the window's */
:is(.tb-view, .tb-screen) > .tb-backdrop { position: fixed; border-radius: 0; }
.tb-tile {
  font: inherit;
  font-size: 13px;
  width: 112px;
  min-height: 96px;
  padding: var(--tb-space-3) var(--tb-space-2);
  border: 1px solid transparent;
  border-radius: var(--tb-radius);
  background: transparent;
  color: var(--tb-text);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--tb-space-2);
  text-align: center;
  overflow-wrap: anywhere;
  transition: background var(--tb-fast) var(--tb-ease), border-color var(--tb-fast) var(--tb-ease);
}
.tb-tile:hover { background: var(--tb-surface); border-color: var(--tb-border); }
.tb-tile:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-tile > svg { flex: none; width: 36px; height: 36px; color: var(--tb-primary); }
.tb-tile-linked { position: relative; }
.tb-tile-linked::after {
  content: '';
  position: absolute;
  top: calc(var(--tb-space-3) + 21px);
  left: calc(50% - 22px);
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: var(--tb-text);
  outline: 2px solid var(--tb-bg);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M0 0h16v16H0z M6 4v2h2.6L4 10.6 5.4 12 10 7.4V10h2V4z' fill-rule='evenodd'/%3E%3C/svg%3E");
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M0 0h16v16H0z M6 4v2h2.6L4 10.6 5.4 12 10 7.4V10h2V4z' fill-rule='evenodd'/%3E%3C/svg%3E");
}
.tb-grid { --tb-tracks: initial; --tb-cols: 2; display: grid; gap: var(--tb-space-4); grid-template-columns: var(--tb-tracks, repeat(var(--tb-cols), minmax(0, 1fr))); }
.tb-panel {
  background: var(--tb-raised);
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-1);
  padding: var(--tb-space-6);
  display: flex;
  flex-direction: column;
  gap: var(--tb-space-5);
}
.tb-panel.tb-small { width: 100%; max-width: 420px; font-size: inherit; }
.tb-panel.tb-primary { border-color: var(--tb-primary); box-shadow: inset 0 0 0 1px var(--tb-primary), var(--tb-shadow-1); }
.tb-panel.tb-accent { border-color: var(--tb-accent); }
.tb-panel.tb-danger { border-color: var(--tb-danger); }
.tb-panel.tb-success { border-color: var(--tb-success); }
.tb-panel.tb-warning { border-color: var(--tb-warning); }
.tb-panel:focus-visible, .tb-column:focus-visible, .tb-row:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-panel.tb-primary:focus-visible { box-shadow: inset 0 0 0 1px var(--tb-primary), 0 0 0 3px var(--tb-focus-ring); }
.tb-panel > .tb-panel-title { margin: 0; font-family: var(--tb-headings); font-size: 17px; line-height: 1.35; font-weight: 600; letter-spacing: -0.01em; }
.tb-divider { border: 0; border-top: var(--tb-line) solid var(--tb-border); margin: var(--tb-space-2) 0; width: 100%; }

.tb-title { margin: 0; font-family: var(--tb-headings); font-size: 28px; line-height: 1.2; font-weight: 650; letter-spacing: -0.02em; }
.tb-heading { margin: 0; font-family: var(--tb-headings); font-size: 20px; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em; }
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
  /* a narrow form (in a grid cell, beside another panel) stacks like one on a phone; see @container below */
  container-type: inline-size;
  contain-intrinsic-inline-size: 30rem;
}
/* a panel in a form (a section) keeps the form's two columns */
.tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel { display: grid; grid-template-columns: subgrid; row-gap: var(--tb-space-4); align-items: start; }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > * { grid-column: 1 / -1; }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-field { display: contents; }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-field > .tb-label { grid-column: 1; padding-top: calc((var(--tb-control) - 1.5em) / 2); }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-field > .tb-control { grid-column: 2; }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-actions, :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-check-row { grid-column: 2; }
.tb-field { display: flex; flex-direction: column; gap: var(--tb-space-2); min-width: 0; }
@container (max-width: 420px) {
  :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-field { display: flex; }
  :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-field > .tb-label, :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-field > .tb-control,
  :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-actions, :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-check-row { grid-column: 1 / -1; padding-top: 0; }
}
.tb-rows { display: flex; flex-direction: column; gap: var(--tb-space-3); align-items: stretch; }
.tb-rows > .tb-button { align-self: flex-start; }
.tb-entry { display: flex; gap: var(--tb-space-3); align-items: flex-start; }
.tb-entry > * { flex: 1 1 0; min-width: 0; }
.tb-entry > .tb-button { flex: none; }
/* the labels of the first row are the headers of the others */
.tb-entry:not(:first-child) .tb-field > .tb-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.tb-entry:first-child:has(.tb-label:not(:empty)) > .tb-button { margin-top: calc(14px * 1.5 + var(--tb-space-2)); }
.tb-rich { display: flex; flex-direction: column; gap: var(--tb-space-1); }
.tb-rich-tools { display: flex; flex-wrap: wrap; gap: var(--tb-space-1); }
.tb-rich-tools[hidden], .tb-rich-link[hidden] { display: none; }
.tb-rich-tool { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: var(--tb-radius); background: transparent; color: var(--tb-muted); cursor: pointer; }
.tb-rich-tool:hover { background: var(--tb-primary-soft); color: var(--tb-text); }
.tb-rich-tool:focus-visible { outline: 2px solid var(--tb-primary); outline-offset: 1px; }
.tb-rich-tool .tb-icon { width: 18px; height: 18px; }
.tb-rich-link { display: flex; gap: var(--tb-space-2); align-items: center; }
.tb-input.tb-rich-box { padding: var(--tb-space-2) var(--tb-space-3); min-height: calc(var(--tb-control) * 2.5); overflow-wrap: anywhere; cursor: text; }
.tb-input.tb-rich-box[aria-readonly="true"] { background: color-mix(in srgb, var(--tb-muted) 12%, transparent); border-color: transparent; cursor: default; }
.tb-input.tb-rich-box[aria-disabled="true"] { opacity: 0.45; }
.tb-rich-box:focus { outline: none; border-color: var(--tb-primary); box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-rich-box > :first-child { margin-top: 0; }
.tb-rich-box > :last-child { margin-bottom: 0; }
.tb-rich-box p, .tb-rich-box ul, .tb-rich-box ol { margin: 0 0 var(--tb-space-2); }
.tb-rich-box ul, .tb-rich-box ol { padding-left: var(--tb-space-5); }
.tb-rich-box h1, .tb-rich-box h2, .tb-rich-box h3 { margin: var(--tb-space-3) 0 var(--tb-space-2); line-height: 1.3; font-weight: 600; }
.tb-rich-box h1 { font-size: 22px; }
.tb-rich-box h2 { font-size: 18px; }
.tb-rich-box h3 { font-size: 16px; }
.tb-rich-box a { color: var(--tb-primary); }
.tb-control { display: flex; flex-direction: column; gap: var(--tb-space-1); min-width: 0; }
.tb-label { font-weight: 550; font-size: 14px; color: var(--tb-text); }
.tb-required::after { content: " *"; color: var(--tb-muted); font-weight: 400; }
.tb-input {
  font: inherit;
  color: var(--tb-text);
  background: var(--tb-surface);
  border: var(--tb-line) solid var(--tb-border-strong);
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
.tb-input[readonly] { background: color-mix(in srgb, var(--tb-muted) 12%, transparent); border-color: transparent; color: var(--tb-muted); cursor: default; }
.tb-input[readonly]:focus { border-color: var(--tb-muted); box-shadow: none; }
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
.tb-radio-group { flex-basis: 100%; }
.tb-radio-title { display: block; margin-top: var(--tb-space-2); font-size: 13px; font-weight: 600; color: var(--tb-muted); }
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
  border: var(--tb-line) solid var(--tb-border-strong);
  background: var(--tb-surface);
  color: var(--tb-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--tb-space-2);
  transition: background var(--tb-fast) var(--tb-ease), border-color var(--tb-fast) var(--tb-ease), box-shadow var(--tb-fast) var(--tb-ease), opacity var(--tb-fast) var(--tb-ease);
}
.tb-button.tb-small { font-size: 13px; padding: 0 var(--tb-space-3); gap: var(--tb-space-1); }
.tb-button:hover { background: var(--tb-bg); border-color: var(--tb-muted); }
.tb-button:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-button.tb-primary { background: var(--tb-primary); border-color: var(--tb-primary); color: var(--tb-on-primary); box-shadow: var(--tb-shadow-1); }
.tb-button.tb-primary:hover { background: var(--tb-primary-hover); border-color: var(--tb-primary-hover); }
.tb-button.tb-accent { background: var(--tb-accent); border-color: var(--tb-accent); color: var(--tb-on-accent); }
.tb-button.tb-danger { background: var(--tb-danger); border-color: var(--tb-danger); color: var(--tb-on-danger); }
.tb-button:disabled, .tb-button[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.tb-button.tb-primary[aria-disabled="true"]:hover { background: var(--tb-primary); border-color: var(--tb-primary); }
.tb-button.tb-has-icon:not(:has(> span:not(:empty))) { padding: 0; width: var(--tb-control); }
/* a button that opens a menu: a chevron after its text, or alone after its icon */
.tb-menu-chevron { transition: transform var(--tb-fast) var(--tb-ease); }
.tb-button .tb-menu-chevron { width: 16px; height: 16px; margin-inline-end: calc(var(--tb-space-1) * -1); }
[aria-expanded="true"] > .tb-menu-chevron { transform: rotate(180deg); }
.tb-button.tb-has-icon[aria-haspopup]:not(:has(> span:not(:empty))) { width: auto; padding: 0 var(--tb-space-2); gap: 2px; }

.tb-icon { width: 1.25em; height: 1.25em; flex: none; fill: none; stroke: currentColor; stroke-width: var(--tb-icon-stroke); stroke-linecap: var(--tb-icon-cap); stroke-linejoin: var(--tb-icon-join); }
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
.tb-upload { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-3); padding: var(--tb-space-3); border: 1px dashed var(--tb-border-strong); border-radius: var(--tb-radius); background: var(--tb-surface); transition: border-color var(--tb-fast) var(--tb-ease), background var(--tb-fast) var(--tb-ease); }
.tb-upload.tb-drop-over { border-color: var(--tb-primary); background: var(--tb-primary-soft); }
.tb-invalid .tb-upload { border-color: var(--tb-danger); }
.tb-upload-hint { color: var(--tb-muted); font-size: 0.9em; }
.tb-upload[hidden] { display: none; }
.tb-upload[hidden] + .tb-upload-list { margin-top: 0; }
.tb-upload-list { list-style: none; margin: var(--tb-space-2) 0 0; padding: 0; display: grid; gap: var(--tb-space-1); }
.tb-upload-list li { display: flex; align-items: center; gap: var(--tb-space-2); min-height: 36px; padding: 0 var(--tb-space-1) 0 var(--tb-space-3); border: var(--tb-line) solid var(--tb-border); border-radius: var(--tb-radius); background: var(--tb-surface); }
.tb-upload-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
a.tb-upload-name { color: var(--tb-primary); text-decoration: none; }
a.tb-upload-name:hover { text-decoration: underline; }
.tb-upload-thumb { width: 32px; height: 32px; margin: var(--tb-space-1) 0; object-fit: cover; border-radius: var(--tb-radius); flex: none; }
.tb-upload-size { color: var(--tb-muted); font-size: 0.9em; font-variant-numeric: tabular-nums; }
.tb-upload-remove { width: 28px; height: 28px; display: grid; place-items: center; padding: 0; border: 0; border-radius: var(--tb-radius); background: transparent; color: var(--tb-muted); cursor: pointer; }
.tb-upload-remove:hover:not(:disabled) { background: var(--tb-danger-soft); color: var(--tb-danger); }
.tb-upload-remove:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-upload-remove .tb-icon { width: 16px; height: 16px; }
.tb-date { position: relative; display: flex; }
.tb-date > .tb-input { padding-right: calc(var(--tb-control) + var(--tb-space-1)); }
.tb-date-button { position: absolute; right: 1px; top: 1px; bottom: 1px; width: var(--tb-control); display: grid; place-items: center; padding: 0; border: 0; border-radius: var(--tb-radius); background: transparent; color: var(--tb-muted); cursor: pointer; }
.tb-date-button:hover:not(:disabled) { color: var(--tb-text); }
.tb-date-button:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-date-button:disabled { cursor: default; opacity: 0.5; }
.tb-date-button .tb-icon { width: 18px; height: 18px; }
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
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
}
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger) { border-color: transparent; background: transparent; }
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger):hover { background: var(--tb-bg); }
.tb-toolbar > .tb-button { padding: 0 var(--tb-space-3); }
.tb-toolbar > .tb-divider { width: 0; height: calc(var(--tb-control) - 12px); margin: 0 var(--tb-space-1); border-top: 0; border-left: var(--tb-line) solid var(--tb-border); }

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
/* read by screen readers, not shown */
.tb-sr-only { position: absolute; top: 0; left: 0; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
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
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius);
}
.tb-scroll.tb-small { max-height: 240px; font-size: inherit; }
.tb-scroll.tb-large { max-height: 640px; }
.tb-scroll:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }

.tb-image { display: block; max-width: 100%; height: auto; border-radius: var(--tb-radius); object-fit: cover; }
.tb-image.tb-round { aspect-ratio: 1; border-radius: 50%; }
.tb-video { display: block; width: 100%; max-width: 100%; height: auto; aspect-ratio: auto 16 / 9; border-radius: var(--tb-radius); }
.tb-audio { display: block; width: 100%; max-width: 480px; }
:is(.tb-video, .tb-audio).tb-small { width: 320px; }
:is(.tb-video, .tb-audio).tb-medium { width: 480px; }
.tb-video.tb-large { width: 720px; }
:is(.tb-video, .tb-audio).tb-fill { max-width: none; }
:is(.tb-video, .tb-audio):focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-canvas { display: block; max-width: 100%; }
.tb-canvas > svg { display: block; max-width: 100%; height: auto; overflow: visible; }
.tb-canvas.tb-fill > svg { width: 100%; }
.tb-chart { display: flex; flex-direction: column; gap: var(--tb-space-2); align-self: stretch; width: 100%; margin: 0; min-width: 0; }
.tb-chart-caption { font-weight: 600; }
.tb-chart-plot { width: 100%; min-width: 0; }
.tb-chart-plot > svg { display: block; width: 100%; height: auto; overflow: visible; }
.tb-chart-legend { display: flex; flex-wrap: wrap; gap: var(--tb-space-1) var(--tb-space-4); margin: 0; padding: 0; list-style: none; color: var(--tb-muted); font-size: 13px; }
.tb-chart-key { display: inline-flex; align-items: center; gap: var(--tb-space-2); }
.tb-chart-swatch { width: 12px; height: 12px; border-radius: 3px; background: var(--tb-swatch); }
.tb-chart-empty { margin: 0; color: var(--tb-muted); }
.tb-chart-caption[hidden], .tb-chart-plot[hidden], .tb-chart-legend[hidden], .tb-chart-empty[hidden] { display: none; }
.tb-orbit { position: relative; align-self: stretch; width: 100%; min-width: 0; height: 480px; border-radius: var(--tb-radius);
  background: radial-gradient(ellipse at 50% 45%, color-mix(in oklch, var(--tb-primary) 7%, transparent) 0%, transparent 70%); }
.tb-orbit.tb-small { height: 320px; }
.tb-orbit.tb-large { height: 640px; }
.tb-orbit.tb-fit { height: auto; min-height: 320px; }
.tb-orbit > svg { display: block; position: absolute; inset: 0; width: 100%; height: 100%; cursor: grab; user-select: none; touch-action: none; outline: none; }
.tb-orbit > svg.tb-orbit-panning { cursor: grabbing; }
.tb-orbit > svg:focus-visible { box-shadow: inset 0 0 0 3px var(--tb-focus-ring); border-radius: var(--tb-radius); }
.tb-orbit-node { cursor: pointer; outline: none; }
.tb-orbit-focus { cursor: default; }
.tb-orbit-body { vector-effect: non-scaling-stroke; transition: stroke-width .2s; }
.tb-orbit-node:hover .tb-orbit-body, .tb-orbit-node:focus-visible .tb-orbit-body { stroke-width: 3; }
.tb-orbit-node:focus-visible .tb-orbit-body { stroke: var(--tb-focus); }
.tb-orbit-halo { opacity: .55; transition: opacity .25s; pointer-events: none; }
.tb-orbit-node:hover .tb-orbit-halo, .tb-orbit-node:focus-visible .tb-orbit-halo { opacity: 1; }
.tb-orbit-node text { pointer-events: none; fill: var(--tb-text); text-anchor: middle; dominant-baseline: middle; font-family: var(--tb-font); }
.tb-orbit-node .tb-orbit-count { fill: var(--tb-muted); }
.tb-orbit-line, .tb-orbit-step { fill: none; vector-effect: non-scaling-stroke; pointer-events: none; }
.tb-orbit-line { stroke-width: 1; }
.tb-orbit-step { stroke-linecap: round; }
.tb-orbit-spin { animation: tb-orbit-spin 60s linear infinite; }
.tb-orbit-spin.tb-orbit-rev { animation-direction: reverse; animation-duration: 90s; }
.tb-orbit-spin.tb-orbit-fast { animation-duration: 24s; }
@keyframes tb-orbit-spin { to { transform: rotate(360deg); } }
.tb-orbit-now { animation: tb-orbit-pulse 1.8s ease-in-out infinite; }
@keyframes tb-orbit-pulse { 50% { opacity: .35; } }
.tb-orbit-edge { fill: none; pointer-events: none; }
.tb-orbit-edge-solid, .tb-orbit-edge-dashed { stroke: var(--tb-accent); stroke-width: 1.4; stroke-opacity: .7; }
.tb-orbit-edge-dashed { stroke-dasharray: 5 5; }
.tb-orbit-edge-faint { stroke: var(--tb-muted); stroke-width: 1; stroke-opacity: .35; }
.tb-orbit-edge-trail { stroke: var(--tb-muted); stroke-width: 1; stroke-opacity: .5; stroke-dasharray: 2 6; }
.tb-orbit-label { font-size: 11px; font-family: var(--tb-font); fill: var(--tb-muted); text-anchor: middle; pointer-events: none;
  paint-order: stroke; stroke: var(--tb-bg); stroke-width: 3px; letter-spacing: .02em; }
.tb-orbit-label.tb-orbit-later { visibility: hidden; }
.tb-orbit-label.tb-orbit-later.tb-orbit-shown { visibility: visible; }
.tb-image.tb-small { width: 96px; }
.tb-image.tb-medium { width: 240px; }
.tb-image.tb-large { width: 480px; }
.tb-image.tb-fill { width: 100%; }

.tb-progress-wrap { display: flex; flex-direction: column; gap: var(--tb-space-2); min-width: 0; }
.tb-progress-label { font-size: 14px; font-weight: 550; }
.tb-progress-label[hidden] { display: none; }
.tb-progress { height: 8px; border-radius: 4px; background: var(--tb-border); overflow: hidden; }
.tb-upload-progress { height: 6px; }
.tb-widget { display: block; width: 100%; min-width: 0; }
.tb-photo { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-4); margin: calc(-1 * var(--tb-space-2)); padding: var(--tb-space-2); border: 1px dashed transparent; border-radius: var(--tb-radius-lg); transition: border-color var(--tb-fast) var(--tb-ease), background var(--tb-fast) var(--tb-ease); }
.tb-photo.tb-drop-over { border-color: var(--tb-primary); background: var(--tb-primary-soft); }
.tb-photo-frame { flex: none; width: 96px; height: 96px; display: grid; place-items: center; overflow: hidden; border: var(--tb-line) solid var(--tb-border); border-radius: var(--tb-radius-lg); background: var(--tb-bg); color: var(--tb-muted); }
.tb-photo-frame.tb-photo-pick { cursor: pointer; }
.tb-photo-frame.tb-round { border-radius: 50%; }
.tb-photo-frame > img { display: block; width: 100%; height: 100%; object-fit: cover; }
.tb-photo-frame > .tb-icon { width: 32px; height: 32px; }
.tb-invalid .tb-photo-frame { border-color: var(--tb-danger); }
.tb-photo-actions { display: flex; flex-wrap: wrap; gap: var(--tb-space-2); }
.tb-photo-actions[hidden], .tb-photo-remove[hidden] { display: none; }
.tb-upload-progress[hidden] { display: none; }
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
  border: var(--tb-line) solid var(--tb-border);
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
  border-bottom: var(--tb-line) solid var(--tb-border);
}
.tb-table td { padding: var(--tb-space-3) var(--tb-space-4); border-bottom: var(--tb-line) solid var(--tb-border); height: var(--tb-control); }
.tb-table tbody tr:last-child td { border-bottom: 0; }
.tb-table .tb-num { text-align: right; font-variant-numeric: tabular-nums; }
.tb-table-wrap:has(tbody:empty) thead { display: none; }
/* the room of the rows a long table does not draw */
.tb-table .tb-room[hidden] { display: none; }
.tb-table.tb-fixed { table-layout: fixed; }
.tb-table .tb-room :is(tr, td) { padding: 0; border: 0; margin: 0; background: none; box-shadow: none; }
.tb-table th:has(> .tb-sort) { padding: 0; }
.tb-sort {
  display: flex;
  align-items: center;
  gap: var(--tb-space-1);
  width: 100%;
  padding: var(--tb-space-3) var(--tb-space-4);
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  border-radius: 0;
}
.tb-sort:hover, th[aria-sort] > .tb-sort { color: var(--tb-text); }
.tb-sort:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--tb-focus); }
.tb-sort svg { width: 14px; height: 14px; flex: none; }
.tb-sort .tb-sort-idle { opacity: 0; transition: opacity var(--tb-fast) var(--tb-ease); }
.tb-sort:hover .tb-sort-idle, .tb-sort:focus-visible .tb-sort-idle { opacity: 0.5; }
.tb-table tfoot[hidden] { display: none !important; }
.tb-table tfoot td {
  font-weight: 600;
  background: var(--tb-bg);
  border-top: var(--tb-line) solid var(--tb-border);
  border-bottom: 0;
}
.tb-selectable tbody:not(.tb-room) tr:not(.tb-group-head, .tb-group-foot), .tb-selectable .tb-list > li:not(.tb-group-head, .tb-group-foot) { cursor: pointer; transition: background var(--tb-fast) var(--tb-ease); }
.tb-selectable tbody:not(.tb-room) tr:not(.tb-group-head, .tb-group-foot):hover, .tb-selectable .tb-list > li:not(.tb-group-head, .tb-group-foot):hover { background: var(--tb-bg); }
.tb-selectable tbody tr:focus-visible, .tb-selectable .tb-list > li:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--tb-focus); }
.tb-table tr.tb-selected, .tb-list > li.tb-selected { background: var(--tb-primary-soft); }
/* the head and foot of a group in the rows: a title the width of the row, and its subtotals */
.tb-table .tb-group-head > th { font-size: 14px; color: var(--tb-text); white-space: normal; background: var(--tb-bg); border-top: var(--tb-line) solid var(--tb-border); }
.tb-table .tb-group-head.tb-level-2 > th { font-weight: 500; background: var(--tb-surface); }
.tb-table .tb-group-foot > td { font-weight: 600; background: var(--tb-bg); }
.tb-table .tb-level-2 > :first-child, .tb-list > .tb-level-2 { padding-left: calc(var(--tb-space-4) + var(--tb-space-5)); }
.tb-list > li.tb-group-head { font-weight: 600; background: var(--tb-bg); }
.tb-list > li.tb-group-foot { font-weight: 600; }
.tb-empty { margin: 0; padding: var(--tb-space-6) var(--tb-space-4); text-align: center; color: var(--tb-muted); }
.tb-empty[hidden] { display: none; }

.tb-list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--tb-surface);
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-1);
  overflow: hidden;
}
.tb-list:empty { display: none; }
.tb-list > li {
  display: flex;
  align-items: center;
  gap: var(--tb-space-3);
  min-height: var(--tb-control);
  padding: var(--tb-space-3) var(--tb-space-4);
  border-bottom: var(--tb-line) solid var(--tb-border);
}
.tb-list > li:last-child { border-bottom: 0; }
.tb-list-texts { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-width: 0; }
.tb-list-primary { font-weight: 550; }
/* the picture of a row, in a column of images or at the start of a list's item */
.tb-thumb { display: block; flex: none; width: 40px; height: 40px; object-fit: cover; border-radius: var(--tb-radius); background: var(--tb-bg); }
.tb-thumb.tb-round { border-radius: 50%; }
.tb-table td.tb-thumb-cell { width: 1%; padding-top: var(--tb-space-1); padding-bottom: var(--tb-space-1); }
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
.tb-dialog.tb-confirm { width: min(420px, calc(100vw - 32px)); }
.tb-dialog.tb-confirm > .tb-dialog-body { padding-top: var(--tb-space-6); gap: var(--tb-space-6); }
.tb-confirm-question { margin: 0; font-size: 15px; line-height: 1.5; }
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

/* the calendar of a date field: in the top layer, placed by the host */
.tb-calendar {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: var(--tb-space-3);
  background: var(--tb-raised);
  color: var(--tb-text);
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-3);
  animation: tb-pop 120ms var(--tb-ease);
}
.tb-calendar-head { display: flex; align-items: center; gap: var(--tb-space-2); margin-bottom: var(--tb-space-2); }
.tb-calendar-month { flex: 1; margin: 0; font-size: 1em; font-weight: 600; text-align: center; }
.tb-calendar-month::first-letter { text-transform: uppercase; }
.tb-calendar-step { width: 32px; height: 32px; display: grid; place-items: center; padding: 0; border: 0; border-radius: var(--tb-radius); background: transparent; color: var(--tb-muted); cursor: pointer; }
.tb-calendar-step:hover { background: var(--tb-bg); color: var(--tb-text); }
.tb-calendar-step:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-calendar-step .tb-icon { width: 18px; height: 18px; }
.tb-calendar-grid { border-collapse: collapse; }
.tb-calendar-grid th { width: 36px; height: 28px; font-size: 0.8em; font-weight: 500; color: var(--tb-muted); text-transform: uppercase; }
.tb-calendar-day { width: 36px; height: 36px; padding: 0; text-align: center; border-radius: var(--tb-radius); cursor: pointer; font-variant-numeric: tabular-nums; transition: background var(--tb-fast) var(--tb-ease); }
.tb-calendar-day:hover { background: var(--tb-bg); }
.tb-calendar-day:focus { outline: none; box-shadow: inset 0 0 0 2px var(--tb-focus); }
.tb-calendar-other { color: var(--tb-muted); }
.tb-calendar-day[aria-current="date"] { font-weight: 700; color: var(--tb-primary); }
.tb-calendar-day[aria-selected="true"] { background: var(--tb-primary); color: var(--tb-on-primary); }
.tb-calendar-day[aria-disabled="true"] { color: var(--tb-border-strong); background: transparent; cursor: default; text-decoration: line-through; }

/* menus: in the top layer, placed by the host */
.tb-lookup { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-1); }
.tb-lookup .tb-input { flex: 1; min-width: 8em; width: auto; }
.tb-lookup-chosen { list-style: none; margin: 0; padding: 0; display: contents; }
.tb-lookup-chip { display: inline-flex; align-items: center; gap: var(--tb-space-1); min-height: 32px; padding: 0 var(--tb-space-1) 0 var(--tb-space-3); border: var(--tb-line) solid var(--tb-border); border-radius: var(--tb-radius); background: var(--tb-surface); }
.tb-lookup-chip:not(:has(button)) { padding-right: var(--tb-space-3); }
.tb-lookup-list {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: var(--tb-space-1);
  list-style: none;
  max-height: 280px;
  overflow-y: auto;
  color: var(--tb-text);
  background: var(--tb-raised);
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-3);
}
.tb-lookup-option { padding: var(--tb-space-2) var(--tb-space-3); border-radius: var(--tb-radius); cursor: pointer; }
.tb-lookup-option:hover, .tb-lookup-option[aria-selected="true"] { background: var(--tb-primary-soft); }
.tb-lookup-none { padding: var(--tb-space-2) var(--tb-space-3); color: var(--tb-muted); }

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
  border: var(--tb-line) solid var(--tb-border);
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
  border: var(--tb-line) solid var(--tb-border);
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

/* under trebol dev, the errors the app does not catch */
.tb-dev-errors {
  position: fixed;
  inset: var(--tb-space-4) var(--tb-space-4) auto;
  width: auto;
  max-width: 960px;
  max-height: calc(100vh - 2 * var(--tb-space-4));
  margin: 0 auto;
  overflow: auto;
  box-sizing: border-box;
  padding: var(--tb-space-4) var(--tb-space-5);
  border: 1px solid var(--tb-border);
  border-left: 4px solid var(--tb-danger);
  border-radius: var(--tb-radius);
  background: var(--tb-surface);
  color: var(--tb-text);
  box-shadow: var(--tb-shadow-3);
  font-family: var(--tb-font);
}
.tb-dev-errors header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tb-space-3);
  margin-bottom: var(--tb-space-3);
  font-weight: 600;
}
.tb-dev-errors pre {
  margin: 0 0 var(--tb-space-3);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: 13px/1.6 ui-monospace, Menlo, Consolas, monospace;
}

/* under trebol dev, the dev tools: Faces, Console, Log */
.tb-dev-tools {
  position: fixed;
  inset: auto 0 0 0;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  flex-direction: column;
  border: 0;
  border-top: 1px solid var(--tb-border-strong);
  background: var(--tb-surface);
  color: var(--tb-text);
  box-shadow: var(--tb-shadow-3);
  font: 13px/1.5 var(--tb-font);
}
.tb-dev-tools:popover-open { display: flex; }
.tb-dev-tools :is(pre, code, .tb-dev-in, .tb-dev-node, .tb-dev-detail dd, .tb-dev-text) {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
}
.tb-dev-grip { height: 6px; margin-top: -3px; cursor: ns-resize; flex: none; touch-action: none; }
.tb-dev-tools header {
  display: flex;
  align-items: center;
  gap: var(--tb-space-2);
  padding: 0 var(--tb-space-3) 0 0;
  border-bottom: 1px solid var(--tb-border);
  flex: none;
}
.tb-dev-tabs { display: flex; }
.tb-dev-space { flex: 1; }
.tb-dev-tab, .tb-dev-button, .tb-dev-node, .tb-dev-opener {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.tb-dev-tab {
  padding: var(--tb-space-2) var(--tb-space-4);
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--tb-muted);
}
.tb-dev-tab[aria-selected="true"] { color: var(--tb-text); border-bottom-color: var(--tb-primary); font-weight: 600; }
.tb-dev-button {
  padding: 2px var(--tb-space-3);
  border: 1px solid var(--tb-border-strong);
  border-radius: var(--tb-radius);
  background: var(--tb-bg);
}
.tb-dev-button[aria-pressed="true"] { background: var(--tb-primary); color: var(--tb-on-primary); border-color: var(--tb-primary); }
.tb-dev-tools :is(button, a, textarea):focus-visible { outline: 2px solid var(--tb-focus); outline-offset: -2px; }
.tb-dev-body { flex: 1; min-height: 0; display: flex; }
.tb-dev-pane { flex: 1; min-width: 0; min-height: 0; }
.tb-dev-pane[hidden] { display: none; }
.tb-dev-faces { display: grid; grid-template-columns: minmax(200px, 2fr) 3fr; }
.tb-dev-tree { overflow: auto; border-right: 1px solid var(--tb-border); padding: var(--tb-space-1) 0; }
.tb-dev-node {
  display: block;
  width: 100%;
  padding: 1px var(--tb-space-2);
  border: 0;
  background: transparent;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tb-dev-node:hover { background: var(--tb-primary-soft); }
.tb-dev-node[aria-current="true"] { background: var(--tb-primary); color: var(--tb-on-primary); }
.tb-dev-unseen { color: var(--tb-muted); }
.tb-dev-detail { overflow: auto; padding: var(--tb-space-3) var(--tb-space-4); }
.tb-dev-detail h3 { margin: 0 0 var(--tb-space-1); font-size: 14px; }
.tb-dev-detail dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px var(--tb-space-4); margin: var(--tb-space-3) 0 0; }
.tb-dev-detail dt { color: var(--tb-muted); }
.tb-dev-detail dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.tb-dev-place { margin: 0; }
.tb-dev-place a { color: var(--tb-primary); }
.tb-dev-hint { margin: 0; color: var(--tb-muted); }
.tb-dev-console { display: flex; flex-direction: column; }
.tb-dev-out { flex: 1; overflow: auto; padding: var(--tb-space-2) var(--tb-space-3); }
.tb-dev-out pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.tb-dev-said-in { color: var(--tb-muted); }
.tb-dev-said-error { color: var(--tb-danger); }
.tb-dev-face { padding: 2px var(--tb-space-3); color: var(--tb-muted); border-top: 1px solid var(--tb-border); }
.tb-dev-prompt { display: flex; align-items: flex-start; gap: var(--tb-space-2); padding: var(--tb-space-1) var(--tb-space-3) var(--tb-space-2); }
.tb-dev-sign { font: 12px/20px ui-monospace, Menlo, Consolas, monospace; color: var(--tb-primary); }
textarea.tb-dev-in { flex: 1; resize: none; border: 0; padding: 0; background: transparent; color: var(--tb-text); line-height: 20px; outline: none; }
.tb-dev-log { display: flex; flex-direction: column; }
.tb-dev-bar { display: flex; justify-content: flex-end; padding: var(--tb-space-1) var(--tb-space-3); flex: none; }
ol.tb-dev-entries { flex: 1; margin: 0; overflow: auto; list-style: none; padding: 0 var(--tb-space-3) var(--tb-space-2); }
ol.tb-dev-entries li { display: grid; grid-template-columns: max-content 5.5em 1fr; gap: var(--tb-space-3); padding: 1px 0; border-bottom: 1px solid var(--tb-border); }
ol.tb-dev-entries time { color: var(--tb-muted); font-variant-numeric: tabular-nums; }
.tb-dev-kind { color: var(--tb-muted); }
ol.tb-dev-entries .tb-dev-text { overflow-wrap: anywhere; }
ol.tb-dev-entries :is(.tb-dev-error, .tb-dev-failed) .tb-dev-kind, ol.tb-dev-entries :is(.tb-dev-error, .tb-dev-failed) .tb-dev-text { color: var(--tb-danger); }
ol.tb-dev-entries .tb-dev-warning .tb-dev-kind { color: var(--tb-warning); }
.tb-dev-opener {
  position: fixed;
  inset: auto var(--tb-space-3) var(--tb-space-3) auto;
  margin: 0;
  padding: 2px var(--tb-space-3);
  border: 1px solid var(--tb-border-strong);
  border-radius: 999px;
  background: var(--tb-surface);
  box-shadow: var(--tb-shadow-1);
  font: 600 12px/1.6 var(--tb-font);
  opacity: 0.7;
}
.tb-dev-opener:hover, .tb-dev-opener:focus-visible { opacity: 1; }
.tb-dev-outline {
  position: fixed;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  border: 2px solid var(--tb-primary);
  border-radius: 2px;
  background: transparent;
  pointer-events: none;
}
.tb-dev-outline.tb-dev-pointed { border-style: dashed; background: color-mix(in srgb, var(--tb-primary) 12%, transparent); }
.tb-dev-picking, .tb-dev-picking * { cursor: crosshair !important; }
@media (max-width: 640px) {
  .tb-dev-faces { grid-template-columns: 1fr; grid-template-rows: 2fr 3fr; }
  .tb-dev-tree { border-right: 0; border-bottom: 1px solid var(--tb-border); }
  ol.tb-dev-entries li { grid-template-columns: max-content 1fr; }
  ol.tb-dev-entries time { display: none; }
}

@media (max-width: 640px) {
  .tb-wide-only { display: none !important; }
  .tb-view:has(.tb-fit) { height: auto; }
  .tb-fit > * { overflow: visible; }
  .tb-split { display: block; }
  .tb-split-handle { display: none; }
  .tb-split[data-pane="1"] > .tb-split-pane:last-child, .tb-split[data-pane="2"] > .tb-split-pane:first-child { display: none; }
  .tb-split-back { display: inline-flex; align-self: flex-start; padding: 0 var(--tb-space-3); border: 0; background: transparent; color: var(--tb-primary); }
  .tb-view { padding: var(--tb-space-5) var(--tb-space-4); }
  .tb-form { grid-template-columns: minmax(0, 1fr); }
  :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-field { display: flex; }
  :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-field > .tb-label, :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-field > .tb-control,
  :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-actions, :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-check-row { grid-column: 1; padding-top: 0; }
  .tb-row:has(> .tb-field) { flex-direction: column; align-items: stretch; }
  .tb-row:has(> .tb-field) > :is(.tb-text, .tb-heading) { margin-bottom: 0; }
  .tb-entry { flex-direction: column; align-items: stretch; padding: var(--tb-space-3); border: var(--tb-line) solid var(--tb-border); border-radius: var(--tb-radius); }
  .tb-entry > * { flex: none; }
  .tb-entry:not(:first-child) .tb-field > .tb-label { position: static; width: auto; height: auto; overflow: visible; clip-path: none; white-space: normal; }
  .tb-entry > .tb-button, .tb-entry:first-child:has(.tb-label:not(:empty)) > .tb-button { align-self: flex-end; margin-top: 0; }
  .tb-grid { grid-template-columns: minmax(0, 1fr); }
  .tb-actions > .tb-button { flex: 1 1 auto; }
  .tb-table-wrap { overflow: visible; background: none; border: 0; box-shadow: none; }
  .tb-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .tb-table, .tb-table tbody, .tb-table tfoot, .tb-table tr, .tb-table td { display: block; }
  .tb-table tfoot { margin-top: var(--tb-space-3); }
  .tb-table tfoot tr { background: var(--tb-bg); }
  .tb-table tfoot td { background: none; }
  .tb-table tfoot td:empty { display: none; }
  .tb-table tbody { display: flex; flex-direction: column; gap: var(--tb-space-3); }
  .tb-table tr {
    padding: var(--tb-space-3) var(--tb-space-4);
    background: var(--tb-surface);
    border: var(--tb-line) solid var(--tb-border);
    border-radius: var(--tb-radius-lg);
    box-shadow: var(--tb-shadow-1);
  }
  .tb-table td, .tb-table tbody tr:last-child td, .tb-table tfoot td {
    display: flex;
    justify-content: space-between;
    gap: var(--tb-space-4);
    height: auto;
    padding: var(--tb-space-1) 0;
    border: 0;
    text-align: right;
  }
  .tb-table td::before { content: attr(data-label); color: var(--tb-muted); font-weight: 500; text-align: left; }
  .tb-table td.tb-thumb-cell { width: auto; justify-content: flex-start; }
  .tb-table td.tb-thumb-cell::before { content: none; }
  .tb-table tr.tb-group-head { padding: var(--tb-space-3) 0 0; background: none; border: 0; box-shadow: none; }
  .tb-table .tb-group-head > th, .tb-table .tb-group-head.tb-level-2 > th { display: block; padding: 0; background: none; border: 0; }
  .tb-table .tb-level-2 > :first-child { padding-left: 0; }
  .tb-table tr.tb-group-head.tb-level-2, .tb-table tr.tb-group-foot.tb-level-2 { margin-left: var(--tb-space-4); }
  .tb-table tr.tb-group-foot { background: var(--tb-bg); }
  .tb-table .tb-group-foot > td { background: none; }
  .tb-table .tb-group-foot > td:empty { display: none; }
  .tb-toolbar > .tb-button.tb-has-icon { padding: 0; width: var(--tb-control); }
  .tb-toolbar > .tb-button.tb-has-icon > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .tb-crumb-middle { display: none !important; }
  .tb-crumb-more { display: inline-flex !important; }
  .tb-dialog { width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; margin: 0; border-radius: 0; }
  .tb-dialog.tb-confirm { width: calc(100vw - 32px); height: fit-content; max-height: calc(100dvh - 32px); margin: auto; border-radius: var(--tb-radius-lg); }
}
@media print {
  .tb-toasts, .tb-dialog:not([open]) { display: none !important; }
  /* print-page/only: the face alone, at the top of the page, with what holds it out of sight */
  .tb-print-only body * { visibility: hidden; }
  .tb-print-only .tb-print-target, .tb-print-only .tb-print-target * { visibility: visible; }
  .tb-print-only .tb-print-target { position: absolute; inset: 0 0 auto 0; margin: 0; box-shadow: none; }
}
@media (pointer: coarse) { :root { --tb-control: 44px; } }
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
  .tb-indeterminate .tb-progress-bar { width: 100%; opacity: 0.35; }
}
`;

/** What a skin changes on top of the component rules: '' for the modern one. */
const SKINS: Record<Skin, string> = {
  modern: '',
  classic: String.raw`
/* classic: controls in relief on a grey window, sunken wells for what is typed, title bars on dialogs */
:root {
  --tb-raise: inset 1px 1px 0 var(--tb-bevel-hi), inset -1px -1px 0 var(--tb-bevel-lo);
  --tb-sink: inset 1px 1px 0 var(--tb-bevel-lo), inset -1px -1px 0 var(--tb-bevel-hi);
  --tb-drop: 3px 3px 0 color-mix(in oklch, var(--tb-bevel-lo) 60%, transparent);
  --tb-ring: 0 0 0 2px var(--tb-focus);
  --tb-face: linear-gradient(var(--tb-face-hi), var(--tb-face-lo));
}
body { font-size: 14px; -webkit-font-smoothing: auto; }
.tb-title { font-weight: 700; letter-spacing: 0; color: var(--tb-primary); text-shadow: 1px 1px 0 var(--tb-bevel-hi); }
.tb-heading, .tb-panel > .tb-panel-title, .tb-dialog-title { font-weight: 700; letter-spacing: 0; }
.tb-label { font-weight: 700; font-size: 13px; }
.tb-divider { border-top: 1px solid var(--tb-bevel-lo); border-bottom: 1px solid var(--tb-bevel-hi); }

.tb-panel { border: 1px solid var(--tb-border-strong); border-radius: var(--tb-radius); box-shadow: var(--tb-raise); padding: var(--tb-space-5); }
.tb-panel.tb-primary { box-shadow: var(--tb-raise); }
.tb-panel:focus-visible, .tb-panel.tb-primary:focus-visible { box-shadow: var(--tb-raise), var(--tb-ring); }
.tb-tile:hover { background: var(--tb-face); border-color: var(--tb-border-strong); box-shadow: var(--tb-raise); }

/* buttons: a face lit from the top left; pressed, it sinks */
.tb-button { font-size: 13px; font-weight: 700; padding: 0 var(--tb-space-4); border: 1px solid var(--tb-border-strong); background: var(--tb-face); box-shadow: var(--tb-raise); transition: none; }
.tb-button:hover { background: linear-gradient(var(--tb-bevel-hi), var(--tb-face-hi)); border-color: var(--tb-border-strong); }
.tb-button:active:not(:disabled, [aria-disabled="true"]) { background: linear-gradient(var(--tb-face-lo), var(--tb-face-hi)); box-shadow: var(--tb-sink); }
.tb-button:focus-visible { box-shadow: var(--tb-raise), var(--tb-ring); }
.tb-button:disabled, .tb-button[aria-disabled="true"] { box-shadow: var(--tb-raise); }
.tb-button.tb-primary { --tb-tint: var(--tb-primary); }
.tb-button.tb-accent { --tb-tint: var(--tb-accent); }
.tb-button.tb-danger { --tb-tint: var(--tb-danger); }
.tb-button:is(.tb-primary, .tb-accent, .tb-danger), .tb-button:is(.tb-primary, .tb-accent, .tb-danger):hover, .tb-button.tb-primary[aria-disabled="true"]:hover {
  background: linear-gradient(color-mix(in oklch, var(--tb-tint) 85%, var(--tb-bevel-hi)), var(--tb-tint));
  border-color: color-mix(in oklch, var(--tb-tint) 50%, var(--tb-border-strong));
  box-shadow: inset 1px 1px 0 color-mix(in oklch, var(--tb-bevel-hi) 45%, transparent), inset -1px -1px 0 color-mix(in oklch, var(--tb-bevel-lo) 60%, transparent);
}
.tb-button:is(.tb-primary, .tb-accent, .tb-danger):hover:not(:disabled, [aria-disabled="true"]) { filter: brightness(1.08); }
.tb-button:is(.tb-primary, .tb-accent, .tb-danger):active:not(:disabled, [aria-disabled="true"]) { background: var(--tb-tint); box-shadow: inset 1px 1px 0 color-mix(in oklch, var(--tb-bevel-lo) 60%, transparent); }
.tb-button:is(.tb-primary, .tb-accent, .tb-danger):focus-visible { box-shadow: var(--tb-raise), var(--tb-ring); }
.tb-toolbar { background: var(--tb-face); border: 1px solid var(--tb-border-strong); border-radius: var(--tb-radius); box-shadow: var(--tb-raise); }
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger) { box-shadow: none; }
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger):hover { background: var(--tb-face); border-color: var(--tb-border-strong); box-shadow: var(--tb-raise); }
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger):focus-visible { box-shadow: var(--tb-ring); }
.tb-toolbar > .tb-divider { border-left-color: var(--tb-bevel-lo); border-right: 1px solid var(--tb-bevel-hi); border-bottom: 0; }
.tb-rich-tool:hover { background: var(--tb-face); box-shadow: var(--tb-raise); color: var(--tb-text); }

/* what is typed sits in a sunken well; a choice is a button that drops a list */
.tb-input { border: 1px solid var(--tb-border-strong); box-shadow: var(--tb-sink); transition: none; }
.tb-input:focus, .tb-rich-box:focus { border-color: var(--tb-focus); box-shadow: var(--tb-sink), 0 0 0 1px var(--tb-focus); }
.tb-invalid .tb-input:focus { box-shadow: var(--tb-sink), 0 0 0 1px var(--tb-danger); }
.tb-input[readonly], .tb-input.tb-rich-box[aria-readonly="true"] { background: var(--tb-bg); border-color: var(--tb-border); box-shadow: none; color: var(--tb-text); }
select.tb-input {
  font-weight: 700;
  font-size: 13px;
  background-image: linear-gradient(45deg, transparent 50%, var(--tb-text) 50%), linear-gradient(135deg, var(--tb-text) 50%, transparent 50%), var(--tb-face);
  background-position: calc(100% - 16px) 50%, calc(100% - 11px) 50%, 0 0;
  background-size: 5px 5px, 5px 5px, 100% 100%;
  box-shadow: var(--tb-raise);
}
select.tb-input:focus { box-shadow: var(--tb-raise), var(--tb-ring); }
.tb-switch input, .tb-switch input:focus-visible { border-radius: var(--tb-radius); box-shadow: var(--tb-sink); }
.tb-switch input:focus-visible { box-shadow: var(--tb-sink), var(--tb-ring); }
.tb-switch input::before { border-radius: var(--tb-radius); background: var(--tb-face); box-shadow: var(--tb-raise), 0 0 0 1px var(--tb-border-strong); }
.tb-upload { box-shadow: var(--tb-sink); }
.tb-date-button { top: 1px; right: 1px; bottom: 1px; width: calc(var(--tb-control) - 2px); border-left: 1px solid var(--tb-border-strong); border-radius: 0; background: var(--tb-face); box-shadow: var(--tb-raise); color: var(--tb-text); }
.tb-scroll { background: var(--tb-surface); border-color: var(--tb-border-strong); box-shadow: var(--tb-sink); }
.tb-scroll:focus-visible { box-shadow: var(--tb-sink), var(--tb-ring); }

/* progress: a sunken trough filled with blocks */
.tb-progress { height: 18px; padding: 2px; border: 1px solid var(--tb-border-strong); border-radius: var(--tb-radius); background: var(--tb-surface); box-shadow: var(--tb-sink); }
.tb-progress-bar { --tb-bar: var(--tb-primary); border-radius: 0; background: repeating-linear-gradient(90deg, var(--tb-bar) 0 10px, transparent 10px 12px); }
.tb-success .tb-progress-bar { --tb-bar: var(--tb-success); background: repeating-linear-gradient(90deg, var(--tb-bar) 0 10px, transparent 10px 12px); }
.tb-warning .tb-progress-bar { --tb-bar: var(--tb-warning); background: repeating-linear-gradient(90deg, var(--tb-bar) 0 10px, transparent 10px 12px); }
.tb-danger .tb-progress-bar { --tb-bar: var(--tb-danger); background: repeating-linear-gradient(90deg, var(--tb-bar) 0 10px, transparent 10px 12px); }
.tb-accent .tb-progress-bar { --tb-bar: var(--tb-accent); background: repeating-linear-gradient(90deg, var(--tb-bar) 0 10px, transparent 10px 12px); }

/* tables and lists: a sunken frame, buttons for headers, what is chosen in the primary color */
.tb-table-wrap, .tb-list { border: 1px solid; border-color: var(--tb-bevel-lo) var(--tb-bevel-hi) var(--tb-bevel-hi) var(--tb-bevel-lo); border-radius: var(--tb-radius); box-shadow: none; }
.tb-table th { color: var(--tb-text); font-weight: 700; padding: var(--tb-space-2) var(--tb-space-3); background: var(--tb-face); border-bottom: 1px solid var(--tb-border-strong); box-shadow: var(--tb-raise); }
.tb-sort { padding: var(--tb-space-2) var(--tb-space-3); }
.tb-table tfoot td { background: var(--tb-bg); border-top-color: var(--tb-border-strong); }
@media (min-width: 641px) {
  .tb-table td { padding: var(--tb-space-2) var(--tb-space-3); border-right: 1px solid var(--tb-border); }
  .tb-table th { border-right: 1px solid var(--tb-border-strong); }
  .tb-table tr > :last-child { border-right: 0; }
}
.tb-selectable :is(tbody > tr, .tb-list > li).tb-selected, .tb-tree li.tb-selected > .tb-tree-row { background: var(--tb-primary); color: var(--tb-on-primary); }
.tb-list > li.tb-selected .tb-list-secondary, .tb-tree li.tb-selected > .tb-tree-row .tb-tree-toggle { color: inherit; }
.tb-selectable tbody tr.tb-selected:focus-visible, .tb-selectable .tb-list > li.tb-selected:focus-visible { box-shadow: inset 0 0 0 2px var(--tb-focus), inset 0 0 0 3px var(--tb-on-primary); }
.tb-tree-row { border-radius: 0; }

/* tabs: raised tabs on a line; the chosen one is taller and opens onto what it shows */
.tb-tablist { gap: 2px; padding: 0 var(--tb-space-2); box-shadow: inset 0 -1px 0 var(--tb-border-strong); }
.tb-tab { font-size: 13px; font-weight: 700; min-height: calc(var(--tb-control) - 4px); margin-top: 4px; border: 1px solid var(--tb-border-strong); border-bottom: 0; border-radius: var(--tb-radius) var(--tb-radius) 0 0; background: var(--tb-face); color: var(--tb-muted); box-shadow: inset 1px 1px 0 var(--tb-bevel-hi); }
.tb-tab[aria-selected="true"] { margin-top: 0; min-height: var(--tb-control); background: var(--tb-bg); color: var(--tb-text); }

/* what floats: raised, with a hard shadow; the item under the pointer or the keys in the primary color */
.tb-menu, .tb-lookup-list, .tb-calendar { border: 1px solid var(--tb-border-strong); border-radius: var(--tb-radius); box-shadow: var(--tb-raise), var(--tb-drop); animation: none; }
.tb-menu-item, .tb-lookup-option { border-radius: 0; }
.tb-menu-item:focus, .tb-lookup-option:hover, .tb-lookup-option[aria-selected="true"] { background: var(--tb-primary); color: var(--tb-on-primary); }
.tb-menu-item:focus svg { color: inherit; }
.tb-menu-divider { background: var(--tb-bevel-lo); box-shadow: 0 1px 0 var(--tb-bevel-hi); }
.tb-calendar-step, .tb-upload-remove { background: var(--tb-face); border: 1px solid var(--tb-border-strong); box-shadow: var(--tb-raise); color: var(--tb-text); }
.tb-toast { background: var(--tb-raised); color: var(--tb-text); border: 1px solid var(--tb-border-strong); border-radius: var(--tb-radius); box-shadow: var(--tb-raise), var(--tb-drop); font-weight: 700; }
.tb-drag-ghost { border-color: var(--tb-border-strong); box-shadow: var(--tb-raise), var(--tb-drop); }

/* dialogs: a window with a title bar */
.tb-dialog { border: 1px solid var(--tb-border-strong); border-radius: var(--tb-radius); box-shadow: var(--tb-raise), var(--tb-drop); animation: none; }
.tb-dialog-head { margin: 3px 3px 0; padding: var(--tb-space-1) var(--tb-space-1) var(--tb-space-1) var(--tb-space-4); background: linear-gradient(90deg, var(--tb-primary), color-mix(in oklch, var(--tb-primary) 60%, var(--tb-bevel-hi))); color: var(--tb-on-primary); }
.tb-dialog-title { font-size: 14px; }
.tb-dialog-close, .tb-dialog-close:hover { width: 24px; height: 24px; font-size: 16px; border: 1px solid var(--tb-border-strong); background: var(--tb-face); color: var(--tb-text); box-shadow: var(--tb-raise); }
.tb-dialog-close:focus-visible { box-shadow: var(--tb-raise), var(--tb-ring); }
.tb-dialog-body { padding-top: var(--tb-space-5); }
`,
  cupertino: String.raw`
/* cupertino: recalls the Mac: small controls on a light window, labels to the right, segmented tabs, translucent menus */
body { font-size: 13px; }
.tb-title { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
.tb-heading { font-size: 17px; font-weight: 700; }
.tb-panel { border-radius: 10px; border-color: var(--tb-border); box-shadow: none; padding: var(--tb-space-5); }
.tb-panel > .tb-panel-title { font-size: 13px; font-weight: 700; }
.tb-label { font-size: 13px; font-weight: 400; }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-field > .tb-label { text-align: right; }
@container (max-width: 420px) { :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel) > .tb-field > .tb-label { text-align: left; } }
.tb-button { font-size: 13px; font-weight: 400; padding: 0 var(--tb-space-4); border: 0; border-radius: 6px; background: var(--tb-surface); box-shadow: 0 0 0 1px var(--tb-border), var(--tb-shadow-1); }
.tb-button:hover { background: var(--tb-surface); }
.tb-button:active:not(:disabled, [aria-disabled="true"]) { background: var(--tb-border); }
.tb-button:focus-visible { box-shadow: 0 0 0 1px var(--tb-border), 0 0 0 4px var(--tb-focus-ring); }
.tb-button.tb-primary, .tb-button.tb-primary:hover, .tb-button.tb-primary[aria-disabled="true"]:hover { background: linear-gradient(color-mix(in oklch, var(--tb-primary) 85%, var(--tb-on-primary)), var(--tb-primary)); box-shadow: var(--tb-shadow-1); }
.tb-button.tb-primary:active:not(:disabled, [aria-disabled="true"]) { background: var(--tb-primary-hover); }
.tb-button.tb-primary:focus-visible { box-shadow: 0 0 0 4px var(--tb-focus-ring); }
.tb-toolbar { background: transparent; border: 0; padding: 0; }
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger) { box-shadow: none; }
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger):hover { background: var(--tb-border); }
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger):focus-visible { box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-input { border-radius: 5px; border-color: var(--tb-border-strong); }
/* a choice is a pop-up button: the arrow in a small square of the primary color */
select.tb-input {
  border: 0;
  border-radius: 6px;
  box-shadow: 0 0 0 1px var(--tb-border), var(--tb-shadow-1);
  background-image: linear-gradient(45deg, transparent 50%, var(--tb-on-primary) 50%), linear-gradient(135deg, var(--tb-on-primary) 50%, transparent 50%), linear-gradient(var(--tb-primary), var(--tb-primary));
  background-position: calc(100% - 15px) 45%, calc(100% - 11px) 45%, calc(100% - 4px) 50%;
  background-size: 4px 4px, 4px 4px, 20px calc(100% - 8px);
  padding-right: 34px;
}
select.tb-input:focus { box-shadow: 0 0 0 1px var(--tb-border), 0 0 0 4px var(--tb-focus-ring); }
.tb-tablist { align-self: center; gap: 0; padding: 2px; border-radius: 7px; background: var(--tb-border); box-shadow: none; }
.tb-tab { min-height: 24px; padding: 0 var(--tb-space-4); border: 0; border-radius: 5px; font-size: 13px; font-weight: 400; color: var(--tb-text); }
.tb-tab[aria-selected="true"] { background: var(--tb-segment); color: var(--tb-text); box-shadow: var(--tb-shadow-1); }
.tb-tab:focus-visible { box-shadow: 0 0 0 3px var(--tb-focus-ring); border-radius: 5px; }
.tb-table-wrap { border-radius: 8px; box-shadow: none; }
.tb-table th { background: var(--tb-surface); color: var(--tb-text); font-size: 12px; font-weight: 400; padding: 6px var(--tb-space-3); }
.tb-sort { padding: 6px var(--tb-space-3); }
@media (min-width: 641px) {
  .tb-table th:not(:last-child) { box-shadow: inset -1px 0 0 var(--tb-border); }
  .tb-table td { height: auto; padding: 6px var(--tb-space-3); border-bottom: 0; }
  .tb-table tbody tr:nth-child(even) { background: var(--tb-bg); }
}
.tb-list { padding: 4px; box-shadow: none; }
.tb-list > li { border-bottom: 0; border-radius: 6px; }
.tb-selectable :is(tbody > tr, .tb-list > li).tb-selected, .tb-tree li.tb-selected > .tb-tree-row { background: var(--tb-primary); color: var(--tb-on-primary); }
.tb-list > li.tb-selected .tb-list-secondary, .tb-tree li.tb-selected > .tb-tree-row .tb-tree-toggle { color: inherit; }
.tb-tree-row { border-radius: 6px; }
.tb-menu, .tb-lookup-list { padding: 5px; border-radius: 8px; background: color-mix(in oklch, var(--tb-raised) 82%, transparent); -webkit-backdrop-filter: blur(24px) saturate(1.6); backdrop-filter: blur(24px) saturate(1.6); animation: none; }
.tb-menu-item { min-height: 24px; border-radius: 5px; font-size: 13px; }
.tb-menu-item:focus, .tb-lookup-option:hover, .tb-lookup-option[aria-selected="true"] { background: var(--tb-primary); color: var(--tb-on-primary); }
.tb-menu-item:focus svg { color: inherit; }
.tb-calendar { border-radius: 10px; }
/* dialogs: a sheet with its title centred, closed by a red dot on the left */
.tb-dialog { border: 1px solid var(--tb-border); border-radius: 12px; }
.tb-dialog-head { position: relative; justify-content: center; padding: var(--tb-space-3) var(--tb-space-6) 0; }
.tb-dialog-title { font-size: 13px; font-weight: 700; }
.tb-dialog-close, .tb-dialog-close:hover { position: absolute; left: 12px; top: 12px; width: 14px; height: 14px; border-radius: 50%; background: var(--tb-danger); color: transparent; font-size: 12px; line-height: 14px; }
.tb-dialog-close:hover { color: var(--tb-on-danger); }
.tb-toast { border-radius: 10px; background: color-mix(in oklch, var(--tb-text) 80%, transparent); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); }
.tb-scroll { border-radius: 8px; background: var(--tb-surface); }
`,
  fusion: String.raw`
/* fusion: recalls Qt: group boxes with their title on the frame, buttons with a gentle gradient, tab widgets in a frame */
.tb-title { font-size: 24px; font-weight: 600; letter-spacing: 0; }
.tb-heading { font-size: 18px; font-weight: 600; letter-spacing: 0; }
.tb-label { font-weight: 400; }
.tb-panel { position: relative; margin-top: var(--tb-space-2); padding: var(--tb-space-5) var(--tb-space-4) var(--tb-space-4); background: transparent; border: 1px solid var(--tb-border-strong); border-radius: 3px; box-shadow: none; }
.tb-panel > .tb-panel-title { position: absolute; top: 0; left: var(--tb-space-3); transform: translateY(-50%); padding: 0 var(--tb-space-1); background: var(--tb-bg); font-size: 14px; font-weight: 600; line-height: 1.2; }
.tb-dialog .tb-panel > .tb-panel-title { background: var(--tb-raised); }
.tb-button { font-weight: 400; padding: 0 var(--tb-space-4); border: 1px solid var(--tb-border-strong); border-radius: 3px; background: linear-gradient(var(--tb-face-hi), var(--tb-face-lo)); box-shadow: none; transition: none; }
.tb-button:hover { background: linear-gradient(var(--tb-face-hi), var(--tb-face-hi)); border-color: var(--tb-border-strong); }
.tb-button:active:not(:disabled, [aria-disabled="true"]) { background: var(--tb-face-lo); box-shadow: inset 0 1px 2px var(--tb-border-strong); }
.tb-button:focus-visible { border-color: var(--tb-focus); box-shadow: 0 0 0 2px var(--tb-focus-ring); }
/* the default button is framed in the primary color; danger and accent color their text */
.tb-button.tb-primary, .tb-button.tb-primary:hover, .tb-button.tb-primary[aria-disabled="true"]:hover { background: linear-gradient(color-mix(in oklch, var(--tb-primary) 12%, var(--tb-face-hi)), color-mix(in oklch, var(--tb-primary) 22%, var(--tb-face-lo))); border-color: var(--tb-primary); color: var(--tb-text); font-weight: 600; box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--tb-primary) 35%, transparent); }
.tb-button.tb-primary:hover:not(:disabled, [aria-disabled="true"]) { background: linear-gradient(color-mix(in oklch, var(--tb-primary) 8%, var(--tb-face-hi)), color-mix(in oklch, var(--tb-primary) 14%, var(--tb-face-hi))); }
.tb-button.tb-primary:focus-visible { box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--tb-primary) 35%, transparent), 0 0 0 2px var(--tb-focus-ring); }
.tb-button.tb-danger, .tb-button.tb-accent { background: linear-gradient(var(--tb-face-hi), var(--tb-face-lo)); color: var(--tb-danger); border-color: var(--tb-border-strong); }
.tb-button.tb-accent { color: var(--tb-accent); }
.tb-toolbar { padding: 2px; background: linear-gradient(var(--tb-face-hi), var(--tb-face-lo)); border-color: var(--tb-border); border-radius: 0; }
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger):hover { background: var(--tb-face-hi); border-color: var(--tb-border-strong); }
.tb-input { border-radius: 2px; border-color: var(--tb-border-strong); box-shadow: inset 0 1px 1px var(--tb-border); }
.tb-input:focus, .tb-rich-box:focus { border-color: var(--tb-focus); box-shadow: 0 0 0 1px var(--tb-focus); }
.tb-invalid .tb-input:focus { box-shadow: 0 0 0 1px var(--tb-danger); }
.tb-input[readonly] { box-shadow: none; }
select.tb-input {
  border-radius: 3px;
  background-image: linear-gradient(45deg, transparent 50%, var(--tb-text) 50%), linear-gradient(135deg, var(--tb-text) 50%, transparent 50%), linear-gradient(var(--tb-face-hi), var(--tb-face-lo));
  background-position: calc(100% - 16px) 50%, calc(100% - 11px) 50%, 0 0;
  background-size: 5px 5px, 5px 5px, 100% 100%;
  box-shadow: none;
}
select.tb-input:focus { box-shadow: 0 0 0 2px var(--tb-focus-ring); }
/* tabs: a tab widget, the chosen tab open onto a framed page */
.tb-tabs { gap: 0; }
.tb-tablist { position: relative; z-index: 1; gap: 0; margin-bottom: -1px; padding-left: 2px; box-shadow: none; }
.tb-tab { min-height: 30px; margin: 3px -1px 0 0; padding: 0 var(--tb-space-4); border: 1px solid var(--tb-border-strong); border-radius: 3px 3px 0 0; background: linear-gradient(var(--tb-face-hi), var(--tb-face-lo)); color: var(--tb-text); font-weight: 400; }
.tb-tab[aria-selected="true"] { margin-top: 0; min-height: 33px; background: var(--tb-bg); border-bottom-color: var(--tb-bg); color: var(--tb-text); }
.tb-tab-panel { padding: var(--tb-space-4); border: 1px solid var(--tb-border-strong); border-radius: 0 3px 3px 3px; }
.tb-table-wrap, .tb-list { border-color: var(--tb-border-strong); border-radius: 2px; box-shadow: none; }
.tb-table th { color: var(--tb-text); font-weight: 400; padding: 4px var(--tb-space-3); background: linear-gradient(var(--tb-face-hi), var(--tb-face-lo)); border-bottom: 1px solid var(--tb-border-strong); }
.tb-sort { padding: 4px var(--tb-space-3); }
@media (min-width: 641px) {
  .tb-table th { border-right: 1px solid var(--tb-border-strong); }
  .tb-table td { height: 30px; padding: 4px var(--tb-space-3); border-right: 1px solid var(--tb-border); }
  .tb-table tr > :last-child { border-right: 0; }
}
.tb-list > li { padding: var(--tb-space-2) var(--tb-space-3); }
.tb-selectable :is(tbody > tr, .tb-list > li).tb-selected, .tb-tree li.tb-selected > .tb-tree-row { background: var(--tb-primary); color: var(--tb-on-primary); }
.tb-list > li.tb-selected .tb-list-secondary, .tb-tree li.tb-selected > .tb-tree-row .tb-tree-toggle { color: inherit; }
.tb-tree-row { border-radius: 0; }
.tb-progress { height: 20px; border: 1px solid var(--tb-border-strong); border-radius: 3px; background: var(--tb-surface); }
.tb-progress-bar { border-radius: 2px; background-image: repeating-linear-gradient(-45deg, transparent 0 6px, color-mix(in oklch, var(--tb-surface) 22%, transparent) 6px 12px); }
.tb-menu, .tb-lookup-list, .tb-calendar { padding: 2px; border-color: var(--tb-border-strong); border-radius: 2px; box-shadow: var(--tb-shadow-2); animation: none; }
.tb-menu-item, .tb-lookup-option { min-height: 28px; border-radius: 0; }
.tb-menu-item:focus, .tb-lookup-option:hover, .tb-lookup-option[aria-selected="true"] { background: var(--tb-primary); color: var(--tb-on-primary); }
.tb-menu-item:focus svg { color: inherit; }
.tb-dialog { border: 1px solid var(--tb-border-strong); border-radius: 3px; }
.tb-dialog-head { padding: 4px 4px 4px var(--tb-space-4); background: linear-gradient(var(--tb-face-hi), var(--tb-face-lo)); border-bottom: 1px solid var(--tb-border-strong); }
.tb-dialog-title { font-size: 14px; font-weight: 600; }
.tb-dialog-close { width: 28px; height: 28px; font-size: 18px; border-radius: 3px; }
.tb-dialog-body { padding-top: var(--tb-space-5); }
/* a toast is a tooltip */
.tb-toast { background: color-mix(in oklch, var(--tb-warning) 22%, var(--tb-surface)); color: var(--tb-text); border: 1px solid var(--tb-border-strong); border-radius: 2px; box-shadow: var(--tb-shadow-2); font-weight: 400; }
.tb-scroll { background: var(--tb-surface); border-color: var(--tb-border-strong); border-radius: 2px; }
`,
  fluent: String.raw`
/* fluent: recalls Windows 11: white layers on a calm window, a darker stroke under controls, accent pills for what is chosen */
.tb-title { font-size: 28px; font-weight: 600; letter-spacing: 0; }
.tb-heading { font-size: 20px; font-weight: 600; letter-spacing: 0; }
.tb-panel > .tb-panel-title { font-size: 16px; font-weight: 600; letter-spacing: 0; }
.tb-label { font-weight: 400; }
.tb-panel { border-color: var(--tb-border); border-radius: 8px; box-shadow: none; }
.tb-button { font-weight: 400; border: 1px solid var(--tb-border); border-bottom-color: var(--tb-border-strong); border-radius: 4px; box-shadow: none; }
.tb-button:hover { background: var(--tb-bg); border-color: var(--tb-border); border-bottom-color: var(--tb-border-strong); }
.tb-button:active:not(:disabled, [aria-disabled="true"]) { color: var(--tb-muted); }
.tb-button:focus-visible { box-shadow: 0 0 0 1px var(--tb-surface), 0 0 0 3px var(--tb-focus-ring); }
.tb-button.tb-primary { border-color: color-mix(in oklch, var(--tb-primary) 88%, var(--tb-on-primary)); border-bottom-color: color-mix(in oklch, var(--tb-primary) 70%, var(--tb-text)); box-shadow: none; }
.tb-button.tb-primary:focus-visible { box-shadow: 0 0 0 1px var(--tb-surface), 0 0 0 3px var(--tb-focus-ring); }
.tb-toolbar { background: var(--tb-raised); border-color: var(--tb-border); border-radius: 8px; }
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger):hover { background: var(--tb-subtle); }
/* a field: a quiet frame with a darker line under it, which turns into the accent while typing */
.tb-input { border-color: var(--tb-border); border-radius: 4px; box-shadow: inset 0 -1px 0 var(--tb-muted); }
.tb-input:hover { border-color: var(--tb-border); }
.tb-input:focus, .tb-rich-box:focus { border-color: var(--tb-border); box-shadow: inset 0 -2px 0 var(--tb-primary); }
.tb-invalid .tb-input, .tb-invalid .tb-input:focus { box-shadow: inset 0 -2px 0 var(--tb-danger); }
.tb-input[readonly] { box-shadow: none; }
select.tb-input { border-bottom-color: var(--tb-border-strong); box-shadow: none; }
select.tb-input:focus { box-shadow: 0 0 0 1px var(--tb-surface), 0 0 0 3px var(--tb-focus-ring); }
.tb-switch input { width: 40px; border: 1px solid var(--tb-muted); background: transparent; }
.tb-switch input::before { top: 3px; left: 3px; width: 12px; height: 12px; background: var(--tb-muted); box-shadow: none; }
.tb-switch input:checked { border-color: var(--tb-primary); }
.tb-switch input:checked::before { transform: translateX(20px); background: var(--tb-on-primary); }
.tb-switch input:focus-visible { box-shadow: 0 0 0 1px var(--tb-surface), 0 0 0 3px var(--tb-focus-ring); }
/* tabs: plain words; a short pill of the accent under the chosen one */
.tb-tablist { gap: var(--tb-space-1); box-shadow: none; }
.tb-tab { position: relative; border-bottom: 0; border-radius: 4px; font-weight: 400; color: var(--tb-muted); }
.tb-tab:hover { background: var(--tb-subtle); }
.tb-tab[aria-selected="true"] { color: var(--tb-text); font-weight: 600; }
.tb-tab[aria-selected="true"]::after { content: ""; position: absolute; left: calc(50% - 8px); bottom: 3px; width: 16px; height: 3px; border-radius: 2px; background: var(--tb-primary); }
.tb-tab:focus-visible { box-shadow: 0 0 0 3px var(--tb-focus-ring); }
/* what is chosen: a shade of the text, and a pill of the accent at its left */
.tb-table-wrap { border-radius: 8px; box-shadow: none; }
.tb-table th { background: var(--tb-surface); color: var(--tb-text); }
.tb-list { padding: 4px; border-radius: 8px; box-shadow: none; }
.tb-list > li { position: relative; border-bottom: 0; border-radius: 4px; }
.tb-tree-row { position: relative; border-radius: 4px; }
.tb-selectable :is(tbody > tr, .tb-list > li).tb-selected, .tb-tree li.tb-selected > .tb-tree-row { background: var(--tb-subtle); }
.tb-tree li.tb-selected > .tb-tree-row { font-weight: 400; }
.tb-list > li.tb-selected::before, .tb-tree li.tb-selected > .tb-tree-row::before { content: ""; position: absolute; left: 0; top: calc(50% - 8px); width: 3px; height: 16px; border-radius: 2px; background: var(--tb-primary); }
.tb-selectable tbody > tr.tb-selected > td:first-child { box-shadow: inset 3px 0 0 var(--tb-primary); }
.tb-selectable :is(tbody > tr, .tb-list > li):hover { background: var(--tb-subtle); }
.tb-progress { height: 3px; border-radius: 2px; background: linear-gradient(var(--tb-muted), var(--tb-muted)) center / 100% 1px no-repeat; }
.tb-menu, .tb-lookup-list, .tb-calendar { padding: 4px; border-radius: 8px; }
.tb-menu-item, .tb-lookup-option { min-height: 32px; border-radius: 4px; }
.tb-menu-item:focus, .tb-lookup-option:hover, .tb-lookup-option[aria-selected="true"] { background: var(--tb-subtle); }
.tb-dialog { border: 1px solid var(--tb-border); border-radius: 8px; }
.tb-dialog-head { padding: var(--tb-space-5) var(--tb-space-3) 0 var(--tb-space-6); }
.tb-dialog-title { font-size: 20px; font-weight: 600; letter-spacing: 0; }
.tb-toast { background: var(--tb-raised); color: var(--tb-text); border: 1px solid var(--tb-border); border-radius: 8px; font-weight: 400; }
.tb-scroll { border-radius: 8px; }
`,
};
