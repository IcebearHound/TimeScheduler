import { z } from 'zod'

export const generatedFileSchema = z.object({
  name: z.string().min(1).max(120).regex(/^[^\\/:*?"<>|\u0000-\u001f]+\.(txt|md|csv|json|ics|xlsx)$/i),
  content: z.string().min(1).max(60000),
}).strict().superRefine((file, ctx) => {
  if (/\.(xlsx|json)$/i.test(file.name)) {
    try {
      const data = JSON.parse(file.content)
      if (/\.xlsx$/i.test(file.name)) z.array(z.array(z.union([z.string(), z.number().finite(), z.boolean(), z.null()])).max(100)).min(1).max(1000).parse(data)
    } catch { ctx.addIssue({ code: 'custom', message: '生成的 JSON / Excel 内容格式无效，请重试' }) }
  }
})
export type GeneratedFile = z.infer<typeof generatedFileSchema>
export const webPageSchema = z.object({ url: z.string().url().max(2048), text: z.string().max(20000), error: z.string().max(500).optional(), truncated: z.boolean().optional() }).strict()
export type AgentWebPage = z.infer<typeof webPageSchema>
export const webPagesSchema = z.array(webPageSchema).max(3)
