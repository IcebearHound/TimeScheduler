import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTimeQuery } from '../src/utils/searchParser'

const referenceDate = new Date(2026, 7, 12, 15, 0)

test('combines relative date, exact time, and text conditions', () => {
  const result = parseTimeQuery('今天 09:30 高数', referenceDate)

  assert.equal(result.text, '高数')
  assert.ok(result.dateFilter)
  assert.equal(result.dateFilter(new Date(2026, 7, 12, 9, 30)), true)
  assert.equal(result.dateFilter(new Date(2026, 7, 12, 9, 31)), false)
  assert.equal(result.dateFilter(new Date(2026, 7, 13, 9, 30)), false)
})

test('uses Monday-based half-open boundaries for current week', () => {
  const result = parseTimeQuery('本周 周一', referenceDate)

  assert.equal(result.text, '')
  assert.ok(result.dateFilter)
  assert.equal(result.dateFilter(new Date(2026, 7, 10, 8, 0)), true)
  assert.equal(result.dateFilter(new Date(2026, 7, 16, 23, 59)), false)
  assert.equal(result.dateFilter(new Date(2026, 7, 17, 0, 0)), false)
})

test('does not leak the next week boundary into a week result', () => {
  const result = parseTimeQuery('下周', referenceDate)

  assert.ok(result.dateFilter)
  assert.equal(result.dateFilter(new Date(2026, 7, 17, 0, 0)), true)
  assert.equal(result.dateFilter(new Date(2026, 7, 23, 23, 59)), true)
  assert.equal(result.dateFilter(new Date(2026, 7, 24, 0, 0)), false)
})

test('rejects invalid calendar dates instead of rolling them forward', () => {
  const result = parseTimeQuery('2026-02-30', referenceDate)

  assert.ok(result.dateFilter)
  assert.equal(result.dateFilter(new Date(2026, 2, 2, 0, 0)), false)
})
