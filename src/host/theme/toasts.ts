// Component rules of the theme: notices.
// Only token variables appear here, never raw values of color.

export const TOASTS = String.raw`
/* toasts */
.tb-toasts {
  position: fixed;
  inset: auto 0 var(--tb-space-5) 0;
  margin: 0 auto;
  width: max-content;
  max-width: calc(100vw - 32px);
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--tb-space-2);
}
.tb-toast {
  display: flex;
  align-items: center;
  gap: var(--tb-space-3);
  padding: var(--tb-space-3) var(--tb-space-5);
  min-height: var(--tb-control);
  background: var(--tb-text);
  color: var(--tb-bg);
  border-radius: var(--tb-radius);
  box-shadow: var(--tb-shadow-3);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  animation: tb-rise 180ms var(--tb-ease);
}
.tb-toast.tb-success::before, .tb-toast.tb-warning::before, .tb-toast.tb-primary::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
  background: var(--tb-primary);
}
.tb-toast.tb-success::before { background: var(--tb-success); }
.tb-toast.tb-warning::before { background: var(--tb-warning); }
.tb-toast.tb-danger { background: var(--tb-danger); color: var(--tb-on-danger); }
.tb-toast-undo {
  margin: calc(-1 * var(--tb-space-2)) calc(-1 * var(--tb-space-3)) calc(-1 * var(--tb-space-2)) 0;
  padding: var(--tb-space-2) var(--tb-space-3);
  border: 0;
  border-radius: var(--tb-radius);
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.tb-toast-undo:hover { background: color-mix(in oklch, currentColor 14%, transparent); }
.tb-toast-undo:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }

`;
