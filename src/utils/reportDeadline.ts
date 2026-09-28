import { z } from 'zod'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '截止时刻须为 HH:mm')
export const reportDeadlineRuleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('after_days'), days: z.number().int().min(0).max(365), time }).strict(),
  z.object({ mode: z.literal('weekday'), weekday: z.number().int().min(0).max(6), time }).strict(),
])
export type ReportDeadlineRule = z.infer<typeof reportDeadlineRuleSchema>

/** Calendar rules use Beijing time, independently of browser/server timezone. */
export function calculateReportDeadline(labEnd: string | Date, raw: ReportDeadlineRule): string {
  const rule = reportDeadlineRuleSchema.parse(raw), end = +new Date(labEnd)
  if (!Number.isFinite(end)) throw new Error('请先填写有效的实验结束时间')
  const local = new Date(end + 8 * 3600000), [hour, minute] = rule.time.split(':').map(Number)
  const target = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour, minute))
  if (rule.mode === 'after_days') target.setUTCDate(target.getUTCDate() + rule.days)
  else {
    target.setUTCDate(target.getUTCDate() + (rule.weekday - local.getUTCDay() + 7) % 7)
    if (+target - 8 * 3600000 <= end) target.setUTCDate(target.getUTCDate() + 7)
  }
  const result = +target - 8 * 3600000
  if (result <= end) throw new Error('报告截止时间必须晚于实验结束时间，请调整天数或时刻')
  return new Date(result).toISOString()
}
