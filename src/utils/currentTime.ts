import { z } from 'zod'

export const timeZoneSchema = z.string().min(1).max(100).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
}, '无效的时区，请使用 Asia/Shanghai 等 IANA 时区名称')

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
}

/** Compute every field from the same instant, including the offset at DST boundaries. */
export function getCurrentTime(timeZone = localTimeZone(), now = new Date()) {
  timeZoneSchema.parse(timeZone)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)!.value
  const date = `${part('year')}-${part('month')}-${part('day')}`
  const clock = `${part('hour')}:${part('minute')}:${part('second')}`
  const utcOffsetMinutes = Math.round((Date.parse(`${date}T${clock}Z`) - Math.floor(+now / 1000) * 1000) / 60000)
  const offset = `${utcOffsetMinutes < 0 ? '-' : '+'}${String(Math.floor(Math.abs(utcOffsetMinutes) / 60)).padStart(2, '0')}:${String(Math.abs(utcOffsetMinutes) % 60).padStart(2, '0')}`
  return { utcTime: now.toISOString(), localTime: `${date}T${clock}${offset}`, timeZone, date, weekday: new Intl.DateTimeFormat('zh-CN', { timeZone, weekday: 'long' }).format(now), utcOffsetMinutes }
}

export function currentTimePrompt(currentTime: ReturnType<typeof getCurrentTime>) {
  return `当前时间（本次请求实时读取）：${JSON.stringify(currentTime)}。你可以直接使用这些时间信息回答现在几点、今天几号及星期几，无需联网或向用户追问。今天、明天、昨天按该时区的日历日期计算，本周从星期一开始，下周为下一自然周；用户明确指定其他时区时按其要求换算。当前时间以本次上下文为准，不使用历史对话时间、学期开始日期或日历正在浏览的日期代替。`
}
