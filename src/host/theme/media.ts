// Component rules of the theme: scrolling boxes, images, video and sound, drawings, charts, orbits, progress, widgets and photos.
// Only token variables appear here, never raw values of color.

export const MEDIA = String.raw`
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

`;
