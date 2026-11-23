// Component rules of the theme: a stat, a number that stands for something, with its label, the line under it
// and its trend. Only token variables appear here, never raw values of color.

export const STATS = String.raw`
.tb-stat {
  --tb-stat-ink: var(--tb-text);
  --tb-stat-line: var(--tb-primary);
  display: flex;
  flex-direction: column;
  gap: var(--tb-space-1);
  min-width: 0;
  /* the number is as large as the stat is wide lets it be, so a row of them never breaks it in two */
  container-type: inline-size;
  padding: var(--tb-space-5);
  background: var(--tb-raised);
  border: var(--tb-line) solid var(--tb-border);
  border-radius: var(--tb-radius-lg);
  box-shadow: var(--tb-shadow-1);
}
.tb-row > .tb-stat { flex: 1 1 10rem; }
.tb-panel .tb-stat { padding: 0; background: none; border: 0; border-radius: 0; box-shadow: none; }
.tb-stat-label { font-size: 14px; font-weight: 550; color: var(--tb-muted); overflow-wrap: anywhere; }
.tb-stat-value {
  font-family: var(--tb-headings);
  /* --tb-stat-chars, set as it is drawn: how many characters the number has, each about 0.6 of the size wide */
  font-size: clamp(18px, calc(100cqi / (0.62 * var(--tb-stat-chars, 4))), 30px);
  white-space: nowrap;
  line-height: 1.15;
  font-weight: 650;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--tb-stat-ink);
}
.tb-stat-note { font-size: 13px; color: var(--tb-muted); }
.tb-stat-note[hidden], .tb-stat-trend[hidden] { display: none; }
/* the trend sits at the foot of the stat, so stats side by side line theirs up */
.tb-stat-trend { margin-top: auto; padding-top: var(--tb-space-2); max-width: 360px; }
.tb-stat-plot { position: relative; height: 32px; }
.tb-stat-plot > svg { display: block; width: 100%; height: 100%; overflow: visible; }
.tb-stat-line { fill: none; stroke: var(--tb-stat-line); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.tb-stat-area { fill: color-mix(in oklch, var(--tb-stat-line) 14%, transparent); stroke: none; }
.tb-stat-dot { position: absolute; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px; border-radius: 50%; background: var(--tb-stat-line); box-shadow: 0 0 0 2px var(--tb-raised); }
.tb-stat.tb-primary { --tb-stat-ink: var(--tb-primary-ink); }
.tb-stat.tb-accent { --tb-stat-ink: var(--tb-accent-ink); --tb-stat-line: var(--tb-accent); }
.tb-stat.tb-success { --tb-stat-ink: var(--tb-success-ink); --tb-stat-line: var(--tb-success); }
.tb-stat.tb-warning { --tb-stat-ink: var(--tb-warning-ink); --tb-stat-line: var(--tb-warning); }
.tb-stat.tb-danger { --tb-stat-ink: var(--tb-danger-ink); --tb-stat-line: var(--tb-danger); }
.tb-stat.tb-muted { --tb-stat-ink: var(--tb-muted); --tb-stat-line: var(--tb-border-strong); }
`;
