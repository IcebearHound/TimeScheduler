/**
 * 右下角 Toast 通知容器
 */
import React from 'react'
import { X, RotateCcw } from 'lucide-react'
import useUIStore from '../stores/uiStore'
import { navigateToEvent, navigateToChain, navigateToGroup, navigateToType } from '../utils/navigation'

function getNavFn(type: string) {
  switch (type) {
    case 'event': return navigateToEvent
    case 'chain': return navigateToChain
    case 'group': return navigateToGroup
    case 'type': return navigateToType
    default: return null
  }
}

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts)
  const removeToast = useUIStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-overlay border border-slate-200/60 dark:border-slate-700/60 animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)] max-w-sm">
          <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
            {t.message}
            {t.affected && t.affected.length > 0 && (
              <>
                {' → '}
                {t.affected.map((a, i) => {
                  const nav = getNavFn(a.type)
                  return (
                    <React.Fragment key={a.id}>
                      {i > 0 && <span className="text-slate-400">, </span>}
                      {nav ? (
                        <button onClick={() => { nav(a.id); removeToast(t.id) }}
                          className="font-medium text-accent-600 dark:text-accent-400 hover:underline cursor-pointer">
                          『{a.name}』
                        </button>
                      ) : (
                        <span className="font-medium text-slate-600 dark:text-slate-300">『{a.name}』</span>
                      )}
                    </React.Fragment>
                  )
                })}
              </>
            )}
          </span>
          {t.action && (
            <button onClick={() => { t.actionFn?.(); removeToast(t.id) }}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-900/20 rounded-lg hover:bg-accent-100 dark:hover:bg-accent-900/40 transition-colors whitespace-nowrap">
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
