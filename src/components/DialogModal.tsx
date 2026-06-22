/**
 * 自定义弹窗 - 替代原生 alert/confirm
 */
import React, { useEffect } from 'react'
import { AlertTriangle, CheckCircle, X } from 'lucide-react'

export interface DialogConfig {
  type: 'alert' | 'confirm'
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm?: () => void
  onCancel?: () => void
}

const variantStyles = {
  danger: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', btn: 'bg-red-600 hover:bg-red-700 shadow-sm shadow-red-600/20 rounded-lg', icon: <AlertTriangle className="w-8 h-8 text-red-500" /> },
  warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', btn: 'bg-amber-600 hover:bg-amber-700', icon: <AlertTriangle className="w-8 h-8 text-amber-500" /> },
  info: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', btn: 'bg-accent-600 hover:bg-accent-700 shadow-sm shadow-accent-600/20 rounded-lg', icon: <CheckCircle className="w-8 h-8 text-blue-500" /> },
}

export default function DialogModal({ config, onClose }: { config: DialogConfig; onClose: () => void }) {
  const s = variantStyles[config.variant || 'info']

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] animate-modal-backdrop" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`${s.bg} ${s.border} rounded-2xl shadow-2xl max-w-[min(28rem,90vw)] w-full mx-4 border animate-modal-panel`}>
        <div className="p-6 text-center">
          <div className="mb-4 flex justify-center">{s.icon}</div>
          <h3 className={`text-lg font-bold ${s.text} mb-2`}>{config.title}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{config.message}</p>
        </div>
        <div className="flex border-t border-slate-200/60 dark:border-slate-700/60">
          {config.type === 'confirm' && (
            <button onClick={() => { config.onCancel?.(); onClose() }}
              className="flex-1 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-bl-2xl transition-colors">
              {config.cancelLabel || '取消'}
            </button>
          )}
          <button onClick={() => { config.onConfirm?.(); onClose() }}
            className={`flex-1 px-4 py-3 text-sm font-medium text-white ${s.btn} ${config.type === 'alert' ? 'rounded-b-2xl' : 'rounded-br-2xl'} transition-colors`}>
            {config.confirmLabel || (config.type === 'confirm' ? '确定' : '知道了')}
          </button>
        </div>
      </div>
    </div>
  )
}
