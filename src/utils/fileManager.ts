/**
 * 文件管理工具 - 事件组 .events 文件导出导入
 */
import { EventGroup, Event as AppEvent, EventChain } from '../types/event'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'

interface EventsFileData {
  version: string
  exportTime: string
  eventGroup: EventGroup
  events: AppEvent[]
  eventChains: EventChain[]
}

export class FileManager {
  static exportEventGroup(group: EventGroup): string {
    const eventStore = useEventStore.getState()
    const relatedEvents: AppEvent[] = []
    const relatedChains: EventChain[] = []

    // 收集单独事件
    for (const eventId of group.eventIds) {
      const event = eventStore.getEvent(eventId)
      if (event) relatedEvents.push(event)
    }

    // 收集事件链及链内事件
    for (const chainId of group.eventChainIds) {
      const chain = eventStore.getEventChain(chainId)
      if (chain) {
        relatedChains.push(chain)
        const chainEvents = eventStore.getEventsByChain(chainId)
        for (const event of chainEvents) {
          if (!relatedEvents.find(e => e.id === event.id)) {
            relatedEvents.push(event)
          }
        }
      }
    }

    const data: EventsFileData = {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      eventGroup: group,
      events: relatedEvents,
      eventChains: relatedChains,
    }

    return JSON.stringify(data, (key, value) => {
      if (value instanceof Date) return value.toISOString()
      return value
    }, 2)
  }

  static importEventGroup(jsonString: string): { success: boolean; error?: string; groupId?: string } {
    try {
      const data: EventsFileData = JSON.parse(jsonString)
      if (!data.version || !data.eventGroup) {
        return { success: false, error: '无效的 .events 文件格式，缺少版本或事件组数据' }
      }

      const eventStore = useEventStore.getState()
      const groupStore = useEventGroupStore.getState()

      // 导入事件链
      const chainIdMap = new Map<string, string>() // old -> new id
      if (data.eventChains) {
        for (const chain of data.eventChains) {
          const oldId = chain.id
          const newChain = eventStore.addEventChain({
            name: chain.name,
            description: chain.description,
            typeId: chain.typeId,
            color: chain.color,
            defaultReminders: chain.defaultReminders || [],
          })
          chainIdMap.set(oldId, newChain.id)
        }
      }

      // 导入事件
      const eventIdMap = new Map<string, string>()
      if (data.events) {
        for (const event of data.events) {
          const newChainId = chainIdMap.get(event.chainId) || event.chainId
          const newEvent = eventStore.addEvent({
            name: event.name,
            description: event.description,
            startTime: new Date(event.startTime),
            endTime: new Date(event.endTime),
            chainId: newChainId,
            typeId: event.typeId,
            reminders: event.reminders || [],
            properties: event.properties || {},
            isHighlight: event.isHighlight || false,
            priority: event.priority || 0,
            color: event.color,
          })
          eventIdMap.set(event.id, newEvent.id)
        }
      }

      // 创建新的事件组（独立，不融合）
      const newChainIds = data.eventGroup.eventChainIds
        .map(oldId => chainIdMap.get(oldId))
        .filter(Boolean) as string[]

      const importedGroupEvents = data.eventGroup.eventIds
        .map(oldId => eventIdMap.get(oldId))
        .filter(Boolean) as string[]

      const newGroup = groupStore.addGroup({
        name: `${data.eventGroup.name} (导入)`,
        emoji: data.eventGroup.emoji || '📁',
        eventChainIds: newChainIds,
        eventIds: importedGroupEvents,
        description: data.eventGroup.description,
      })

      return { success: true, groupId: newGroup.id }
    } catch (error) {
      return { success: false, error: `导入失败: ${error instanceof Error ? error.message : '未知错误'}` }
    }
  }

  static downloadAsFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  static uploadFile(accept: string = '.events,.json'): Promise<string> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept

      input.onchange = async (ev: globalThis.Event) => {
        const file = (ev.target as HTMLInputElement).files?.[0]
        if (!file) { reject(new Error('未选择文件')); return }
        try {
          const text = await file.text()
          resolve(text)
        } catch (error) { reject(error) }
      }

      input.click()
    })
  }
}
