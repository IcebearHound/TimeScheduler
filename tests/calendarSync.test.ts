import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarEntries, calendarIcs, CalendarEntry } from '../src/integrations/calendarIcs'
import { validateSnapshot } from '../src/integrations/contracts'
import { calendarRoute, calendarToken, CalendarFeedObject } from '../worker/calendar'

const stamp = '2026-09-21T00:00:00Z'
const entry: CalendarEntry = { id: 'task', title: '考试，电路;测量\n第二行', start: '2026-09-22T09:00:00+08:00', end: '2026-09-22T11:00:00+08:00', updated: stamp, location: '教室', description: '课程', alarms: ['2026-09-22T08:30:00+08:00'] }
test('ICS escapes content, folds UTF-8 correctly and includes stable IDs with absolute UTC alarms', () => {
  const value = calendarIcs([{ ...entry, title: entry.title.repeat(15) }])
  for (const line of value.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75)
  const unfolded = value.replace(/\r\n /g, '')
  assert.ok(unfolded.includes('UID:task@timescheduler'))
  assert.ok(unfolded.includes('DTSTART:20260922T010000Z'))
  assert.ok(unfolded.includes('TRIGGER;VALUE=DATE-TIME:20260922T003000Z'))
  assert.ok(unfolded.includes('\\;测量\\n第二行'))
  assert.ok(!value.includes('\r\r\n'))
})

test('calendar projection respects deadline timing, completion, holiday skipping and private fields', () => {
  const event = (id: string, properties: Record<string, string>, endTime = '2026-09-21T23:59:00+08:00') => ({ id, name: id, typeId: 'hw', chainId: 'c', startTime: '2026-09-01T00:00:00Z', endTime, createdAt: stamp, updatedAt: stamp, reminders: [], properties, isHighlight: false, priority: 0 })
  const snapshot = validateSnapshot({ version: 1, semesterStartDate: stamp, eventTypes: [{ id: 'hw', name: '作业', emoji: '📖', category: 'homework', color: '#333' }], eventChains: [{ id: 'c', name: '数学', typeId: 'hw', color: '#333', defaultReminders: [], taskRules: { skipHolidays: true }, createdAt: stamp, updatedAt: stamp }], events: [event('due', { notes: 'SECRET', submissionUrl: 'https://private.example' }), event('done', { completed: 'true' }), event('skip', {}, '2026-10-01T23:59:00+08:00')], groups: [], groupOrder: [], activeGroupId: '' })
  const entries = calendarEntries(snapshot, 10, new Date(stamp))
  assert.equal(entries.length, 2)
  const due = entries.find(e => e.id === 'due')!, done = entries.find(e => e.id === 'done')!
  assert.equal(due.start, '2026-09-21T15:59:00.000Z')
  assert.equal(due.alarms[0], '2026-09-21T15:49:00.000Z')
  assert.deepEqual(done.alarms, [])
  assert.ok(!JSON.stringify(entries).includes('SECRET'))
  assert.ok(!JSON.stringify(entries).includes('private.example'))
})

test('calendar feed is readable by subscription token but only writable with its separate secret; replacement and revocation work', async () => {
  const map = new Map<string, unknown>()
  const storage: any = { get: async (k: string) => map.get(k), put: async (k: string, v: unknown) => { map.set(k, v) }, delete: async (keys: string[]) => keys.forEach(k => map.delete(k)), transaction: async (fn: any) => fn(storage) }
  const object = new CalendarFeedObject({ storage })
  const env = { APP_URL: 'https://app.example/TimeScheduler/', CALENDAR_FEEDS: { getByName: () => object } }
  const secret = 'ab'.repeat(32), token = await calendarToken(secret), url = `https://feed.example/calendar/${token}.ics`
  const call = (method: string, key = secret, origin = 'https://app.example', events = [entry]) => calendarRoute(new Request(url, { method, headers: { Origin: origin, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, ...(method === 'PUT' ? { body: JSON.stringify(events) } : {}) }), env)
  assert.equal((await call('PUT', token)).status, 403)
  assert.equal((await call('PUT', secret, 'https://evil.example')).status, 403)
  assert.equal((await call('PUT')).status, 200)
  const read = await calendarRoute(new Request(url), env), first = await read.text()
  assert.ok(read.headers.get('Content-Type')?.includes('text/calendar'))
  assert.ok(first.includes('SEQUENCE:1'))
  assert.ok(!first.includes('\r\r\n'))
  await call('PUT'); assert.equal(await (await calendarRoute(new Request(url), env)).text(), first)
  await call('PUT', secret, 'https://app.example', [{ ...entry, title: '修改后', alarms: [] }])
  const revised = await (await calendarRoute(new Request(url), env)).text()
  assert.ok(revised.includes('SEQUENCE:2'))
  assert.ok(revised.includes('UID:task@timescheduler'))
  assert.ok(!revised.includes('BEGIN:VALARM'))
  assert.equal((await call('DELETE', token)).status, 403)
  await call('DELETE')
  assert.ok(!(await (await calendarRoute(new Request(url), env)).text()).includes('BEGIN:VEVENT'))
  assert.equal((await calendarRoute(new Request(url), { APP_URL: env.APP_URL })).status, 503)
})

test('large feeds respect storage limits and remove old chunks on replacement and revocation', async () => {
  const map = new Map<string, unknown>()
  const storage: any = {
    get: async (key: string) => map.get(key),
    put: async (key: string, value: unknown) => { assert.ok(Buffer.byteLength(JSON.stringify(value)) < 128 * 1024); map.set(key, value) },
    delete: async (keys: string[]) => { assert.ok(keys.length <= 128); keys.forEach(key => map.delete(key)) },
    transaction: async (job: any) => job(storage),
  }
  const object = new CalendarFeedObject({ storage })
  const content = calendarIcs(Array.from({ length: 2500 }, (_, i) => ({ ...entry, id: `task-${i}`, title: 'A'.repeat(350), alarms: [] })))
  assert.ok(Buffer.byteLength(content) < 2 * 1024 * 1024)
  await object.fetch(new Request('https://calendar.internal/', { method: 'PUT', body: content }))
  const read = await (await object.fetch(new Request('https://calendar.internal/'))).text()
  assert.equal((read.match(/BEGIN:VEVENT/g) || []).length, 2500)
  assert.ok(read.includes('UID:task-2499@timescheduler'))
  // Also cover cleanup of feeds created with the previous, smaller chunk size.
  for (let i = 0; i < 140; i++) map.set(`part:${i}`, 'old')
  map.set('count', 140)
  await object.fetch(new Request('https://calendar.internal/', { method: 'PUT', body: calendarIcs([entry]) }))
  assert.equal([...map.keys()].filter(key => key.startsWith('part:')).length, 1)
  await object.fetch(new Request('https://calendar.internal/', { method: 'DELETE' }))
  assert.equal([...map.keys()].filter(key => key.startsWith('part:')).length, 0)
  assert.ok(!(await (await object.fetch(new Request('https://calendar.internal/'))).text()).includes('BEGIN:VEVENT'))
})
