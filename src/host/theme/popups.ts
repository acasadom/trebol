// Component rules of the theme: what opens over the page, placed by the host: calendars, lookups, menus, swipe actions, drag and drop.
// Only token variables appear here, never raw values of color.

export const POPUPS = String.raw`
/* the calendar of a date field: in the top layer, placed by the host */
.tb-calendar {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: var(--tb-space-3);
  background: var(--tb-raised);
  color: var(--tb-text);
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-3);
  animation: tb-pop 120ms var(--tb-ease);
}
.tb-calendar-head { display: flex; align-items: center; gap: var(--tb-space-2); margin-bottom: var(--tb-space-2); }
.tb-calendar-month { flex: 1; margin: 0; font-size: 1em; font-weight: 600; text-align: center; }
.tb-calendar-month::first-letter { text-transform: uppercase; }
.tb-calendar-step { width: 32px; height: 32px; display: grid; place-items: center; padding: 0; border: 0; border-radius: var(--tb-radius); background: transparent; color: var(--tb-muted); cursor: pointer; }
.tb-calendar-step:hover { background: var(--tb-bg); color: var(--tb-text); }
.tb-calendar-step:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--tb-focus-ring); }
.tb-calendar-step .tb-icon { width: 18px; height: 18px; }
.tb-calendar-grid { border-collapse: collapse; }
.tb-calendar-grid th { width: 36px; height: 28px; font-size: 0.8em; font-weight: 500; color: var(--tb-muted); text-transform: uppercase; }
.tb-calendar-day { width: 36px; height: 36px; padding: 0; text-align: center; border-radius: var(--tb-radius); cursor: pointer; font-variant-numeric: tabular-nums; transition: background var(--tb-fast) var(--tb-ease); }
.tb-calendar-day:hover { background: var(--tb-bg); }
.tb-calendar-day:focus { outline: none; box-shadow: inset 0 0 0 2px var(--tb-focus); }
.tb-calendar-other { color: var(--tb-muted); }
.tb-calendar-day[aria-current="date"] { font-weight: 700; color: var(--tb-primary); }
.tb-calendar-day[aria-selected="true"] { background: var(--tb-primary); color: var(--tb-on-primary); }
.tb-calendar-in { background: var(--tb-primary-soft); border-radius: 0; }
.tb-calendar-hint { margin: var(--tb-space-2) 0 0; font-size: 0.85em; color: var(--tb-muted); text-align: center; }
.tb-calendar-day[aria-disabled="true"] { color: var(--tb-border-strong); background: transparent; cursor: default; text-decoration: line-through; }

/* menus: in the top layer, placed by the host */
.tb-lookup { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-1); }
.tb-lookup .tb-input { flex: 1; min-width: 8em; width: auto; }
.tb-lookup-chosen { list-style: none; margin: 0; padding: 0; display: contents; }
.tb-lookup-chip { display: inline-flex; align-items: center; gap: var(--tb-space-1); min-height: 32px; padding: 0 var(--tb-space-1) 0 var(--tb-space-3); border: var(--tb-line) solid var(--tb-border); border-radius: var(--tb-radius); background: var(--tb-surface); }
.tb-lookup-chip:not(:has(button)) { padding-right: var(--tb-space-3); }
.tb-lookup-list {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: var(--tb-space-1);
  list-style: none;
  max-height: 280px;
  overflow-y: auto;
  color: var(--tb-text);
  background: var(--tb-raised);
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-3);
}
.tb-times .tb-lookup-option { font-variant-numeric: tabular-nums; }
.tb-times .tb-lookup-option:focus { outline: none; box-shadow: inset 0 0 0 2px var(--tb-focus); }
.tb-lookup-option { padding: var(--tb-space-2) var(--tb-space-3); border-radius: var(--tb-radius); cursor: pointer; }
.tb-lookup-option:hover, .tb-lookup-option[aria-selected="true"] { background: var(--tb-primary-soft); }
.tb-lookup-none { padding: var(--tb-space-2) var(--tb-space-3); color: var(--tb-muted); }

.tb-menu {
  position: fixed;
  inset: auto;
  margin: 0;
  min-width: 180px;
  max-width: min(320px, calc(100vw - 16px));
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  padding: var(--tb-space-1);
  background: var(--tb-raised);
  color: var(--tb-text);
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius);
  box-shadow: var(--tb-shadow-3);
  animation: tb-pop 120ms var(--tb-ease);
}
.tb-menu-item {
  display: flex;
  align-items: center;
  gap: var(--tb-space-3);
  width: 100%;
  min-height: 36px;
  padding: 0 var(--tb-space-3);
  border: 0;
  border-radius: calc(var(--tb-radius) - 2px);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.tb-menu-item > span:not(.tb-menu-gap) { flex: 1; }
.tb-menu-item svg { width: 16px; height: 16px; flex: none; color: var(--tb-muted); }
.tb-menu-gap { width: 16px; flex: none; }
.tb-menu-item:focus { outline: none; background: var(--tb-primary-soft); }
.tb-menu-item[aria-expanded="true"] { background: var(--tb-bg); }
.tb-menu-item.tb-danger, .tb-menu-item.tb-danger svg { color: var(--tb-danger); }
.tb-menu-item.tb-danger:focus { background: var(--tb-danger-soft); }
.tb-swipe-actions { position: fixed; z-index: 20; display: flex; justify-content: flex-end; overflow: hidden; }
.tb-swipe-action {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  flex: none; width: 76px; padding: 0 var(--tb-space-1); border: 0;
  background: var(--tb-primary); color: var(--tb-on-primary); font: inherit; font-size: 12px; font-weight: 550;
}
.tb-swipe-action > span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tb-swipe-action svg { width: 20px; height: 20px; }
.tb-swipe-action.tb-danger { background: var(--tb-danger); color: var(--tb-on-danger); }
.tb-swipe-action.tb-swipe-more { background: var(--tb-bg); color: var(--tb-text); }
.tb-swipe-settle { transition: transform 200ms var(--tb-ease), left 200ms var(--tb-ease), width 200ms var(--tb-ease); }
.tb-menu-divider { height: 1px; margin: var(--tb-space-1) calc(-1 * var(--tb-space-1)); background: var(--tb-border); }
@keyframes tb-pop { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }

/* drag and drop */
.tb-drag-active, .tb-drag-active * { user-select: none; cursor: grabbing !important; }
.tb-dragging { opacity: 0.4; }
.tb-drop-zone { min-height: var(--tb-control); }
.tb-drop-over { outline: 2px dashed var(--tb-focus-ring); outline-offset: 4px; border-radius: var(--tb-radius); }
.tb-drop-line {
  position: fixed;
  height: 2px;
  border-radius: 1px;
  background: var(--tb-primary);
  pointer-events: none;
  z-index: 2147483647;
}
.tb-drop-line.tb-across { width: 2px; }
.tb-drag-ghost {
  position: fixed;
  left: 0;
  top: 0;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: var(--tb-space-2) var(--tb-space-3);
  background: var(--tb-raised);
  color: var(--tb-text);
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius);
  box-shadow: var(--tb-shadow-3);
  font-size: 14px;
  font-weight: 500;
  pointer-events: none;
  z-index: 2147483647;
}

`;
