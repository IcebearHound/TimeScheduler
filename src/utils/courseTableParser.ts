/**
 * 山东大学课程表XLS解析器
 *
 * 课表结构（标准）：
 *   第1行：标题（学生个人课表）
 *   第2行：学年学期、班级、院系、打印日期
 *   第3行：星期X（星期一~星期日）
 *   第4-8行：5个时间段（第一节~第五节）的课程
 *   第9+行：备注
 *
 * 每个课程单元格字段（空格分隔）：
 *   [课程名]  课序号:(N)  sdXXXXXX  [(班级)]  [教师]  第X周([周])[XX-XX节]  [地点]
 *
 * 同一单元格可能包含多个课程（换行分隔，或按课序号边界拆分）
 *
 * 解析策略：
 *   1. 扫描所有行找到星期标题行（含"星期一"的行）
 *   2. 标题行之后5行为课程数据行
 *   3. 课程数据行之后扫描"备注"行
 *
 * 调试：如果解析结果为空，将输出原始行列信息到控制台。
 */
import * as XLSX from 'xlsx'
import { Event, EventChain } from '../types/event'
import { generateId } from './idGenerator'

export interface ParsedCourse {
  name: string
  courseCode: string
  sdCode: string
  teacher: string
  location?: string
  weekNumbers: number[]
  dayOfWeek: number     // 1=周一 ... 7=周日
  startSection: number  // 起始小节 (1-11)
  endSection: number    // 结束小节
}

export interface CourseImportResult {
  success: boolean
  eventChains: EventChain[]
  events: Event[]
  errors: string[]
  warnings: string[]
  message: string
  remark?: string
}

/** 小节 → 开始+结束时间 */
const SECTION_TIME_MAP: Record<number, { start: string; end: string }> = {
  1:  { start: '08:00', end: '09:05' },
  2:  { start: '09:05', end: '09:50' },
  3:  { start: '10:10', end: '10:55' },
  4:  { start: '10:55', end: '12:00' },
  5:  { start: '14:00', end: '14:45' },
  6:  { start: '14:45', end: '15:50' },
  7:  { start: '16:10', end: '16:55' },
  8:  { start: '16:55', end: '18:00' },
  9:  { start: '19:00', end: '19:50' },
  10: { start: '19:50', end: '20:50' },
  11: { start: '20:50', end: '21:00' },
}

const WEEKDAY_MAP: Record<string, number> = {
  '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4,
  '星期五': 5, '星期六': 6, '星期日': 7,
}

const COURSE_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  '#84CC16', '#6366F1', '#14B8A6', '#D946EF',
]

// ============ 主入口 ============

/** 从 File 对象解析课程表 */
export async function parseCourseTableFile(file: File): Promise<{
  courses: ParsedCourse[]
  remark?: string
  errors: string[]
}> {
  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array', cellStyles: true })

    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    if (!sheet || !sheet['!ref']) {
      return { courses: [], errors: ['无法读取工作表，文件可能损坏'] }
    }

    // 直接读取单元格，避免 sheet_to_json 合并单元格问题
    const range = XLSX.utils.decode_range(sheet['!ref'])
    const rows: any[][] = []

    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: any[] = []
      let hasContent = false
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c })
        const cell = sheet[cellRef]
        if (cell) {
          const v = cell.w || cell.v || ''
          row.push(v)
          if (String(v).trim()) hasContent = true
        } else {
          row.push('')
        }
      }
      rows.push(row)
    }

    if (rows.length < 3) {
      return { courses: [], errors: [`文件仅 ${rows.length} 行数据，可能不是有效的课表文件`] }
    }

    const result = parseRows(rows)
    return result
  } catch (error) {
    return { courses: [], errors: [`文件解析失败: ${String(error)}`] }
  }
}

// ============ 行级解析 ============

