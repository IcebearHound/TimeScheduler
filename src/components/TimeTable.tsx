import React, { Suspense, lazy } from 'react'
import useUIStore from '../stores/uiStore'

const WeekView = lazy(() => import('./TimeTable/WeekView'))
const MonthView = lazy(() => import('./TimeTable/MonthView'))
const DayView = lazy(() => import('./TimeTable/DayView'))

function LoadingView() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="text-slate-600 dark:text-slate-400">加载中...</div>
    </div>
  )
}

export default function TimeTable() {
  const viewMode = useUIStore((state) => state.viewMode)

  return (
    <div className="h-full w-full overflow-hidden">
      <Suspense fallback={<LoadingView />}>
        {viewMode === 'week' && <WeekView />}
        {viewMode === 'month' && <MonthView />}
        {viewMode === 'day' && <DayView />}
      </Suspense>
    </div>
  )
}
