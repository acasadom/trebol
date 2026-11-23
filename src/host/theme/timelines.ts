// Component rules of the theme: a timeline, its days, and on a line that runs down each day a mark per row with
// what happened, its time and a quieter line beneath. Only token variables appear here, never raw values of color.

export const TIMELINES = String.raw`
.tb-timeline { min-width: 0; }
.tb-timeline-days { display: flex; flex-direction: column; gap: var(--tb-space-5); }
.tb-timeline-date { margin: 0 0 var(--tb-space-2); font-family: inherit; font-size: 13px; font-weight: 600; line-height: 1.4; letter-spacing: 0; color: var(--tb-muted); }
.tb-timeline-items { list-style: none; margin: 0; padding: 0; }
.tb-timeline-item {
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  column-gap: var(--tb-space-3);
  padding-bottom: var(--tb-space-4);
}
.tb-timeline-item:last-child { padding-bottom: 0; }
/* the line from one mark to the next, through the day */
.tb-timeline-item::before { content: ""; position: absolute; left: 7px; top: 12px; bottom: -6px; width: 2px; background: var(--tb-border); }
.tb-timeline-item:last-child::before { display: none; }
.tb-timeline-mark {
  position: relative;
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  margin: 5px auto 0;
  border-radius: 50%;
  background: var(--tb-surface);
  border: 2px solid var(--tb-border-strong);
}
.tb-timeline-item[data-tb-role] > .tb-timeline-mark { background: var(--tb-role); border-color: var(--tb-role); box-shadow: 0 0 0 3px var(--tb-role-soft); }
.tb-timeline-body { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: var(--tb-space-3); min-width: 0; }
.tb-timeline-text { flex: 1 1 12rem; min-width: 0; overflow-wrap: anywhere; font-weight: 500; }
.tb-timeline-item[data-tb-role] .tb-timeline-text { color: var(--tb-role-ink); }
.tb-timeline-item[data-tb-role="muted"] .tb-timeline-text { color: var(--tb-muted); }
.tb-timeline-time { margin-left: auto; font-size: 13px; color: var(--tb-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.tb-timeline-note { flex-basis: 100%; font-size: 13px; color: var(--tb-muted); overflow-wrap: anywhere; }
`;
