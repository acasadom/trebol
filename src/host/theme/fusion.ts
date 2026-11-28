// What the fusion skin changes on top of the component rules.

export const FUSION = String.raw`
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
.tb-button.tb-danger, .tb-button.tb-accent { background: linear-gradient(var(--tb-face-hi), var(--tb-face-lo)); color: var(--tb-danger-face); border-color: var(--tb-border-strong); }
.tb-button.tb-accent { color: var(--tb-accent-face); }
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
@container tb-screen (min-width: 641px) {
  .tb-table th { border-right: 1px solid var(--tb-border-strong); }
  .tb-table td { height: 30px; padding: 4px var(--tb-space-3); border-right: 1px solid var(--tb-border); }
  .tb-table tr > :last-child { border-right: 0; }
}
.tb-list > li { padding: var(--tb-space-2) var(--tb-space-3); }
.tb-selectable :is(tbody > tr, .tb-list > li).tb-selected, .tb-tree li.tb-selected > .tb-tree-row { background: var(--tb-primary); color: var(--tb-on-primary); }
.tb-selectable :is(tbody > tr, .tb-list > li).tb-selected [data-tb-role], .tb-tree li.tb-selected > .tb-tree-row [data-tb-role] { color: inherit; }
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
`;
