import test from 'node:test'
import assert from 'node:assert/strict'
import { EventDraft, eventDraft, eventDraftChanges } from '../src/utils/eventDraft'

const base: EventDraft = { name: '课程', typeId: 'course', chainId: '', startTime: new Date('2026-10-26T01:00:00Z'), endTime: new Date('2026-10-26T02:00:00Z'), reminders: [], properties: { notes: '原备注', location: '教室 A' } }

test('untouched detail drafts cannot write back over AI, sync or completion updates', () => {
  const latest = { ...base, name: 'AI 新标题', properties: { ...base.properties, notes: 'AI 新备注', completed: 'true' } }
  assert.deepEqual(eventDraftChanges(base, base, latest), { changes: {}, conflicts: [] })
})

test('detail autosave merges only edited fields and preserves unrelated external properties', () => {
  const latest = { ...base, properties: { ...base.properties, notes: 'AI 新备注', completed: 'true' } }
  const draft = { ...base, name: '我的新标题', properties: { ...base.properties, location: '教室 B' } }
  const result = eventDraftChanges(base, draft, latest)
  assert.deepEqual(result.changes, { name: '我的新标题', properties: { notes: 'AI 新备注', location: '教室 B', completed: 'true' } })
  assert.deepEqual(result.conflicts, [])
})

test('competing edits of the same field require an explicit resolution; matching edits do not conflict', () => {
  const draft = { ...base, name: '我的标题', properties: { notes: '我的备注' } }
  const latest = { ...base, name: '远端标题', properties: { notes: '远端备注', location: '教室 A' } }
  assert.deepEqual(eventDraftChanges(base, draft, latest).conflicts, ['name', 'properties.notes'])
  assert.deepEqual(eventDraftChanges(base, draft, draft).conflicts, [])
})

test('legacy property aliases and removed properties merge without dropping new metadata', () => {
  const normalized = eventDraft({ ...base, properties: { '地点': '教室 A', notes: '原备注' } })
  assert.equal(normalized.properties.location, '教室 A')
  const result = eventDraftChanges(normalized, { ...normalized, properties: { location: '教室 A' } }, { ...base, properties: { ...base.properties, completed: 'true' } })
  assert.deepEqual(result.changes.properties, { location: '教室 A', completed: 'true' })
})
