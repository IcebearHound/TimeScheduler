import React, { Suspense, lazy } from 'react'
import useUIStore from '../stores/uiStore'
import LoadingState from './LoadingState'
import { Filter, X } from 'lucide-react'

const WeekView = lazy(() => import('./TimeTable/WeekView'))
const MonthView = lazy(() => import('./TimeTable/MonthView'))
const DayView = lazy(() => import('./TimeTable/DayView'))

export default function TimeTable() {
  const viewMode = useUIStore((state) => state.viewMode)
  const hiddenTypes = useUIStore(s => s.filterTypeIds.size), hiddenGroups = useUIStore(s => s.hiddenGroupIds.size)

  return (
    <div className="min-h-0 flex-1 w-full overflow-hidden flex flex-col">
      {(hiddenTypes > 0 || hiddenGroups > 0) && <div className="calendar-filter-notice"><Filter size={14} aria-hidden="true" /><span>已隐藏 {hiddenTypes} 个事件类型、{hiddenGroups} 个分组</span><button onClick={() => { const ui = useUIStore.getState(); ui.clearTypeFilters(); ui.clearHiddenGroups() }}><X size={13} />清除筛选</button></div>}
      <div className="min-h-0 flex-1">
      <Suspense fallback={<LoadingState label="正在加载日历…" />}>
        {viewMode === 'week' && <WeekView />}
        {viewMode === 'month' && <MonthView />}
        {viewMode === 'day' && <DayView />}
      </Suspense>
      </div>
    </div>
  )
}
