import React, { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function NotificationPermissionPrompt({ onClose }: Props) {
  const [visible, setVisible] = useState(true)
  const [dontRemind, setDontRemind] = useState(false)
  const [permState, setPermState] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) handleDismiss()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [visible])

  const handleDismiss = () => {
    setVisible(false)
    if (dontRemind) {
      try { localStorage.setItem('notificationPromptSeen', 'true') } catch {}
    }
    setTimeout(() => onClose(), 200)
  }

  const handleEnable = async () => {
    if (!('Notification' in window)) return
    let result: NotificationPermission
    try {
      result = await Notification.requestPermission()
    } catch {
      result = 'denied'
    }
    setPermState(result)
    if (result === 'granted') {
      setTimeout(() => handleDismiss(), 1500)
    }
  }

  if (!visible) return null

  const isDenied = permState === 'denied'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-modal-backdrop" onClick={handleDismiss}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-modal-dark border border-slate-200/60 dark:border-slate-700/60 max-w-md w-full overflow-hidden animate-modal-panel"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-end px-5 pt-4">
          <button onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 text-center">
          {isDenied ? (
            <>
              <div className="text-5xl mb-4">🔕</div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                浏览器已阻止通知
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Chrome 对不熟悉的网站会自动拦截通知弹窗。<br />
                请按以下步骤手动开启：
              </p>
              <ol className="text-xs text-slate-500 dark:text-slate-400 text-left space-y-1 mb-4 px-2">
                <li>1. 点击地址栏左侧的 <span className="text-slate-700 dark:text-slate-200 font-medium">🔒 锁图标</span></li>
                <li>2. 找到"通知"，点击 <span className="text-slate-700 dark:text-slate-200 font-medium">允许</span></li>
                <li>3. 刷新页面即可</li>
              </ol>
              <div className="flex items-center justify-center gap-2 mb-4">
                <input type="checkbox" id="dontRemindDenied" checked={dontRemind}
                  onChange={e => setDontRemind(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-accent-600 focus:ring-accent-500" />
                <label htmlFor="dontRemindDenied" className="text-xs text-slate-400 dark:text-slate-500 cursor-pointer select-none">
                  不再提醒
                </label>
              </div>
              <button onClick={handleDismiss}
                className="px-8 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors">
                关闭
              </button>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/20 mb-4">
                <Bell className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                开启通知，不再错过重要事项
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                时间规划器会在事件开始前<br />
                按你设置的提醒时间发送桌面通知。<br />
                通知仅在本设备显示，不上传任何数据。
              </p>
              <div className="flex items-center justify-center gap-2 mb-4">
                <input type="checkbox" id="dontRemind" checked={dontRemind}
                  onChange={e => setDontRemind(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-accent-600 focus:ring-accent-500" />
                <label htmlFor="dontRemind" className="text-xs text-slate-400 dark:text-slate-500 cursor-pointer select-none">
                  不再提醒
                </label>
              </div>
              {permState === 'granted' ? (
                <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 text-sm mb-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  通知权限已开启
                </div>
              ) : (
                <button onClick={handleEnable}
                  className="px-8 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-accent-600/20">
                  开启通知
                </button>
              )}
              <div className="mt-3">
                <button onClick={handleDismiss}
                  className="text-xs text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors">
                  以后再说
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