function parseRows(rows: any[][]): {
  courses: ParsedCourse[]
  remark?: string
  errors: string[]
} {
  // ---- 1. 找到星期标题行 ----
  let headerRowIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const hasDayLabel = row.some(cell => WEEKDAY_MAP[String(cell).trim()])
    if (hasDayLabel) { headerRowIdx = i; break }
  }

  if (headerRowIdx < 0) {
    const preview = rows.slice(0, 6).map((r, i) =>
      `[行${i}]: ` + (r || []).slice(0, 8).map(c => String(c || '').substring(0, 30)).join(' | ')
    ).join('\n')
    return { courses: [], errors: [`未找到星期标题行（需包含"星期一"~"星期日"）。\n\n文件前6行预览:\n${preview}`] }
  }

  // ---- 2. 解析星期列映射 ----
  const headerRow = rows[headerRowIdx]
  const dayColumns = new Map<number, number>() // dayOfWeek → colIndex
  for (let ci = 0; ci < headerRow.length; ci++) {
    const day = WEEKDAY_MAP[String(headerRow[ci]).trim()]
    if (day) dayColumns.set(day, ci)
  }

  if (dayColumns.size === 0) {
    return { courses: [], errors: ['星期标题行内容无法识别，请确认格式。'] }
  }

  // ---- 3. 解析课程数据行 ----
  // 星期标题行后的行就是课程数据。标准布局有5行。
  const allCourses: ParsedCourse[] = []
  let dataRowCount = 0

  for (let ri = headerRowIdx + 1; ri < rows.length; ri++) {
    const row = rows[ri]
    if (!row) continue

    const rowText = row.map(c => String(c)).join('')
    if (rowText.includes('备注')) break

    // 检查是否有课程数据
    const hasCourseData = row.some(c => {
      const s = String(c)
      return s.includes('课序号:') || s.includes('课序号：')
    })

    if (!hasCourseData) {
      if (dataRowCount >= 5) break
      if (rowText.trim() === '') continue
      continue // skip non-course rows without counting
    }

    dayColumns.forEach((colIdx, dayOfWeek) => {
      const cellValue = row[colIdx]
      const cellStr = String(cellValue || '').trim()
      if (!cellStr) return

      const coursesInCell = parseCell(cellStr, dayOfWeek)
      allCourses.push(...coursesInCell)
    })

    dataRowCount++
    if (dataRowCount >= 5) break
  }

  // ---- 4. 解析备注 ----
  let remark: string | undefined
  for (let ri = headerRowIdx + 5; ri < rows.length; ri++) {
    const row = rows[ri]
    if (!row) continue
    const fullText = row.map(c => String(c)).join(' ')
    if (fullText.includes('备注')) {
      const cleaned = fullText.replace(/^.*?备注[：:]\s*/, '').trim()
      if (cleaned) remark = cleaned
      break
    }
  }

  // ---- 5. 合并跨节重复 ----
  const merged = mergeCourses(allCourses)

  const errors: string[] = []
  if (merged.length === 0) {
    const dataRows = rows.slice(headerRowIdx, headerRowIdx + 6)
    const preview = dataRows.map((r, i) =>
      `[数据行${i}]: ` + (r || []).slice(0, 8).map(c => {
        const s = String(c || '')
        return s.length > 40 ? s.substring(0, 40) + '...' : s
      }).join(' | ')
    ).join('\n')
    errors.push(`未从课表中解析到任何课程。\n\n标题行之后的数据行预览:\n${preview}\n\n可能原因：1) 文件不是山东大学标准课表；2) 课表格式有变化。`)
  }

  return { courses: merged, remark, errors }
}

// ============ 单元格解析 ============

function parseCell(cellText: string, dayOfWeek: number): ParsedCourse[] {
  // XLS单元格内每个字段独占一行（\n分隔），先拼接为空格分隔的完整文本再解析
  const normalizedText = cellText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .join(' ')

  if (!normalizedText) return []

  const singleResult = parseSingleCourseLine(normalizedText, dayOfWeek)
  const courses: ParsedCourse[] = singleResult ? [singleResult] : []

  const markerCount = (normalizedText.match(/课序号[:：]/g) || []).length
  if (courses.length <= 1 && markerCount > 1) {
    const multiCourses = splitByCourseMarker(normalizedText, dayOfWeek)
    if (multiCourses.length > 1) return multiCourses
  }

  return courses
}

