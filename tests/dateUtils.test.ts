import test from 'node:test'
import assert from 'node:assert/strict'
import { addMonths, getStartOfWeek, getMonthDays, isSameWeek, getDaysBetween } from '../src/utils/dateUtils'

test('Sunday belongs to the preceding Monday-based week, including year boundaries', () => {
  assert.equal(getStartOfWeek(new Date(2026, 9, 25)).getDate(), 19)
  assert.equal(getStartOfWeek(new Date(2026, 9, 25), 0).getDate(), 25)
  assert.ok(isSameWeek(new Date(2025, 11, 29), new Date(2026, 0, 4)))
  assert.ok(!isSameWeek(new Date(2026, 0, 4), new Date(2026, 0, 5)))
})

test('month arithmetic clamps to the target month without skipping February', () => {
  assert.equal(addMonths(new Date(2026, 0, 31), 1).getMonth(), 1)
  assert.equal(addMonths(new Date(2026, 0, 31), 1).getDate(), 28)
  assert.equal(addMonths(new Date(2024, 2, 31), -1).getDate(), 29)
  assert.equal(addMonths(new Date(2026, 11, 31), 1).getFullYear(), 2027)
})

test('month grids align all dates to weekdays and include six complete weeks', () => {
  for (let month = 0; month < 12; month++) {
    const days = getMonthDays(new Date(2026, month, 15))
    assert.equal(days.length, 42)
    days.forEach((day, i) => assert.equal(day.getDay(), (i + 1) % 7))
    assert.equal(days.filter(d => d.getMonth() === month).length, new Date(2026, month + 1, 0).getDate())
  }
})

test('calendar-day differences survive daylight saving transitions', () => {
  const previous = process.env.TZ
  process.env.TZ = 'America/New_York'
  try {
    assert.equal(getDaysBetween(new Date(2026, 2, 8), new Date(2026, 2, 9)), 1)
    assert.equal(getDaysBetween(new Date(2026, 10, 1), new Date(2026, 10, 2)), 1)
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})
