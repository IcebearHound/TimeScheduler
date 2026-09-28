import { z } from 'zod'
import { CourseTaskInput, LabInput, createCourseTaskActions, createLabActions, labInputSchema } from '../integrations/courseTasks'
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

/** Lab report rules are evaluated for each occurrence in Beijing time. */
export function createWeeklyLabActions(snapshot: Snapshot, raw: LabInput, rule: z.infer<typeof weeklyTaskRuleSchema>, newId = () => crypto.randomUUID()): Action[] {
  const input = labInputSchema.parse(raw), { count, intervalWeeks } = weeklyTaskRuleSchema.parse(rule)
  if (input.existingClassId) throw new Error('为已有实验补充报告请使用 create_lab')
  if (input.acceptanceAtNextClass) throw new Error('每周批量添加请指定首周验收截止时间')
  if (!input.startTime || !input.endTime) throw new Error('请填写实验课开始、结束时间')
  const shift = (value: string | undefined, n: number) => value ? new Date(+new Date(value) + n * intervalWeeks * 7 * 86400000).toISOString() : undefined
  const result: Action[] = []
  let working = snapshot
  for (let n = 0; n < count; n++) {
    const actions = createLabActions(working, { ...input, number: n === 0 ? input.number : undefined, reportNumber: n === 0 ? input.reportNumber : undefined, startTime: shift(input.startTime, n), endTime: shift(input.endTime, n), acceptanceDeadline: shift(input.acceptanceDeadline, n), reportDeadline: shift(input.reportDeadline, n) }, newId)
    result.push(...actions)
    if (result.length > 200) throw new Error('一次最多创建 200 项操作')
    working = projectActions(working, actions, newId)
  }
  return result
}