/** 按"课序号[:：]"边界切分多课程文本（兼容半角/全角冒号） */
function splitByCourseMarker(text: string, dayOfWeek: number): ParsedCourse[] {
  const positions: number[] = []
  const pattern = /课序号[:：]/g
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text)) !== null) positions.push(m.index)

  if (positions.length <= 1) {
    const c = parseSingleCourseLine(text, dayOfWeek)
    return c ? [c] : []
  }

  const courses: ParsedCourse[] = []
  for (let i = 0; i < positions.length; i++) {
    const markerPos = positions[i]
    const nextMarkerPos = i < positions.length - 1 ? positions[i + 1] : text.length

    // 课程名：紧邻课序号前的连续非空白文本
    let nameEnd = markerPos
    while (nameEnd > 0 && /[\s　]/.test(text[nameEnd - 1])) nameEnd--
    let nameStart = nameEnd
    while (nameStart > 0 && !/[\s　]/.test(text[nameStart - 1])) nameStart--

    // 课程终点：下一门课程名之前（或文本末尾）
    let courseEnd: number
    if (i < positions.length - 1) {
      let nextNameEnd = nextMarkerPos
      while (nextNameEnd > 0 && /[\s　]/.test(text[nextNameEnd - 1])) nextNameEnd--
      let nextNameStart = nextNameEnd
      while (nextNameStart > 0 && !/[\s　]/.test(text[nextNameStart - 1])) nextNameStart--
      courseEnd = nextNameStart
    } else {
      courseEnd = text.length
    }

    const line = text.substring(nameStart, courseEnd).trim()
    const c = parseSingleCourseLine(line, dayOfWeek)
    if (c) courses.push(c)
  }
  return courses
}

// ============ 单课程行解析 ============

/**
 * 解析单条课程文本
 * 按连续空格切分字段，然后逐字段归类：
 *   [0] 课程名  [1] 课序号  [2] sd代码  [3*] (班级)  [4*] 教师  [5*] 第X周[节]  [6*] 地点
 */
function parseSingleCourseLine(line: string, dayOfWeek: number): ParsedCourse | null {
  if (!line || line.length < 5) return null

  // XLS单元格内字段间为单个空格分隔
  const fields = line.split(/[\s　]+/).map(f => f.trim()).filter(Boolean)
  if (fields.length < 2) return null

  let name = ''
  let classCode = ''
  let sdCode = ''
  let teacher = ''
  let weekField = ''
  let location: string | undefined

  for (const field of fields) {
    const f = field

    // 课序号
    if (f.startsWith('课序号:') || f.startsWith('课序号：')) {
      classCode = f.replace(/课序号[：:]\s*/, '').replace(/[()（）]/g, '')
    }
    // sd 课程代码
    else if (/^sd\d/i.test(f)) {
      sdCode = f
    }
    // 周次 + 节次（可能在同一字段或分开）
    else if ((f.startsWith('第') && f.includes('周')) || /\[.*节\]/.test(f)) {
      weekField += (weekField ? ' ' : '') + f
    }
    // 地点（含校区/苑/楼/场/教室/厅）
    else if (f.includes('校区') || /[^\x00-\x7F]+(?:苑|楼|场|教室|厅)/.test(f)) {
      location = f
    }
    // 课程名（第一个非特殊字段）
    else if (!name) {
      name = f
    }
    // 班级备注 (like "(计算机学院1班)") — 跳过
    else if (/^[（(].+[）)]$/.test(f)) {
      continue
    }
    // 教师
    else if (!teacher) {
      teacher = f
    }
  }

  if (!name) return null

  // 解析周次
  const weekNumbers = parseWeekNumbers(weekField)

  // 解析节次范围：提取所有数字，取首尾（兼容 [01-02节] 和 [01-02-03-04节]）
  const sectionNums = weekField.match(/\[(\d+(?:-\d+)*)节\]/)?.[1]?.split('-').map(Number)
  let startSection = 1
  let endSection = 2
  if (sectionNums && sectionNums.length >= 2) {
    startSection = sectionNums[0]
    endSection = sectionNums[sectionNums.length - 1]
    if (startSection > endSection) [startSection, endSection] = [endSection, startSection]
  }

  return {
    name,
    courseCode: classCode,
    sdCode,
    teacher,
    location,
    weekNumbers,
    dayOfWeek,
    startSection,
    endSection,
  }
}

// ============ 周次解析 ============

