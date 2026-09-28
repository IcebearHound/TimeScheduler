import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getCurrentTime, timeZoneSchema } from '../src/utils/currentTime'

export function registerTimeTools(mcp: McpServer) {
  mcp.registerTool('get_current_time', {
    description: 'Read the current time freshly on every call. Returns UTC ISO timestamp, local ISO time with offset, calendar date, weekday, IANA timezone and UTC offset in minutes. Default timezone is Asia/Shanghai (Beijing time); pass the user timezone when known. Use before interpreting today/tomorrow/next week. Read-only; no archive revision or paired webpage required.',
    inputSchema: { timeZone: timeZoneSchema.default('Asia/Shanghai') },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ timeZone }) => ({ content: [{ type: 'text' as const, text: JSON.stringify(getCurrentTime(timeZone)) }] }))
}
