import type { EventType } from '../types/event'
export function ensureDefaultTaskTypes<T extends EventType>(types: T[]): (T | EventType)[] {
  const result: (T | EventType)[] = [...types]
  for (const value of [
    { id: 'type-exam', name: '考试', emoji: '📝', category: 'exam' as const, color: '#EF4444', propertyFields: [{ name: '地点', icon: 'MapPin' }] },
    { id: 'type-lab', name: '实验', emoji: '🔬', category: 'lab' as const, color: '#10B981', propertyFields: [{ name: '地点', icon: 'MapPin' }, { name: '实验内容', icon: 'BookOpen' }] },
    { id: 'type-homework', name: '作业', emoji: '📖', category: 'homework' as const, color: '#8B5CF6', propertyFields: [{ name: 'taskContent', icon: 'BookOpen' }, { name: 'submissionUrl', icon: 'Link' }] },
  ]) {
    if (result.some(t => t.category === value.category)) continue
    let id = value.id
    while (result.some(t => t.id === id)) id += '-default'
    result.push({ ...value, id })
  }
  return result
}
