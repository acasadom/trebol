// Component rules of the theme: forms and what goes in them: fields, text boxes, checks, radios, sliders, buttons, uploads, dates.
// Only token variables appear here, never raw values of color.

export const FORMS = String.raw`
/* forms: labels and controls aligned in two columns */
.tb-form {
  display: grid;
  grid-template-columns: minmax(120px, max-content) minmax(0, 1fr);
  column-gap: var(--tb-space-5);
  row-gap: var(--tb-space-4);
  align-items: start;
  /* a narrow form (in a grid cell, beside another panel) stacks like one on a phone; see @container below */
  container-type: inline-size;
  contain-intrinsic-inline-size: 30rem;
}
/* a panel in a form (a section) keeps the form's two columns */
.tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel { display: grid; grid-template-columns: subgrid; row-gap: var(--tb-space-4); align-items: start; }
/* steps in a form keep its two columns too: the bar spans both, Back and Next go under the controls */
.tb-form > .tb-steps { display: grid; grid-template-columns: subgrid; row-gap: var(--tb-space-5); }
.tb-form > .tb-steps > * { grid-column: 1 / -1; }
.tb-form > .tb-steps > .tb-steps-nav { grid-column: 2; }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > * { grid-column: 1 / -1; }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field { display: contents; }
/* a field of a form chosen on a designer's canvas (inert, on-select) has no box of its own: its control is marked */
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field.tb-picked > .tb-control { outline: 2px solid var(--tb-primary); outline-offset: 4px; border-radius: var(--tb-radius); }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field.tb-picked > .tb-label { color: var(--tb-primary); }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field > .tb-label { grid-column: 1; padding-top: calc((var(--tb-control) - 1.5em) / 2); }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field > .tb-control { grid-column: 2; }
:is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-actions, :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-check-row { grid-column: 2; }
.tb-field { display: flex; flex-direction: column; gap: var(--tb-space-2); min-width: 0; }
@container (max-width: 420px) {
  :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field { display: flex; }
  :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field > .tb-label, :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-field > .tb-control,
  :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-actions, :is(.tb-form, .tb-form > .tb-panel, .tb-form > .tb-panel > .tb-panel, .tb-form > .tb-steps > .tb-step-panel) > .tb-check-row { grid-column: 1 / -1; padding-top: 0; }
}
.tb-rows { display: flex; flex-direction: column; gap: var(--tb-space-3); align-items: stretch; }
.tb-rows > .tb-button { align-self: flex-start; }
.tb-entry { display: flex; gap: var(--tb-space-3); align-items: flex-start; }
.tb-entry > * { flex: 1 1 0; min-width: 0; }
.tb-entry > .tb-button { flex: none; }
/* the labels of the first row are the headers of the others */
.tb-entry:not(:first-child) .tb-field > .tb-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.tb-entry:first-child:has(.tb-label:not(:empty)) > .tb-button { margin-top: calc(14px * 1.5 + var(--tb-space-2)); }
.tb-rich { display: flex; flex-direction: column; gap: var(--tb-space-1); }
.tb-rich-tools { display: flex; flex-wrap: wrap; gap: var(--tb-space-1); }
.tb-rich-tools[hidden], .tb-rich-link[hidden] { display: none; }
.tb-rich-tool { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: var(--tb-radius); background: transparent; color: var(--tb-muted); cursor: pointer; }
.tb-rich-tool:hover { background: var(--tb-primary-soft); color: var(--tb-text); }
.tb-rich-tool:focus-visible { outline: 2px solid var(--tb-primary); outline-offset: 1px; }
.tb-rich-tool .tb-icon { width: 18px; height: 18px; }
.tb-rich-link { display: flex; gap: var(--tb-space-2); align-items: center; }
.tb-input.tb-rich-box { padding: var(--tb-space-2) var(--tb-space-3); min-height: calc(var(--tb-control) * 2.5); overflow-wrap: anywhere; cursor: text; }
.tb-input.tb-rich-box[aria-readonly="true"] { background: color-mix(in srgb, var(--tb-muted) 12%, transparent); border-color: transparent; cursor: default; }
.tb-input.tb-rich-box[aria-disabled="true"] { opacity: 0.45; }
.tb-rich-box:focus { outline: none; border-color: var(--tb-primary); box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-rich-box > :first-child { margin-top: 0; }
.tb-rich-box > :last-child { margin-bottom: 0; }
.tb-rich-box p, .tb-rich-box ul, .tb-rich-box ol { margin: 0 0 var(--tb-space-2); }
.tb-rich-box ul, .tb-rich-box ol { padding-left: var(--tb-space-5); }
.tb-rich-box h1, .tb-rich-box h2, .tb-rich-box h3 { margin: var(--tb-space-3) 0 var(--tb-space-2); line-height: 1.3; font-weight: 600; }
.tb-rich-box h1 { font-size: 22px; }
.tb-rich-box h2 { font-size: 18px; }
.tb-rich-box h3 { font-size: 16px; }
.tb-rich-box a { color: var(--tb-primary); }
.tb-control { display: flex; flex-direction: column; gap: var(--tb-space-1); min-width: 0; }
.tb-label { font-weight: 550; font-size: 14px; color: var(--tb-text); }
.tb-required::after { content: " *"; color: var(--tb-muted); font-weight: 400; }
.tb-input {
  font: inherit;
  color: var(--tb-text);
  background: var(--tb-surface);
  border: var(--tb-line) solid var(--tb-border-strong);
  border-radius: var(--tb-radius);
  min-height: var(--tb-control);
  padding: 0 var(--tb-space-3);
  width: 100%;
  transition: border-color var(--tb-fast) var(--tb-ease), box-shadow var(--tb-fast) var(--tb-ease);
}
textarea.tb-input { padding: var(--tb-space-2) var(--tb-space-3); min-height: calc(var(--tb-control) * 2.5); resize: vertical; }
select.tb-input { appearance: none; background-image: linear-gradient(45deg, transparent 50%, var(--tb-muted) 50%), linear-gradient(135deg, var(--tb-muted) 50%, transparent 50%); background-position: calc(100% - 18px) 50%, calc(100% - 13px) 50%; background-size: 5px 5px; background-repeat: no-repeat; padding-right: var(--tb-space-6); }
.tb-input::placeholder { color: var(--tb-muted); opacity: 0.8; }
.tb-input:hover { border-color: var(--tb-muted); }
.tb-input:focus { outline: none; border-color: var(--tb-primary); box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-input[readonly] { background: color-mix(in srgb, var(--tb-muted) 12%, transparent); border-color: transparent; color: var(--tb-muted); cursor: default; }
.tb-input[readonly]:focus { border-color: var(--tb-muted); box-shadow: none; }
.tb-invalid .tb-input { border-color: var(--tb-danger); }
.tb-invalid .tb-input:focus { box-shadow: 0 0 0 3px var(--tb-danger-soft); }
.tb-error { color: var(--tb-danger); font-size: 13px; min-height: 0; }
.tb-error:empty { display: none; }
.tb-hint { color: var(--tb-muted); font-size: 13px; }
.tb-pending .tb-input { background-image: linear-gradient(90deg, transparent, var(--tb-primary-soft), transparent); background-size: 200% 100%; animation: tb-pending 1.2s linear infinite; }
@keyframes tb-pending { from { background-position: 200% 0; } to { background-position: -200% 0; } }

.tb-check-row { display: flex; }
.tb-check { display: inline-flex; align-items: center; gap: var(--tb-space-3); min-height: var(--tb-control); cursor: pointer; }
.tb-check input { width: 18px; height: 18px; margin: 0; accent-color: var(--tb-primary); cursor: pointer; }
.tb-check input:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); border-radius: 4px; }
.tb-check input[type="radio"]:focus-visible { border-radius: 50%; }
.tb-radios { display: flex; flex-wrap: wrap; column-gap: var(--tb-space-5); }
.tb-radio-group { flex-basis: 100%; }
/* radio segmented: the options as buttons joined in a bar, the chosen one raised; its label only for screen readers */
.tb-segmented { position: relative; }
.tb-segmented > .tb-label { position: absolute; top: 0; left: 0; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.tb-segmented .tb-radios { display: inline-flex; flex-wrap: nowrap; gap: 2px; padding: 3px; background: var(--tb-bg); border: var(--tb-line) solid var(--tb-border); border-radius: var(--tb-radius); }
.tb-segmented .tb-check { position: relative; gap: 0; min-height: calc(var(--tb-control) - 8px); padding: 0 var(--tb-space-4); border-radius: max(0px, calc(var(--tb-radius) - 3px)); color: var(--tb-muted); font-weight: 500; white-space: nowrap; }
.tb-segmented .tb-check input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; }
.tb-segmented .tb-check:hover { color: var(--tb-text); }
.tb-segmented .tb-check:has(input:checked) { background: var(--tb-surface); color: var(--tb-text); box-shadow: var(--tb-shadow-1); }
.tb-segmented .tb-check:has(input:focus-visible) { box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-radio-title { display: block; margin-top: var(--tb-space-2); font-size: 13px; font-weight: 600; color: var(--tb-muted); }
.tb-switch input {
  appearance: none;
  width: 36px;
  height: 20px;
  flex: none;
  border-radius: 10px;
  background: var(--tb-muted);
  position: relative;
  transition: background var(--tb-fast) var(--tb-ease);
}
.tb-switch input::before {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--tb-surface);
  box-shadow: var(--tb-shadow-1);
  transition: transform var(--tb-fast) var(--tb-ease);
}
.tb-switch input:checked { background: var(--tb-primary); }
.tb-switch input:checked::before { transform: translateX(16px); }
.tb-switch input:focus-visible { border-radius: 10px; }
.tb-check input:disabled, .tb-check input:disabled + span { opacity: 0.45; cursor: not-allowed; }

/* a slider: a track filled up to where it stands (--tb-at, set by the host), then its number */
.tb-slider { display: flex; align-items: center; gap: var(--tb-space-3); min-height: var(--tb-control); }
.tb-range { appearance: none; flex: 1; min-width: 0; height: 24px; margin: 0; background: transparent; cursor: pointer; }
.tb-range::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: linear-gradient(to right, var(--tb-primary) var(--tb-at, 0%), var(--tb-border-strong) var(--tb-at, 0%)); }
.tb-range::-moz-range-track { height: 6px; border-radius: 3px; background: linear-gradient(to right, var(--tb-primary) var(--tb-at, 0%), var(--tb-border-strong) var(--tb-at, 0%)); }
.tb-range::-webkit-slider-thumb { appearance: none; width: 20px; height: 20px; margin-top: -7px; border: 2px solid var(--tb-primary); border-radius: 50%; background: var(--tb-surface); box-shadow: var(--tb-shadow-1); transition: transform var(--tb-fast) var(--tb-ease); }
.tb-range::-moz-range-thumb { box-sizing: border-box; width: 20px; height: 20px; border: 2px solid var(--tb-primary); border-radius: 50%; background: var(--tb-surface); box-shadow: var(--tb-shadow-1); transition: transform var(--tb-fast) var(--tb-ease); }
.tb-range:active::-webkit-slider-thumb { transform: scale(1.1); }
.tb-range:active::-moz-range-thumb { transform: scale(1.1); }
.tb-range:focus-visible { outline: none; }
.tb-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-range:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-range:disabled { opacity: 0.45; cursor: not-allowed; }
.tb-slider-value { min-width: 4ch; text-align: end; font-variant-numeric: tabular-nums; font-weight: 600; }
.tb-invalid .tb-range::-webkit-slider-thumb { border-color: var(--tb-danger); }
.tb-invalid .tb-range::-moz-range-thumb { border-color: var(--tb-danger); }

.tb-actions { display: flex; flex-wrap: wrap; gap: var(--tb-space-3); padding-top: var(--tb-space-2); }
.tb-button {
  font: inherit;
  font-weight: 600;
  font-size: 14px;
  min-height: var(--tb-control);
  padding: 0 var(--tb-space-5);
  border-radius: var(--tb-radius);
  border: var(--tb-line) solid var(--tb-border-strong);
  background: var(--tb-surface);
  color: var(--tb-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--tb-space-2);
  transition: background var(--tb-fast) var(--tb-ease), border-color var(--tb-fast) var(--tb-ease), box-shadow var(--tb-fast) var(--tb-ease), opacity var(--tb-fast) var(--tb-ease);
}
.tb-button.tb-small { font-size: 13px; padding: 0 var(--tb-space-3); gap: var(--tb-space-1); }
.tb-button:hover { background: var(--tb-bg); border-color: var(--tb-muted); }
.tb-button:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-button.tb-primary { background: var(--tb-primary); border-color: var(--tb-primary); color: var(--tb-on-primary); box-shadow: var(--tb-shadow-1); }
.tb-button.tb-primary:hover { background: var(--tb-primary-hover); border-color: var(--tb-primary-hover); }
.tb-button.tb-accent { background: var(--tb-accent); border-color: var(--tb-accent); color: var(--tb-on-accent); }
.tb-button.tb-danger { background: var(--tb-danger); border-color: var(--tb-danger); color: var(--tb-on-danger); }
.tb-button:disabled, .tb-button[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
.tb-button.tb-primary[aria-disabled="true"]:hover { background: var(--tb-primary); border-color: var(--tb-primary); }
.tb-button.tb-has-icon:not(:has(> span:not(:empty))) { padding: 0; width: var(--tb-control); }
/* a button that opens a menu: a chevron after its text, or alone after its icon */
.tb-menu-chevron { transition: transform var(--tb-fast) var(--tb-ease); }
.tb-button .tb-menu-chevron { width: 16px; height: 16px; margin-inline-end: calc(var(--tb-space-1) * -1); }
[aria-expanded="true"] > .tb-menu-chevron { transform: rotate(180deg); }
.tb-button.tb-has-icon[aria-haspopup]:not(:has(> span:not(:empty))) { width: auto; padding: 0 var(--tb-space-2); gap: 2px; }

.tb-icon { width: 1.25em; height: 1.25em; flex: none; fill: none; stroke: currentColor; stroke-width: var(--tb-icon-stroke); stroke-linecap: var(--tb-icon-cap); stroke-linejoin: var(--tb-icon-join); }
.tb-button .tb-icon { width: 18px; height: 18px; }
.tb-icon-face { display: inline-flex; align-self: flex-start; color: var(--tb-text); }
.tb-icon-face .tb-icon { width: 24px; height: 24px; }
.tb-icon-face.tb-small .tb-icon { width: 18px; height: 18px; }
.tb-icon-face.tb-large .tb-icon { width: 32px; height: 32px; }
.tb-icon-face.tb-muted { color: var(--tb-muted); }
.tb-icon-face.tb-primary { color: var(--tb-primary); }
.tb-icon-face.tb-accent { color: var(--tb-accent); }
.tb-icon-face.tb-danger { color: var(--tb-danger); }
.tb-icon-face.tb-success { color: var(--tb-success); }
.tb-icon-face.tb-warning { color: var(--tb-warning); }
.tb-input-icon { position: relative; display: flex; }
.tb-input-icon > .tb-icon { position: absolute; left: var(--tb-space-3); top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: var(--tb-muted); pointer-events: none; }
.tb-input-icon > .tb-input { padding-left: calc(var(--tb-space-3) + 26px); }
.tb-upload { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-3); padding: var(--tb-space-3); border: 1px dashed var(--tb-border-strong); border-radius: var(--tb-radius); background: var(--tb-surface); transition: border-color var(--tb-fast) var(--tb-ease), background var(--tb-fast) var(--tb-ease); }
.tb-upload.tb-drop-over { border-color: var(--tb-primary); background: var(--tb-primary-soft); }
.tb-invalid .tb-upload { border-color: var(--tb-danger); }
.tb-upload-hint { color: var(--tb-muted); font-size: 0.9em; }
.tb-upload[hidden] { display: none; }
.tb-upload[hidden] + .tb-upload-list { margin-top: 0; }
.tb-upload-list { list-style: none; margin: var(--tb-space-2) 0 0; padding: 0; display: grid; gap: var(--tb-space-1); }
.tb-upload-list li { display: flex; align-items: center; gap: var(--tb-space-2); min-height: 36px; padding: 0 var(--tb-space-1) 0 var(--tb-space-3); border: var(--tb-line) solid var(--tb-border); border-radius: var(--tb-radius); background: var(--tb-surface); }
.tb-upload-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
a.tb-upload-name { color: var(--tb-primary); text-decoration: none; }
a.tb-upload-name:hover { text-decoration: underline; }
.tb-upload-thumb { width: 32px; height: 32px; margin: var(--tb-space-1) 0; object-fit: cover; border-radius: var(--tb-radius); flex: none; }
.tb-upload-size { color: var(--tb-muted); font-size: 0.9em; font-variant-numeric: tabular-nums; }
.tb-upload-remove { width: 28px; height: 28px; display: grid; place-items: center; padding: 0; border: 0; border-radius: var(--tb-radius); background: transparent; color: var(--tb-muted); cursor: pointer; }
.tb-upload-remove:hover:not(:disabled) { background: var(--tb-danger-soft); color: var(--tb-danger); }
.tb-upload-remove:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-upload-remove .tb-icon { width: 16px; height: 16px; }
.tb-date { position: relative; display: flex; }
.tb-date > .tb-input { padding-right: calc(var(--tb-control) + var(--tb-space-1)); }
.tb-date-button { position: absolute; right: 1px; top: 1px; bottom: 1px; width: var(--tb-control); display: grid; place-items: center; padding: 0; border: 0; border-radius: var(--tb-radius); background: transparent; color: var(--tb-muted); cursor: pointer; }
.tb-date-button:hover:not(:disabled) { color: var(--tb-text); }
.tb-date-button:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-date-button:disabled { cursor: default; opacity: 0.5; }
.tb-date-button .tb-icon { width: 18px; height: 18px; }
.tb-tree-wrap { min-width: 0; }
.tb-tree, .tb-tree ul { list-style: none; margin: 0; padding: 0; }
.tb-tree li { outline: none; }
.tb-tree-row {
  display: flex;
  align-items: center;
  gap: var(--tb-space-1);
  min-height: calc(var(--tb-control) - 8px);
  padding: 0 var(--tb-space-2) 0 calc(var(--tb-level, 0) * 16px + var(--tb-space-1));
  border-radius: var(--tb-radius);
  cursor: pointer;
  user-select: none;
  transition: background var(--tb-fast) var(--tb-ease);
}
.tb-tree-row:hover { background: var(--tb-bg); }
.tb-tree li:focus-visible > .tb-tree-row { box-shadow: inset 0 0 0 2px var(--tb-focus); }
.tb-tree li.tb-selected > .tb-tree-row { background: var(--tb-primary-soft); font-weight: 550; }
.tb-tree-toggle { display: inline-flex; flex: none; width: 20px; height: 20px; align-items: center; justify-content: center; color: var(--tb-muted); border-radius: var(--tb-radius); }
.tb-tree-toggle .tb-icon { width: 16px; height: 16px; transition: transform var(--tb-fast) var(--tb-ease); }
.tb-tree li:not([aria-expanded]) > .tb-tree-row > .tb-tree-toggle { visibility: hidden; }
.tb-tree li[aria-expanded="true"] > .tb-tree-row > .tb-tree-toggle .tb-icon { transform: rotate(90deg); }
.tb-tree-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tb-tree-row.tb-drop-over { box-shadow: inset 0 0 0 2px var(--tb-primary); }

`;
