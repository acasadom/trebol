// The theme: a handful of parameters from which every visual value is
// derived, compiled once into CSS custom properties plus a fixed stylesheet.
//
// Colors are computed in OKLCH. Each role has a fixed lightness per mode,
// chosen so text meets WCAG AA on the backgrounds it is used on; the hue
// comes from the theme (`base`, `accent`, `neutral`). `contrast()` checks it
// and the tests run it over every hue.

import { DRAW_COLORS } from './draw.ts';
import { LAYOUT } from './theme/layout.ts';
import { FORMS } from './theme/forms.ts';
import { NAVIGATION } from './theme/navigation.ts';
import { MEDIA } from './theme/media.ts';
import { DATA } from './theme/data.ts';
import { RAILS } from './theme/rails.ts';
import { DIALOGS } from './theme/dialogs.ts';
import { PANES } from './theme/panes.ts';
import { POPUPS } from './theme/popups.ts';
import { TOASTS } from './theme/toasts.ts';
import { DEVTOOLS } from './theme/devtools.ts';
import { RESPONSIVE } from './theme/responsive.ts';
import { CLASSIC } from './theme/classic.ts';
import { CUPERTINO } from './theme/cupertino.ts';
import { FUSION } from './theme/fusion.ts';
import { FLUENT } from './theme/fluent.ts';

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
  cupertino: { bg: [0.945, 0.23], surface: [1, 0.29], raised: [0.925, 0.26], border: [0.86, 0.37], 'border-strong': [0.76, 0.45], muted: [0.48, 0.74], primary: [0.47, 0.7] },
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

/** The roles a face, a row or a cell is painted in, each with a soft tint and an ink. */
export const INKED = ['danger', 'primary', 'accent', 'success', 'warning', 'muted'] as const;

/** Text/background pairs that must reach WCAG AA (4.5:1), in every skin, hue and mode. */
export const CONTRAST_PAIRS: ReadonlyArray<[Role, Role]> = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'raised'],
  ['muted', 'bg'], ['muted', 'surface'],
  ['on-primary', 'primary'], ['on-primary', 'primary-hover'], ['on-accent', 'accent'], ['on-danger', 'danger'],
  ['danger', 'surface'], ['primary', 'surface'], ['primary', 'bg'], ['primary', 'raised'], ['success', 'surface'],
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
    primary: hue(dark ? 0.8 : 0.44, 0.12, t.base),
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

/**
 * A role's colour made readable as text on `under`: as it is when it already reads at 4.5:1, else darker (or
 * lighter on a dark surface) a step at a time, keeping its hue, until it does.
 */
export function roleInk(c: Oklch, under: Oklch): Oklch {
  const step = under.l > 0.5 ? -0.01 : 0.01;
  let ink = c;
  // with a margin, for the soft tint of a painted row behind it
  while (contrast(ink, under) < 4.7 && ink.l > 0 && ink.l < 1) ink = { ...ink, l: Math.round((ink.l + step) * 100) / 100 };
  return ink;
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
  // the soft tint of each role, behind a row or a card painted in it, and its ink, the role as readable text
  for (const r of INKED) {
    lines.push(`  --tb-${r}-soft: ${css(p[r], dark ? 0.16 : 0.08)};`);
    lines.push(`  --tb-${r}-ink: ${css(roleInk(p[r], p.surface))};`);
  }
  lines.push(`  --tb-overlay: ${css(n0(p), dark ? 0.6 : 0.4)};`);
  lines.push(`  --tb-scrim: ${css(p.bg, scrimAlpha(p))};`);
  const shadow = dark ? '0 0 0 1px oklch(100% 0 0 / 0.06)' : `0 1px 2px ${css(n0(p), 0.06)}`;
  const k = t.depth === 'lifted' ? 2 : 1;
  // a flat look has no shadows, but what floats over the page still needs one
  lines.push(`  --tb-shadow-1: ${t.depth === 'flat' ? 'none' : `${shadow}, 0 ${k}px ${3 * k}px ${css(n0(p), dark ? 0.4 : 0.08)}`};`);
  lines.push(`  --tb-shadow-2: ${t.depth === 'flat' ? 'none' : `${shadow}, 0 ${4 * k}px ${12 * k}px ${css(n0(p), dark ? 0.5 : 0.08)}`};`);
  lines.push(`  --tb-shadow-3: ${shadow}, 0 ${12 * k}px ${32 * k}px ${css(n0(p), dark ? 0.6 : 0.12)};`);
  for (const [name, c] of Object.entries(skinFaces(t, dark))) lines.push(`  --tb-${name}: ${css(c)};`);
  // focus is drawn in the color of the text, and what is hovered or chosen is a shade of it
  if (t.skin === 'fluent') lines.push(`  --tb-focus-ring: ${css(p.text)};`, `  --tb-subtle: ${css(p.text, dark ? 0.08 : 0.06)};`);
  // Red's color words, for drawings and charts: each one light enough, or dark enough, for this mode
  for (const [name, c] of Object.entries(DRAW_COLORS)) lines.push(`  --tb-c-${name}: ${css({ l: dark ? c.dark : c.light, c: c.c, h: c.h })};`);
  lines.push(`  color-scheme: ${dark ? 'dark' : 'light'};`);
  return lines.join('\n');
}

/**
 * The colors a skin paints with besides the roles: faces of buttons and bars, bevels, the ends of a gradient,
 * and a role as text on those faces. test/ui.test.ts checks that what is read on them reaches AA.
 */
export function skinFaces(t: ThemeParams, dark: boolean): Record<string, Oklch> {
  const p = palette(t, dark);
  const g = (l: number): Oklch => ({ l, c: p.bg.c, h: p.bg.h });
  if (t.skin === 'classic') return {
    // the two edges of what stands out or sinks in, and the faces of buttons and bars
    'bevel-hi': g(dark ? 0.5 : 1), 'bevel-lo': g(dark ? 0.15 : 0.55),
    'face-hi': g(dark ? 0.47 : 0.97), 'face-lo': g(dark ? 0.36 : 0.8),
  };
  if (t.skin === 'cupertino') {
    // a button of the primary color is lighter at the top; the chosen segment of a segmented control
    const [top, bottom] = dark ? [p['primary-hover'], p.primary] : [p.primary, p['primary-hover']];
    return { 'primary-top': top, 'primary-bottom': bottom, segment: g(dark ? 0.47 : 1) };
  }
  if (t.skin === 'fusion') {
    const hi = g(dark ? 0.37 : 0.99);
    const lo = g(dark ? 0.32 : 0.91);
    // a button that warns or stands out colors its text, made readable on the whole face
    const worst = dark ? hi : lo;
    return { 'face-hi': hi, 'face-lo': lo, 'danger-face': roleInk(p.danger, worst), 'accent-face': roleInk(p.accent, worst) };
  }
  return {};
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
  lines.push('  --tb-ease: cubic-bezier(0.2, 0, 0, 1);', '  --tb-fast: 150ms;', '  --tb-move: 240ms;');
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

/** Component rules, one file per kind of face under theme/. Only token variables appear there, never raw values of color. */
const COMPONENTS = `\n${[LAYOUT, FORMS, NAVIGATION, MEDIA, DATA, RAILS, DIALOGS, PANES, POPUPS, TOASTS, DEVTOOLS, RESPONSIVE].map(part => part.slice(1)).join('')}`;

/** What a skin changes on top of the component rules: '' for the modern one. */
const SKINS: Record<Skin, string> = { modern: '', classic: CLASSIC, cupertino: CUPERTINO, fusion: FUSION, fluent: FLUENT };
