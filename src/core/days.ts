// Calendar days with no help from JS Date: Date.UTC reads the years 0 to 99 as 1900 to 1999, so a date of
// the year 50 would be the same moment as one of 1950. Days are counted from 1970-01-01 on the proleptic
// Gregorian calendar, any year, as R3 counts them (the algorithm is Howard Hinnant's days_from_civil).

export const DAY_MS = 86400000;

/** Days from 1970-01-01 to a calendar date; a month or day past its end goes on into the next. */
export function daysOf(y: number, m: number, d: number): number {
  y += Math.floor((m - 1) / 12);
  m = ((m - 1) % 12 + 12) % 12 + 1;
  if (m <= 2) y -= 1;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The calendar date a count of days from 1970-01-01 falls on. */
export function civilOf(days: number): { y: number; m: number; d: number } {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

/** Milliseconds from 1970-01-01T00:00Z to the midnight that starts a calendar date in UTC. */
export function utcDayMs(y: number, m: number, d: number): number {
  return daysOf(y, m, d) * DAY_MS;
}
