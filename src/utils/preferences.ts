export type Preferences = { showGroupEmoji: boolean; todoHighlightDays: number; todoUpcomingDays: number }
export const preferencesKey = 'time-scheduler-preferences-v1'
export function readPreferences(storage: Pick<Storage, 'getItem'>): Preferences {
  const defaults = { showGroupEmoji: true, todoHighlightDays: 30, todoUpcomingDays: 3 }
  try {
    const value = JSON.parse(storage.getItem(preferencesKey) || '{}')
    const days = (value: unknown, fallback: number) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 365 ? value : fallback
    return { showGroupEmoji: typeof value.showGroupEmoji === 'boolean' ? value.showGroupEmoji : defaults.showGroupEmoji, todoHighlightDays: days(value.todoHighlightDays, 30), todoUpcomingDays: days(value.todoUpcomingDays, 3) }
  } catch { return defaults }
}
