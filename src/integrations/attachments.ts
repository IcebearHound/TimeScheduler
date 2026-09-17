import { z } from 'zod'

const name = z.string().min(1).max(255)
const base64 = z.string().min(4).max(7 * 1024 * 1024).regex(/^[A-Za-z0-9+/]+={0,2}$/).refine(value => value.length % 4 === 0)
export const attachmentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), name, text: z.string().min(1).max(60000) }).strict(),
  z.object({ kind: z.literal('image'), name, mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']), data: base64 }).strict(),
  z.object({ kind: z.literal('pdf'), name, mimeType: z.literal('application/pdf'), data: base64 }).strict(),
])
export type AgentAttachment = z.infer<typeof attachmentSchema>
export const attachmentsSchema = z.array(attachmentSchema).max(5).superRefine((items, ctx) => {
  if (items.reduce((size, item) => size + (item.kind === 'text' ? item.text.length : item.data.length), 0) > 8 * 1024 * 1024) ctx.addIssue({ code: 'custom', message: '附件总量过大，请分批发送（最多 8 MB）' })
  if (items.reduce((size, item) => size + (item.kind === 'text' ? item.text.length : 0), 0) > 120000) ctx.addIssue({ code: 'custom', message: '附件文字总量不能超过 12 万字' })
})
