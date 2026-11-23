// The calendar of the date picker counts its days with no Date.UTC, which reads the years 0 to 99 as 19xx.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { utcDayMs } from '../src/core/index.ts';
import { addMonths } from '../src/host/browser/calendar.ts';

const ymd = (d: Date): string => `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;

describe('calendar years', () => {
  test('a month on from a date of the year 50 is in the year 50, the last day of a shorter month', () => {
    assert.equal(ymd(addMonths(new Date(utcDayMs(50, 1, 31)), 1)), '50-2-28');
    assert.equal(ymd(addMonths(new Date(utcDayMs(99, 12, 15)), 1)), '100-1-15');
    assert.equal(ymd(addMonths(new Date(utcDayMs(2024, 3, 31)), -1)), '2024-2-29');
  });
});
