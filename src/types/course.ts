/**
 * 课程导入相关的类型
 */
export interface CourseCell {
  courseCode: string
  courseName: string
  classCode: string
  teacher: string
  weeks: string
  weekPattern: 'every' | 'specific' | 'odd' | 'even'
  weekNumbers: number[]
  dayOfWeek: number
  period: number
  startHour: number
  startMin: number
  endHour: number
  endMin: number
  location?: string
  isWeekly: boolean
}

export interface CourseImportResult {
  success: boolean
  coursesImported: CourseCell[]
  errors: string[]
  semester?: string
}
