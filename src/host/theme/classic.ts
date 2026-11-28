// What the classic skin changes on top of the component rules.

export const CLASSIC = String.raw`
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
/* a slider runs in a sunken groove under a raised handle */
.tb-range::-webkit-slider-runnable-track { border-radius: var(--tb-radius); box-shadow: var(--tb-sink); }
.tb-range::-moz-range-track { border-radius: var(--tb-radius); box-shadow: var(--tb-sink); }
.tb-range::-webkit-slider-thumb { width: 12px; border: 0; border-radius: var(--tb-radius); background: var(--tb-face); box-shadow: var(--tb-raise), 0 0 0 1px var(--tb-border-strong); }
.tb-range::-moz-range-thumb { width: 12px; border: 0; border-radius: var(--tb-radius); background: var(--tb-face); box-shadow: var(--tb-raise), 0 0 0 1px var(--tb-border-strong); }
.tb-range:focus-visible::-webkit-slider-thumb { box-shadow: var(--tb-raise), 0 0 0 1px var(--tb-border-strong), var(--tb-ring); }
.tb-range:focus-visible::-moz-range-thumb { box-shadow: var(--tb-raise), 0 0 0 1px var(--tb-border-strong), var(--tb-ring); }
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
@container tb-screen (min-width: 641px) {
  .tb-table td { padding: var(--tb-space-2) var(--tb-space-3); border-right: 1px solid var(--tb-border); }
  .tb-table th { border-right: 1px solid var(--tb-border-strong); }
  .tb-table tr > :last-child { border-right: 0; }
}
.tb-selectable :is(tbody > tr, .tb-list > li).tb-selected, .tb-tree li.tb-selected > .tb-tree-row { background: var(--tb-primary); color: var(--tb-on-primary); }
.tb-selectable :is(tbody > tr, .tb-list > li).tb-selected [data-tb-role], .tb-tree li.tb-selected > .tb-tree-row [data-tb-role] { color: inherit; }
.tb-list > li.tb-selected .tb-list-secondary, .tb-tree li.tb-selected > .tb-tree-row .tb-tree-toggle { color: inherit; }
.tb-selectable tbody tr.tb-selected:focus-visible, .tb-selectable .tb-list > li.tb-selected:focus-visible { box-shadow: inset 0 0 0 2px var(--tb-focus), inset 0 0 0 3px var(--tb-on-primary); }
.tb-tree-row { border-radius: 0; }

/* tabs: raised tabs on a line, all labelled in the text color; the chosen one is taller and opens onto what it shows */
.tb-tablist { gap: 2px; padding: 0 var(--tb-space-2); box-shadow: inset 0 -1px 0 var(--tb-border-strong); }
.tb-tab { font-size: 13px; font-weight: 700; min-height: calc(var(--tb-control) - 4px); margin-top: 4px; border: 1px solid var(--tb-border-strong); border-bottom: 0; border-radius: var(--tb-radius) var(--tb-radius) 0 0; background: var(--tb-face); color: var(--tb-text); box-shadow: inset 1px 1px 0 var(--tb-bevel-hi); }
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
`;
