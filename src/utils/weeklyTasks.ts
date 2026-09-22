import { z } from 'zod'
import { CourseTaskInput, createCourseTaskActions } from '../integrations/courseTasks'
import { Action, projectActions, Snapshot } from '../integrations/contracts'
export const weeklyTaskRuleSchema = z.object({ count: z.number().int().min(1).max(52), intervalWeeks: z.number().int().min(1).max(12) }).strict()
/** Materializes bounded weekly occurrences; local clock times stay fixed across DST. */
export function createWeeklyTaskActions(snapshot: Snapshot, inputs: CourseTaskInput[], rule: z.infer<typeof weeklyTaskRuleSchema>, newId = () => crypto.randomUUID()): Action[] {
  const { count, intervalWeeks } = weeklyTaskRuleSchema.parse(rule)
  if (!inputs.length || inputs.length * count > 200) throw new Error('一次最多创建 200 个事项')
  let working = snapshot
  const result: Action[] = []
  const shift = (iso: string, days: number) => { const date = new Date(iso); date.setDate(date.getDate() + days); return date.toISOString() }
  for (let n = 0; n < count; n++) {
    const groups = new Map<string, string>()
    for (const input of inputs) {
      const group = input.labGroupId
      if (group && !groups.has(group)) groups.set(group, n === 0 ? group : newId())
      const actions = createCourseTaskActions(working, { ...input, number: n === 0 ? input.number : undefined, endTime: shift(input.endTime, n * intervalWeeks * 7), ...(input.startTime ? { startTime: shift(input.startTime, n * intervalWeeks * 7) } : {}), ...(group ? { labGroupId: groups.get(group) } : {}) })
      working = projectActions(working, actions, newId)
      result.push(...actions)
    }
  }
  return result
}
