/**
 * 课程导入工具 - 山东大学课表导入
 * 委托给 courseTableParser.ts 的统一解析器
 */
import { CourseCell, CourseImportResult } from '../types/course'
import { parseCourseTableFile, coursesToEvents } from './courseTableParser'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'

export class CourseImporter {
  /** 从Excel文件导入课程 */
  static async importFromFile(
    file: File,
    semesterStartDate: Date
  ): Promise<CourseImportResult> {
    try {
      const { courses, remark, errors } = await parseCourseTableFile(file)

      if (errors.length > 0) {
        return {
          success: false,
          coursesImported: [],
          errors,
        }
      }

      const courseCells: CourseCell[] = courses.map(c => ({
        courseCode: c.courseCode,
        courseName: c.name,
        classCode: '',
        teacher: c.teacher,
        weeks: c.weekNumbers.join(','),
        weekPattern: 'every' as const,
        weekNumbers: c.weekNumbers,
        dayOfWeek: c.dayOfWeek - 1,
        period: Math.ceil(c.startSection / 2),
        startHour: 8,
        startMin: 0,
        endHour: 9,
        endMin: 50,
        location: c.location,
        isWeekly: c.weekNumbers.length > 10,
      }))

      // 创建事件
      const { eventChains, events } = coursesToEvents(courses, semesterStartDate)
      const eventStore = useEventStore.getState()
      const groupStore = useEventGroupStore.getState()

      const chainIds: string[] = []
      for (const chain of eventChains) {
        const created = eventStore.addEventChain({
          name: chain.name,
          typeId: chain.typeId,
          color: chain.color,
          defaultReminders: chain.defaultReminders,
        })
        chainIds.push(created.id)
      }

      const nameToChainId = new Map<string, string>()
      for (let i = 0; i < eventChains.length; i++) {
        nameToChainId.set(eventChains[i].name, chainIds[i])
      }

      for (const evt of events) {
        const resolvedChainId = nameToChainId.get(evt.name) || chainIds[0]
        eventStore.addEvent({
          name: evt.name,
          startTime: new Date(evt.startTime),
          endTime: new Date(evt.endTime),
          chainId: resolvedChainId,
          typeId: evt.typeId,
          reminders: evt.reminders,
          properties: evt.properties,
          isHighlight: false,
          priority: 0,
        })
      }

      eventStore.setSemesterStartDate(semesterStartDate)

      if (chainIds.length > 0) {
        groupStore.ensureActiveGroup()
        const activeGroup = groupStore.getActiveGroup()
        if (activeGroup) {
          groupStore.updateGroup(activeGroup.id, {
            eventChainIds: Array.from(new Set([...activeGroup.eventChainIds, ...chainIds])),
          })
        }
      }

      return {
        success: true,
        coursesImported: courseCells,
        errors: remark ? [`备注: ${remark}`] : [],
        semester: undefined,
      }
    } catch (error) {
      return {
        success: false,
        coursesImported: [],
        errors: [`导入失败: ${String(error)}`],
      }
    }
  }
}
