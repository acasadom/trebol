// Component rules of the theme: narrow screens, paper, motion between screens, touch and less motion.
// Only token variables appear here, never raw values of color.

export const RESPONSIVE = String.raw`
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
  .tb-steps-title { display: none; }
  .tb-steps-count { display: block; }
  .tb-form > .tb-steps > .tb-steps-nav { grid-column: 1 / -1; }
  :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field { display: flex; }
  :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field > .tb-label, :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field > .tb-control,
  :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-actions, :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-check-row { grid-column: 1; padding-top: 0; }
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
  .tb-swipe :is(tbody tr, .tb-list > li) { touch-action: pan-y; }
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
  .tb-dialog.tb-palette { width: 100vw; max-height: 100dvh; margin: 0; }
}
@media print {
  .tb-toasts, .tb-dialog:not([open]) { display: none !important; }
  /* print-page/only: the face alone, at the top of the page, with what holds it out of sight */
  .tb-print-only body * { visibility: hidden; }
  .tb-print-only .tb-print-target, .tb-print-only .tb-print-target * { visibility: visible; }
  .tb-print-only .tb-print-target { position: absolute; inset: 0 0 auto 0; margin: 0; box-shadow: none; }
}
/* a screen that gives way to another slides the way the user went (motion.ts) */
::view-transition-group(*) { animation-duration: var(--tb-move); animation-timing-function: var(--tb-ease); }
::view-transition-old(tb-screen) { animation: var(--tb-move) var(--tb-ease) both tb-screen-out; }
::view-transition-new(tb-screen) { animation: var(--tb-move) var(--tb-ease) both tb-screen-in; }
:root[data-tb-travel="back"]::view-transition-old(tb-screen) { animation-name: tb-screen-out-back; }
:root[data-tb-travel="back"]::view-transition-new(tb-screen) { animation-name: tb-screen-in-back; }
@keyframes tb-screen-out { to { opacity: 0; transform: translateX(calc(-1 * var(--tb-travel-x))); } }
@keyframes tb-screen-in { from { opacity: 0; transform: translateX(var(--tb-travel-x)); } }
@keyframes tb-screen-out-back { to { opacity: 0; transform: translateX(var(--tb-travel-x)); } }
@keyframes tb-screen-in-back { from { opacity: 0; transform: translateX(calc(-1 * var(--tb-travel-x))); } }
:root { --tb-travel-x: 32px; }
:root[dir="rtl"] { --tb-travel-x: -32px; }
.tb-leaving { pointer-events: none; z-index: 1; }
@media (pointer: coarse) { :root { --tb-control: 44px; } }
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
  .tb-indeterminate .tb-progress-bar { width: 100%; opacity: 0.35; }
}
`;
