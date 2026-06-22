import { scrollToEventBlock } from './scrollTarget'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'

export function navigateToEvent(eventId: string) {
  const ui = useUIStore.getState()
  const es = useEventStore.getState()
  const event = es.getEvent(eventId)
  if (!event) return
  scrollToEventBlock(eventId)
  ui.setFlashEventId(eventId)
  ui.setCurrentDate(new Date(event.startTime))
  ui.setSelectedEvent(eventId)
}

export function navigateToChain(chainId: string) {
  const es = useEventStore.getState()
  const ui = useUIStore.getState()
  const events = es.getEventsByChain(chainId)
  if (events.length > 0) {
    scrollToEventBlock(events[0].id)
    ui.setFlashEventId(events[0].id)
    ui.setCurrentDate(new Date(events[0].startTime))
    ui.setSelectedEvent(events[0].id)
  }
}

export function navigateToGroup(groupId: string) {
  const gs = useEventGroupStore.getState()
  if (!gs.getGroup(groupId)) return
  gs.setActiveGroup(groupId)
}

export function navigateToType(typeId: string) {
  const ui = useUIStore.getState()
  ui.setTypeToEditId(typeId)
  ui.setIsTypeManagerOpen(true)
}
