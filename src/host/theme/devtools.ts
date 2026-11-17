// Component rules of the theme: what trebol dev adds: the panel of errors and the dev tools.
// Only token variables appear here, never raw values of color.

export const DEVTOOLS = String.raw`
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

/* under trebol dev, the dev tools: Faces, Machines, Console, Log */
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
.tb-dev-machines { display: grid; grid-template-columns: minmax(200px, 2fr) 3fr; }
.tb-dev-machine-head { font-weight: 600; }
.tb-dev-on::after { content: " ●"; color: var(--tb-success, var(--tb-primary)); }
.tb-dev-node[aria-current="true"].tb-dev-on::after { color: inherit; }
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
`;
