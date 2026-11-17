// Component rules of the theme: tabs, steps and splits.
// Only token variables appear here, never raw values of color.

export const PANES = String.raw`
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

/* steps: one step at a time under a bar of numbered titles; the steps done can be chosen again */
.tb-steps { display: flex; flex-direction: column; gap: var(--tb-space-5); min-width: 0; }
.tb-steps-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-2) var(--tb-space-3); margin: 0; padding: 0; list-style: none; }
.tb-steps-bar > li:not([hidden]) { display: flex; align-items: center; gap: var(--tb-space-3); }
.tb-steps-bar > li:not([hidden]) ~ li:not([hidden])::before { content: ""; width: var(--tb-space-6); height: 1px; background: var(--tb-border-strong); }
.tb-steps-bar > li[hidden] { display: none; }
.tb-steps-item {
  display: inline-flex;
  align-items: center;
  gap: var(--tb-space-2);
  min-height: var(--tb-control);
  padding: 0 var(--tb-space-1);
  border: 0;
  border-radius: var(--tb-radius);
  background: transparent;
  color: var(--tb-muted);
  font: inherit;
  font-size: 14px;
  font-weight: 550;
  white-space: nowrap;
  cursor: pointer;
}
.tb-steps-item:disabled { cursor: default; }
.tb-steps-item:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-steps-num {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--tb-border-strong);
  border-radius: 50%;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  transition: background var(--tb-fast) var(--tb-ease), border-color var(--tb-fast) var(--tb-ease), color var(--tb-fast) var(--tb-ease);
}
.tb-steps-bar .tb-done .tb-steps-item { color: var(--tb-text); }
.tb-steps-bar .tb-done .tb-steps-item:hover .tb-steps-title { text-decoration: underline; text-underline-offset: 3px; }
.tb-steps-bar .tb-done .tb-steps-num { background: var(--tb-primary); border-color: var(--tb-primary); color: var(--tb-on-primary); }
.tb-steps-bar .tb-current .tb-steps-item { color: var(--tb-text); }
.tb-steps-bar .tb-current .tb-steps-num { border: 2px solid var(--tb-primary); color: var(--tb-primary); font-weight: 650; }
.tb-steps-count { display: none; margin: 0; font-size: 14px; color: var(--tb-muted); }
.tb-step-panel { display: flex; flex-direction: column; row-gap: var(--tb-space-4); min-width: 0; }
.tb-step-panel:focus { outline: none; }
.tb-steps > .tb-step-panel[hidden], .tb-form > .tb-steps > .tb-step-panel[hidden] { display: none; }
.tb-steps-nav { justify-content: flex-end; }
.tb-steps-nav > :first-child:not(.tb-hidden) { margin-inline-end: auto; }
/* narrow: the numbers alone, and a line that says which step this is */
@container (max-width: 420px) {
  .tb-steps-title { display: none; }
  .tb-steps-count { display: block; }
  .tb-form > .tb-steps > .tb-steps-nav { grid-column: 1 / -1; }
}

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

`;
