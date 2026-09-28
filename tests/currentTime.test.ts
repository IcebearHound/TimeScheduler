import test from 'node:test'
import assert from 'node:assert/strict'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { getCurrentTime } from '../src/utils/currentTime'
import { registerTimeTools } from '../server/timeTools'

test('time context handles local midnight, fractional offsets and daylight saving changes', () => {
  const now = new Date('2026-09-28T16:05:06.789Z')
  assert.deepEqual(getCurrentTime('Asia/Shanghai', now), {
    utcTime: now.toISOString(), localTime: '2026-09-29T00:05:06+08:00', timeZone: 'Asia/Shanghai', date: '2026-09-29', weekday: '星期二', utcOffsetMinutes: 480,
  })
  assert.equal(getCurrentTime('Asia/Kathmandu', now).localTime, '2026-09-28T21:50:06+05:45')
  assert.equal(getCurrentTime('America/New_York', new Date('2026-03-08T06:59:59Z')).localTime, '2026-03-08T01:59:59-05:00')
  assert.equal(getCurrentTime('America/New_York', new Date('2026-03-08T07:00:00Z')).localTime, '2026-03-08T03:00:00-04:00')
  assert.throws(() => getCurrentTime('invalid timezone'))
})

test('MCP time reads are fresh and independent of webpage pairing and archive revisions', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-28T15:59:59Z') })
  const server = new McpServer({ name: 'test', version: '1' }), client = new Client({ name: 'test', version: '1' })
  registerTimeTools(server)
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(a); await client.connect(b)
  try {
    const read = async (args = {}) => {
      const result = await client.callTool({ name: 'get_current_time', arguments: args })
      assert.ok(!result.isError)
      return JSON.parse((result.content as { text: string }[])[0].text)
    }
    assert.equal((await client.listTools()).tools[0].annotations?.readOnlyHint, true)
    assert.equal((await read()).localTime, '2026-09-28T23:59:59+08:00')
    t.mock.timers.tick(2000)
    assert.equal((await read()).localTime, '2026-09-29T00:00:01+08:00')
    assert.equal((await read({ timeZone: 'America/New_York' })).date, '2026-09-28')
    assert.equal((await client.callTool({ name: 'get_current_time', arguments: { timeZone: 'invalid' } })).isError, true)
  } finally { await client.close(); await server.close() }
})
