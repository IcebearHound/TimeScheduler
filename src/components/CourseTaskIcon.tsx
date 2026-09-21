import { FlaskConical, ClipboardCheck, FileText, BookOpen, GraduationCap } from 'lucide-react'
import { CourseTaskKind } from '../utils/courseTasks'

const icons = { 实验课: FlaskConical, 实验验收: ClipboardCheck, 实验报告: FileText, 作业: BookOpen, 考试: GraduationCap }
export default function CourseTaskIcon({ kind, size = 16, className = '' }: { kind: CourseTaskKind; size?: number; className?: string }) {
  const Icon = icons[kind]
  return <Icon size={size} className={`shrink-0 ${className}`} aria-hidden="true" data-course-task-icon={kind} />
}
