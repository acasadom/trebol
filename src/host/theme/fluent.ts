// What the fluent skin changes on top of the component rules.

export const FLUENT = String.raw`
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
/* a slider: a thin line, and a white handle with a dot of the accent that grows under the pointer */
.tb-range::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(to right, var(--tb-primary) var(--tb-at, 0%), var(--tb-muted) var(--tb-at, 0%)); }
.tb-range::-moz-range-track { height: 4px; border-radius: 2px; background: linear-gradient(to right, var(--tb-primary) var(--tb-at, 0%), var(--tb-muted) var(--tb-at, 0%)); }
.tb-range::-webkit-slider-thumb { margin-top: -8px; border: 0; background: radial-gradient(circle, var(--tb-primary) 0 5px, var(--tb-surface) 5.5px); box-shadow: 0 0 0 1px var(--tb-border), var(--tb-shadow-1); }
.tb-range::-moz-range-thumb { border: 0; background: radial-gradient(circle, var(--tb-primary) 0 5px, var(--tb-surface) 5.5px); box-shadow: 0 0 0 1px var(--tb-border), var(--tb-shadow-1); }
.tb-range:hover::-webkit-slider-thumb { background: radial-gradient(circle, var(--tb-primary) 0 6px, var(--tb-surface) 6.5px); transform: none; }
.tb-range:active::-webkit-slider-thumb { background: radial-gradient(circle, var(--tb-primary) 0 4px, var(--tb-surface) 4.5px); transform: none; }
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
`;
