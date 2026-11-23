// Component rules of the theme: a column on a rail. Each child has a mark on a line that runs from it to the
// next; the role of a child paints its mark. Only token variables appear here, never raw values of color.

export const RAILS = String.raw`
.tb-column.tb-rail { gap: 0; }
.tb-rail > * { position: relative; padding-left: calc(16px + var(--tb-space-3)); padding-bottom: var(--tb-space-4); --tb-mark: var(--tb-border-strong); --tb-mark-fill: var(--tb-surface); --tb-mark-ring: transparent; }
.tb-rail > :last-child { padding-bottom: 0; }
/* the line from one mark to the next */
.tb-rail > *::before { content: ""; position: absolute; left: 7px; top: 12px; bottom: -6px; width: 2px; background: var(--tb-border); }
.tb-rail > :last-child::before { display: none; }
.tb-rail > *::after {
  content: "";
  position: absolute;
  left: 2px;
  top: 5px;
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--tb-mark-fill);
  border: 2px solid var(--tb-mark);
  box-shadow: 0 0 0 3px var(--tb-mark-ring);
}
${['primary', 'accent', 'danger', 'success', 'warning', 'muted'].map(r =>
  `.tb-rail > .tb-${r} { --tb-mark: var(--tb-${r}); --tb-mark-fill: var(--tb-${r}); --tb-mark-ring: var(--tb-${r}-soft); }`).join('\n')}
`;
