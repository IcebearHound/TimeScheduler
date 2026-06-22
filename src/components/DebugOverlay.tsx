/**
 * 调试面板 - 显示撤销/重做操作日志
 */
import React, { useState, useEffect, useRef } from 'react'
import { getDebugLog, subscribeDebug, clearDebugLog, DebugEntry } from '../utils/debugStore'
import useEventStore from '../stores/eventStore'

export default function DebugOverlay() {
  const [, forceUpdate] = useState(0)
  const canUndo = useEventStore((s) => s.canUndo)
  const canRedo = useEventStore((s) => s.canRedo)
  const undoLen = useEventStore((s) => s.undoStack.length)
  const redoLen = useEventStore((s) => s.redoStack.length)
  const eventsCount = useEventStore((s) => s.events.size)
  const [expanded, setExpanded] = useState(true)
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission>('default')
  const notifyPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!('Notification' in window)) return
    setNotifyPermission(Notification.permission)
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => setNotifyPermission(p))
    }
    if (expanded) {
      notifyPollRef.current = setInterval(() => {
        setNotifyPermission(Notification.permission)
      }, 2000)
    }
    return () => {
      if (notifyPollRef.current) clearInterval(notifyPollRef.current)
    }
  }, [expanded])

  const handleTestNotification = () => {
    if (!('Notification' in window)) return
    Notification.requestPermission().then(p => {
      setNotifyPermission(p)
      if (p === 'granted') {
        new Notification('测试通知', {
          body: '这是一条来自时间规划器的测试提醒',
        })
      }
    })
  }

  useEffect(() => {
    return subscribeDebug(() => forceUpdate(n => n + 1))
  }, [])

  const log = getDebugLog()

  const typeColors: Record<string, string> = {
    pushHistory: 'text-amber-500',
    undo: 'text-blue-400',
    redo: 'text-green-400',
    move: 'text-purple-400',
  }

  return (
    <div className="fixed bottom-4 left-4 z-[300] pointer-events-auto">
      {expanded ? (
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[34rem] max-h-[500px] flex flex-col overflow-hidden text-xs font-mono">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0 gap-2">
            <span className="text-slate-300 font-bold flex-shrink-0">🔍 调试面板</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-slate-500 text-[11px]">undo:{undoLen} redo:{redoLen} ev:{eventsCount}</span>
              <span className={canUndo ? 'text-green-400' : 'text-slate-600'}>Z</span>
              <span className={canRedo ? 'text-green-400' : 'text-slate-600'}>Y</span>
              <span className={notifyPermission === 'granted' ? 'text-green-400' : notifyPermission === 'denied' ? 'text-red-400' : 'text-slate-500'}>
                通知:{notifyPermission === 'granted' ? '✓' : notifyPermission === 'denied' ? '✗' : '?'}
              </span>
              <button type="button" onClick={handleTestNotification} className="text-slate-500 hover:text-accent-400 px-1 cursor-pointer">📢</button>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={clearDebugLog} className="text-slate-500 hover:text-slate-300 px-1">清</button>
              <button onClick={() => setExpanded(false)} className="text-slate-500 hover:text-slate-300 px-1">_</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {log.length === 0 && (
              <div className="text-slate-600 py-4 text-center">等待操作...</div>
            )}
            {log.map((entry, i) => (
              <div key={i} className="flex gap-1 items-start">
                <span className={`flex-shrink-0 w-20 ${typeColors[entry.type] || 'text-slate-500'}`}>
                  {entry.type}
                </span>
                <span className="text-slate-400 flex-1 truncate">
                  {entry.action}
                  {entry.affected && entry.affected.length > 0 && (
                    <span className="text-slate-500">
                      {' '}[{entry.affected.map(a => a.name).join(', ')}]
                    </span>
                  )}
                </span>
                <span className="text-slate-600 flex-shrink-0 text-right w-20">
                  u:{entry.undoStackLen} r:{entry.redoStackLen}
                </span>
              </div>
            ))}
          </div>
          {log.length > 0 && (
            <div className="px-3 py-1.5 bg-slate-800 border-t border-slate-700 text-slate-500 flex-shrink-0">
              最近: {log[log.length - 1].type} {log[log.length - 1].action} (u:{log[log.length - 1].undoStackLen} r:{log[log.length - 1].redoStackLen})
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded(true)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-slate-200 shadow-xl">
            🔍 调试 (u:{undoLen}/r:{redoLen})
          </button>
          <button type="button" onClick={handleTestNotification}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-slate-200 shadow-xl cursor-pointer">
            📢测试通知
          </button>
        </div>
      )}
    </div>
  )
}
