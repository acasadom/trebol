// Component rules of the theme: tables, lists and boards.
// Only token variables appear here, never raw values of color.

export const DATA = String.raw`
/* tables: rows become cards on narrow screens */
.tb-table-wrap, .tb-list-wrap { min-width: 0; }
.tb-table-wrap {
  overflow-x: auto;
  background: var(--tb-surface);
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-1);
}
.tb-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.tb-table th {
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-muted);
  white-space: nowrap;
  padding: var(--tb-space-3) var(--tb-space-4);
  background: var(--tb-bg);
  border-bottom: var(--tb-line) solid var(--tb-border);
}
.tb-table td { padding: var(--tb-space-3) var(--tb-space-4); border-bottom: var(--tb-line) solid var(--tb-border); height: var(--tb-control); }
.tb-table tbody tr:last-child td { border-bottom: 0; }
.tb-table .tb-num { text-align: right; font-variant-numeric: tabular-nums; }
.tb-table-wrap:has(tbody:empty) thead { display: none; }
/* the room of the rows a long table does not draw */
.tb-table .tb-room[hidden] { display: none; }
.tb-table.tb-fixed { table-layout: fixed; }
.tb-table .tb-room :is(tr, td) { padding: 0; border: 0; margin: 0; background: none; box-shadow: none; }
.tb-table th:has(> .tb-sort) { padding: 0; }
.tb-sort {
  display: flex;
  align-items: center;
  gap: var(--tb-space-1);
  width: 100%;
  padding: var(--tb-space-3) var(--tb-space-4);
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  border-radius: 0;
}
.tb-sort:hover, th[aria-sort] > .tb-sort { color: var(--tb-text); }
.tb-sort:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--tb-focus); }
.tb-sort svg { width: 14px; height: 14px; flex: none; }
.tb-sort .tb-sort-idle { opacity: 0; transition: opacity var(--tb-fast) var(--tb-ease); }
.tb-sort:hover .tb-sort-idle, .tb-sort:focus-visible .tb-sort-idle { opacity: 0.5; }
.tb-table tfoot[hidden] { display: none !important; }
.tb-table tfoot td {
  font-weight: 600;
  background: var(--tb-bg);
  border-top: var(--tb-line) solid var(--tb-border);
  border-bottom: 0;
}
.tb-selectable tbody:not(.tb-room) tr:not(.tb-group-head, .tb-group-foot), .tb-selectable .tb-list > li:not(.tb-group-head, .tb-group-foot) { cursor: pointer; transition: background var(--tb-fast) var(--tb-ease); }
.tb-selectable tbody:not(.tb-room) tr:not(.tb-group-head, .tb-group-foot):hover, .tb-selectable .tb-list > li:not(.tb-group-head, .tb-group-foot):hover { background: var(--tb-bg); }
.tb-selectable tbody tr:focus-visible, .tb-selectable .tb-list > li:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--tb-focus); }
.tb-table tr.tb-selected, .tb-list > li.tb-selected { background: var(--tb-primary-soft); }
/* the head and foot of a group in the rows: a title the width of the row, and its subtotals */
.tb-table .tb-group-head > th { font-size: 14px; color: var(--tb-text); white-space: normal; background: var(--tb-bg); border-top: var(--tb-line) solid var(--tb-border); }
.tb-table .tb-group-head.tb-level-2 > th { font-weight: 500; background: var(--tb-surface); }
.tb-table .tb-group-foot > td { font-weight: 600; background: var(--tb-bg); }
.tb-table .tb-level-2 > :first-child, .tb-list > .tb-level-2 { padding-left: calc(var(--tb-space-4) + var(--tb-space-5)); }
.tb-list > li.tb-group-head { font-weight: 600; background: var(--tb-bg); }
.tb-list > li.tb-group-foot { font-weight: 600; }
.tb-empty { margin: 0; padding: var(--tb-space-6) var(--tb-space-4); text-align: center; color: var(--tb-muted); }
.tb-empty[hidden] { display: none; }

.tb-list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--tb-surface);
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-1);
  overflow: hidden;
}
.tb-list:empty { display: none; }
.tb-list > li {
  display: flex;
  align-items: center;
  gap: var(--tb-space-3);
  min-height: var(--tb-control);
  padding: var(--tb-space-3) var(--tb-space-4);
  border-bottom: var(--tb-line) solid var(--tb-border);
}
.tb-list > li:last-child { border-bottom: 0; }
.tb-list-texts { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-width: 0; }
.tb-list-primary { font-weight: 550; }
/* the picture of a row, in a column of images or at the start of a list's item */
.tb-thumb { display: block; flex: none; width: 40px; height: 40px; object-fit: cover; border-radius: var(--tb-radius); background: var(--tb-bg); }
.tb-thumb.tb-round { border-radius: 50%; }
.tb-table td.tb-thumb-cell { width: 1%; padding-top: var(--tb-space-1); padding-bottom: var(--tb-space-1); }
.tb-list-secondary { color: var(--tb-muted); font-size: 13px; }
.tb-list-secondary:empty { display: none; }

/* a board: its lanes side by side, scrolling sideways when they do not fit, and each card on its own */
.tb-board { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(200px, 1fr); gap: var(--tb-space-4); align-items: stretch; overflow-x: auto; padding-bottom: var(--tb-space-2); }
.tb-board > .tb-panel { background: var(--tb-bg); box-shadow: none; padding: var(--tb-space-4); gap: var(--tb-space-3); min-height: 160px; }
.tb-board .tb-list { display: flex; flex-direction: column; gap: var(--tb-space-2); background: none; border: 0; box-shadow: none; overflow: visible; }
.tb-board .tb-list > li, .tb-board .tb-list > li:last-child { background: var(--tb-surface); border: var(--tb-line) solid var(--tb-border); border-radius: var(--tb-radius); box-shadow: var(--tb-shadow-1); }
.tb-board .tb-empty { display: none; }

`;
