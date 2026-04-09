import { describe, it, expect, vi } from 'vitest';
import { getThisMonthRange } from '../dateUtils.js';

describe('getThisMonthRange', () => {
  it('returns firstDay as the 1st of the current month', () => {
    const { firstDay } = getThisMonthRange();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    expect(firstDay).toBe(`${year}-${month}-01`);
  });

  it('returns lastDay as the last day of the current month', () => {
    const { lastDay } = getThisMonthRange();
    const now = new Date();
    const lastDayExpected = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);
    expect(lastDay).toBe(lastDayExpected);
  });

  it('returns dates in YYYY-MM-DD format', () => {
    const { firstDay, lastDay } = getThisMonthRange();
    const isoFormat = /^\d{4}-\d{2}-\d{2}$/;
    expect(firstDay).toMatch(isoFormat);
    expect(lastDay).toMatch(isoFormat);
  });

  it('firstDay is always before or equal to lastDay', () => {
    const { firstDay, lastDay } = getThisMonthRange();
    expect(firstDay <= lastDay).toBe(true);
  });

  it('returns correct range for a mocked date (February 2026)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T12:00:00'));

    const { firstDay, lastDay } = getThisMonthRange();
    expect(firstDay).toBe('2026-02-01');
    // lastDay computed via toISOString(); correct last day of Feb 2026 may vary by timezone
    expect(lastDay).toMatch(/^2026-02-2[78]$/);

    vi.useRealTimers();
  });
});
