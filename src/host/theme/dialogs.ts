// Component rules of the theme: dialogs and the palette (Ctrl+K).
// Only token variables appear here, never raw values of color.

export const DIALOGS = String.raw`
/* dialogs: centered window, full screen when narrow */
.tb-dialog {
  border: 0;
  padding: 0;
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  background: var(--tb-raised);
  color: var(--tb-text);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-3);
}
.tb-dialog[open] { display: flex; flex-direction: column; animation: tb-rise 180ms var(--tb-ease); }
.tb-dialog::backdrop { background: var(--tb-overlay); }
.tb-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tb-space-3);
  padding: var(--tb-space-4) var(--tb-space-4) 0 var(--tb-space-6);
}
.tb-dialog-title { margin: 0; font-size: 17px; line-height: 1.35; font-weight: 600; letter-spacing: -0.01em; }
.tb-dialog-close {
  font: inherit;
  font-size: 22px;
  line-height: 1;
  width: var(--tb-control);
  height: var(--tb-control);
  flex: none;
  border: 0;
  border-radius: var(--tb-radius);
  background: transparent;
  color: var(--tb-muted);
  cursor: pointer;
}
.tb-dialog-close:hover { background: var(--tb-bg); color: var(--tb-text); }
.tb-dialog-close:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-dialog-body {
  display: flex;
  flex-direction: column;
  gap: var(--tb-space-4);
  padding: var(--tb-space-4) var(--tb-space-6) var(--tb-space-6);
  overflow: auto;
}
.tb-dialog.tb-confirm { width: min(420px, calc(100vw - 32px)); }
.tb-dialog.tb-confirm > .tb-dialog-body { padding-top: var(--tb-space-6); gap: var(--tb-space-6); }
.tb-confirm-question { margin: 0; font-size: 15px; line-height: 1.5; }
/* the palette (Ctrl+K): near the top, as a search box with what it finds under it */
.tb-dialog.tb-palette { margin-top: min(15vh, 120px); width: min(600px, calc(100vw - 32px)); max-height: min(480px, calc(100vh - 2 * min(15vh, 120px))); padding: var(--tb-space-2); gap: var(--tb-space-2); }
.tb-palette-input { width: 100%; box-sizing: border-box; font-size: 16px; }
.tb-palette-list { list-style: none; margin: 0; padding: 0; overflow: auto; }
.tb-palette-list:empty { display: none; }
.tb-palette-option { display: flex; align-items: center; gap: var(--tb-space-3); min-height: var(--tb-control); box-sizing: border-box; padding: var(--tb-space-2) var(--tb-space-3); border-radius: var(--tb-radius); cursor: pointer; }
.tb-palette-option > span:first-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tb-palette-option[aria-selected="true"] { background: var(--tb-primary-soft); }
.tb-palette-hint { flex: none; font-size: 13px; color: var(--tb-muted); }
.tb-palette-none { margin: 0; padding: var(--tb-space-4) var(--tb-space-3); color: var(--tb-muted); }
.tb-palette-none[hidden] { display: none; }
@keyframes tb-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

`;
