import { FlaskConical, ClipboardCheck, FileText, GraduationCap } from 'lucide-react'
import { CourseTaskKind } from '../utils/courseTasks'

const icons = { 实验课: FlaskConical, 实验验收: ClipboardCheck, 实验报告: FileText, 考试: GraduationCap }
export default function CourseTaskIcon({ kind, size = 12, className = '' }: { kind: CourseTaskKind; size?: number; className?: string }) {
  if (kind === '作业') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true" data-course-task-icon={kind} data-task-notebook>
    <rect x="6" y="3" width="15" height="18" rx="2" /><path d="M3 6h5M3 10h5M3 14h5M3 18h5M12 8h5M12 12h5" />
  </svg>
  const Icon = icons[kind]
  return <Icon size={size} className={`shrink-0 ${className}`} aria-hidden="true" data-course-task-icon={kind} />
}