function parseWeekNumbers(field: string): number[] {
  // 范围：第1-16周
  const rangeMatch = field.match(/第(\d+)\s*-\s*(\d+)周/)
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1])
    const end = parseInt(rangeMatch[2])
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  // 列表：第6周,第8周,第10周,第12周 或 第6周,第8周
  const listMatch = field.matchAll(/第(\d+)周/g)
  const weeks: number[] = []
  for (const m of listMatch) weeks.push(parseInt(m[1]))
  if (weeks.length > 0) return weeks

  return []
}

// ============ 去重合并 ============

/**
 * 同一课程在同一天、同一周次列表中可能因为跨节而出现在多行。
 * 将它们合并为单条，取最大的节次范围。
 */
function mergeCourses(courses: ParsedCourse[]): ParsedCourse[] {
  const groups = new Map<string, ParsedCourse[]>()

  for (const c of courses) {
    const key = `${c.name}|${c.dayOfWeek}|${c.weekNumbers.join(',')}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }

  const merged: ParsedCourse[] = []
  for (const [, group] of groups) {
    if (group.length === 1) {
      merged.push(group[0])
      continue
    }

    let minStart = Infinity
    let maxEnd = -Infinity
    let best = group[0]

    for (const c of group) {
      if (c.startSection < minStart) minStart = c.startSection
      if (c.endSection > maxEnd) maxEnd = c.endSection
      if (c.location && !best.location) best = c
      if (c.teacher && !best.teacher) best = c
    }

    if (minStart > maxEnd) [minStart, maxEnd] = [maxEnd, minStart]
    merged.push({ ...best, startSection: minStart, endSection: maxEnd })
  }

  return merged
}

// ============ 课程→事件转换 ============

export function coursesToEvents(
  courses: ParsedCourse[],
  semesterStartDate: Date
): { eventChains: EventChain[]; events: Event[] } {
  const courseGroups = new Map<string, ParsedCourse[]>()
  for (const c of courses) {
    if (!courseGroups.has(c.name)) courseGroups.set(c.name, [])
    courseGroups.get(c.name)!.push(c)
  }

  const eventChains: EventChain[] = []
  const events: Event[] = []
  let colorIdx = 0

  for (const [courseName, entries] of courseGroups) {
    const chainId = generateId('chain')
    const color = COURSE_COLORS[colorIdx % COURSE_COLORS.length]
    colorIdx++

    const chain: EventChain = {
      id: chainId,
      name: courseName,
      typeId: 'type-course',
      color,
      defaultReminders: [
        { id: generateId('reminder'), time: '1d', enabled: true, notified: false },
        { id: generateId('reminder'), time: '2h', enabled: true, notified: false },
        { id: generateId('reminder'), time: '30min', enabled: true, notified: false },
      ],
      batchRules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    eventChains.push(chain)

    const sampleTeacher = entries.find(e => e.teacher)?.teacher || ''
    const sampleCode = entries.find(e => e.courseCode)?.courseCode || ''

    for (const entry of entries) {
      for (const weekNum of entry.weekNumbers) {
        const eventDate = new Date(semesterStartDate)
        eventDate.setDate(eventDate.getDate() + (weekNum - 1) * 7 + (entry.dayOfWeek - 1))

        const startTime = new Date(eventDate)
        const startSlot = SECTION_TIME_MAP[entry.startSection]
        if (startSlot) {
          const [sh, sm] = startSlot.start.split(':').map(Number)
          startTime.setHours(sh, sm, 0, 0)
        }

        let endTime = new Date(eventDate)
        const endSlot = SECTION_TIME_MAP[entry.endSection]
        if (endSlot) {
          const [eh, em] = endSlot.end.split(':').map(Number)
          endTime.setHours(eh, em, 0, 0)
        }
        if (endTime <= startTime) endTime = new Date(startTime.getTime() + 50 * 60 * 1000)

        events.push({
          id: generateId('event'),
          name: entry.name,
          chainId,
          typeId: 'type-course',
          startTime,
          endTime,
          reminders: [],
          properties: {
            地点: entry.location,
            授课老师: entry.teacher || sampleTeacher,
            课序号: entry.courseCode || sampleCode,
          },
          isHighlight: false,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
    }
  }

  return { eventChains, events }
}
