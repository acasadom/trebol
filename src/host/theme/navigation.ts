// Component rules of the theme: toolbars, breadcrumbs and links, and the classes that hide.
// Only token variables appear here, never raw values of color.

export const NAVIGATION = String.raw`
.tb-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--tb-space-1);
  padding: var(--tb-space-1);
  background: var(--tb-surface);
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
}
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger) { border-color: transparent; background: transparent; }
.tb-toolbar > .tb-button:not(.tb-primary, .tb-accent, .tb-danger):hover { background: var(--tb-bg); }
.tb-toolbar > .tb-button { padding: 0 var(--tb-space-3); }
.tb-toolbar > .tb-divider { width: 0; height: calc(var(--tb-control) - 12px); margin: 0 var(--tb-space-1); border-top: 0; border-left: var(--tb-line) solid var(--tb-border); }

.tb-breadcrumb ol { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-1); margin: 0; padding: 0; list-style: none; font-size: 14px; }
.tb-breadcrumb li { display: inline-flex; align-items: center; gap: var(--tb-space-1); min-width: 0; }
.tb-breadcrumb li + li::before { content: "›" / ""; color: var(--tb-muted); padding: 0 var(--tb-space-1); }
.tb-crumb { font: inherit; color: var(--tb-muted); background: none; border: 0; padding: var(--tb-space-1); border-radius: var(--tb-radius); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 24ch; }
button.tb-crumb { cursor: pointer; }
button.tb-crumb:hover { color: var(--tb-text); text-decoration: underline; text-underline-offset: 3px; }
button.tb-crumb:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-crumb[aria-current] { color: var(--tb-text); font-weight: 600; }
.tb-crumb-more { display: none !important; }

.tb-link { display: inline-flex; align-items: center; gap: var(--tb-space-1); color: var(--tb-primary); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }

.tb-hidden { display: none !important; }
/* read by screen readers, not shown */
.tb-sr-only { position: absolute; top: 0; left: 0; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (min-width: 641px) { .tb-narrow-only { display: none !important; } }

`;
