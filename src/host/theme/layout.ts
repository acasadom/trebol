// Component rules of the theme: the page itself, and the faces that lay others out: view, column, row, desktop, tiles, grid, panel, texts.
// Only token variables appear here, never raw values of color.

export const LAYOUT = String.raw`
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; }
/* a screen is narrow by the width it has, not the window's: the page's, or a device frame's */
body { container: tb-screen / inline-size; }
/* a container keeps its background to itself: the page takes it, as it takes the body's otherwise */
html { background: var(--tb-bg); }
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
/* a screen on show while its on-enter still loads: what has no data yet is a gray bar */
.tb-screens[data-tb-loading] :is(.tb-title, .tb-heading, .tb-text):empty::before {
  content: ""; display: inline-block; vertical-align: middle; width: 14em; max-width: 100%; height: 0.8lh;
  border-radius: var(--tb-radius); background: color-mix(in srgb, var(--tb-muted) 22%, transparent); animation: tb-skeleton 1.2s ease-in-out infinite;
}
.tb-screens[data-tb-loading] .tb-text:empty::before { width: 24em; }
.tb-screens[data-tb-loading] .tb-empty:not([hidden]) {
  color: transparent; min-height: 9em; margin: var(--tb-space-4);
  background: repeating-linear-gradient(to bottom, color-mix(in srgb, var(--tb-muted) 22%, transparent) 0 1.25em, transparent 1.25em 2.75em);
  animation: tb-skeleton 1.2s ease-in-out infinite;
}
@keyframes tb-skeleton { 50% { opacity: 0.5; } }
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
.tb-view:has(.tb-fit:not(.tb-device .tb-fit)) { height: 100dvh; box-sizing: border-box; }
/* a device: its screen at its own size, made smaller to fit; the narrow rules go by its width */
.tb-device { width: 100%; max-width: var(--tb-device-w, 390px); min-width: 0; margin-inline: auto; contain: inline-size; overflow: hidden; }
.tb-device-screen {
  container: tb-screen / inline-size;
  width: var(--tb-device-w, 390px);
  height: var(--tb-device-h, 844px);
  transform: scale(var(--tb-device-k, 1));
  transform-origin: 0 0;
  overflow: auto;
  background: var(--tb-bg);
  color: var(--tb-text);
  border: var(--tb-line) solid var(--tb-border-strong);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-1);
}
.tb-device-screen > .tb-view:has(.tb-fit) { height: 100%; }
.tb-fit { flex: 1 1 auto; min-height: 0; }
.tb-fit > * { min-height: 0; overflow: auto; }
.tb-fit > * > * { flex-shrink: 0; }
/* a face with fit inside a pane of a fit grid takes the height the pane has left (a chat's messages above its box) */
.tb-fit > * > .tb-fit { flex: 1 1 0; }
.tb-scroll.tb-fit { max-height: none; }
/* a widget with fit: its element takes the height left, and scrolls itself (a code editor, a map) */
.tb-field.tb-fit > .tb-control { flex: 1 1 auto; overflow: hidden; }
.tb-field.tb-fit > .tb-control > .tb-widget { flex: 1 1 auto; min-height: 0; }
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
.tb-tile { position: relative; }
/* a tile's second icon (mark #list): small, at the bottom right of its icon, on a disc of the background */
.tb-tile-mark {
  position: absolute;
  top: calc(var(--tb-space-3) + 19px);
  left: calc(50% + 5px);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--tb-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.tb-tile-mark > svg { width: 14px; height: 14px; color: var(--tb-text); }
.tb-tile:hover > .tb-tile-mark { background: var(--tb-surface); }
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
/* the face chosen in an inert face with on-select, as on a designer's canvas */
.tb-picked { outline: 2px solid var(--tb-primary); outline-offset: 2px; border-radius: var(--tb-radius); }
.tb-grid { --tb-track-small: 240px; --tb-track-medium: 280px; --tb-track-large: 360px; --tb-tracks: initial; --tb-cols: 2; display: grid; gap: var(--tb-space-4); grid-template-columns: var(--tb-tracks, repeat(var(--tb-cols), minmax(0, 1fr))); }
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
.tb-code {
  margin: 0; box-sizing: border-box; contain: inline-size; /* a long line scrolls; it never widens what holds it */
  padding: var(--tb-space-3) var(--tb-space-4); overflow-x: auto; white-space: pre; tab-size: 4;
  font-family: var(--tb-mono); font-size: 13px; line-height: 1.55;
  background: var(--tb-surface); border: var(--tb-line) solid var(--tb-border); border-radius: var(--tb-radius);
}
.tb-small { font-size: 13px; }
.tb-muted { color: var(--tb-muted); }
.tb-text.tb-danger { color: var(--tb-danger); }
.tb-text.tb-success { color: var(--tb-success); }
.tb-text.tb-primary { color: var(--tb-primary); }

`;
