const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

export const EN_TO_CN: Record<string, string> = {
  location: '地点', teacher: '授课老师', courseCode: '课序号',
  examForm: '考试形式', supervisor: '监考老师',
  labTeacher: '实验指导老师', labContent: '实验内容',
}

export function parseTimeQuery(q: string): { text: string; dateFilter?: (d: Date) => boolean } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (q.includes('今天')) return { text: q.replace('今天', ''), dateFilter: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === today.getTime() }
  if (q.includes('明天')) {
    const t = new Date(today); t.setDate(t.getDate() + 1)
    return { text: q.replace('明天', ''), dateFilter: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === t.getTime() }
  }
  if (q.includes('后天')) {
    const t = new Date(today); t.setDate(t.getDate() + 2)
    return { text: q.replace('后天', ''), dateFilter: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === t.getTime() }
  }
  if (q.includes('本周')) {
    const start = new Date(today); start.setDate(today.getDate() - today.getDay())
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { text: q.replace('本周', ''), dateFilter: (d) => d >= start && d <= new Date(end.getTime() + 86400000) }
  }
  if (q.includes('下周')) {
    const start = new Date(today); start.setDate(today.getDate() - today.getDay() + 7)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { text: q.replace('下周', ''), dateFilter: (d) => d >= start && d <= new Date(end.getTime() + 86400000) }
  }
  for (let i = 0; i < 7; i++) {
    const label = `周${DAY_NAMES[i]}`
    if (q.includes(label)) return { text: q.replace(label, ''), dateFilter: (d) => d.getDay() === i }
  }
  const timeMatch = q.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    const h = parseInt(timeMatch[1]), m = parseInt(timeMatch[2])
    return { text: q.replace(timeMatch[0], ''), dateFilter: (d) => d.getHours() === h && d.getMinutes() === m }
  }
  const dateMatch = q.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/) || q.match(/(\d{1,2})[-\/](\d{1,2})/)
  if (dateMatch) {
    if (dateMatch.length === 4) {
      const [_, y, mo, d] = dateMatch
      const target = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d))
      return { text: q.replace(dateMatch[0], ''), dateFilter: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === target.getTime() }
    } else if (dateMatch.length === 3) {
      const [_, mo, d] = dateMatch
      const target = new Date(today.getFullYear(), parseInt(mo) - 1, parseInt(d))
      return { text: q.replace(dateMatch[0], ''), dateFilter: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === target.getTime() }
    }
  }
  return { text: q }
}
