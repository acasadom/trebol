// What the cupertino skin changes on top of the component rules.

export const CUPERTINO = String.raw`
/* cupertino: recalls the Mac: small controls on a light window, labels to the right, segmented tabs, translucent menus */
body { font-size: 13px; }
.tb-title { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
.tb-heading { font-size: 17px; font-weight: 700; }
.tb-panel { border-radius: 10px; border-color: var(--tb-border); box-shadow: none; padding: var(--tb-space-5); }
.tb-panel > .tb-panel-title { font-size: 13px; font-weight: 700; }
.tb-label { font-size: 13px; font-weight: 400; }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field > .tb-label { text-align: right; }
@container (max-width: 420px) { :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field > .tb-label { text-align: left; } }
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
`;
