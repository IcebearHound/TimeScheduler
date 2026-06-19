/**
 * 右下角 Toast 通知容器
 */
import React from 'react'
import { X, RotateCcw } from 'lucide-react'
import useUIStore from '../stores/uiStore'

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts)
  const removeToast = useUIStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 animate-[slideUp_0.3s_ease-out] max-w-sm">
          <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{t.message}</span>
          {t.action && (
            <button onClick={() => { t.actionFn?.(); removeToast(t.id) }}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors whitespace-nowrap">
              <RotateCcw className="w-3 h-3" />
              {t.action}
            </button>
          )}
          <button onClick={() => removeToast(t.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
