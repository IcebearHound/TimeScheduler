# 通知权限请求弹窗 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WelcomeGuide 关闭后弹出精致的通知权限请求对话框，引导用户开启桌面通知权限。

**Architecture:** 新建 `NotificationPermissionPrompt` 组件，通过 `uiStore.isNotificationPromptOpen` 控制显隐。App.tsx 中监听 `isWelcomeGuideOpen` 变化，导览关闭时检测权限状态后触发弹窗。

**Tech Stack:** React 18 + TypeScript + Zustand + Tailwind CSS

## Global Constraints

- 不使用外部通知库，仅用 Browser Notification API
- 弹窗风格与 WelcomeGuide 一致（相同 backdrop、animation、border、shadow 类名）
- localStorage 键名: `notificationPromptSeen`
- 弹窗不重复显示（`notificationPromptSeen` 标记持久化）

---

### Task 1: 在 uiStore 中添加 isNotificationPromptOpen 状态

**Files:**
- Modify: `src/stores/uiStore.ts`

**Interfaces:**
- Produces: `useUIStore((s) => s.isNotificationPromptOpen): boolean`, `useUIStore((s) => s.setIsNotificationPromptOpen): (open: boolean) => void`

- [ ] **Step 1: 在 UiState 接口中添加声明**

在 `isWelcomeGuideOpen` / `setIsWelcomeGuideOpen` 之后插入：

```typescript
  isNotificationPromptOpen: boolean
  setIsNotificationPromptOpen: (open: boolean) => void
```

- [ ] **Step 2: 在 create 的初始对象中添加默认值和 setter**

在 `isWelcomeGuideOpen: false,` 和 `setIsWelcomeGuideOpen: ...` 之后插入：

```typescript
    isNotificationPromptOpen: false,
    setIsNotificationPromptOpen: (open) => set({ isNotificationPromptOpen: open }),
```

- [ ] **Step 3: 类型检查**

```powershell
npx tsc --noEmit
```

Expected: 无输出（通过）

- [ ] **Step 4: 提交**

```powershell
git add src/stores/uiStore.ts
git commit -m "feat: add isNotificationPromptOpen to uiStore"
```

---

### Task 2: 创建 NotificationPermissionPrompt 组件

**Files:**
- Create: `src/components/NotificationPermissionPrompt.tsx`

**Interfaces:**
- Consumes: `useUIStore((s) => s.isNotificationPromptOpen)` — 从 uiStore 读取
- Produces: `export default function NotificationPermissionPrompt({ onClose }: { onClose: () => void })` — onClose 由 App.tsx 传入

- [ ] **Step 1: 创建组件文件**

`src/components/NotificationPermissionPrompt.tsx`:

```tsx
import React, { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function NotificationPermissionPrompt({ onClose }: Props) {
  const [visible, setVisible] = useState(true)
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
    try { localStorage.setItem('notificationPromptSeen', 'true') } catch {}
    setTimeout(() => onClose(), 200)
  }

  const handleEnable = async () => {
    if (!('Notification' in window)) return
    try {
      const p = await Notification.requestPermission()
      setPermState(p)
      if (p === 'granted') {
        setTimeout(() => handleDismiss(), 1500)
      }
    } catch {
      setPermState('denied')
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
        {/* Header */}
        <div className="flex items-center justify-end px-5 pt-4">
          <button onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 text-center">
          {isDenied ? (
            <>
              <div className="text-5xl mb-4">🔕</div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                通知权限已被浏览器阻止
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                请在浏览器地址栏左侧点击锁/信息图标，<br />
                找到"通知"选项，改为"允许"后刷新页面。
              </p>
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
```

- [ ] **Step 2: 类型检查**

```powershell
npx tsc --noEmit
```

Expected: 无输出（通过）

- [ ] **Step 3: 提交**

```powershell
git add src/components/NotificationPermissionPrompt.tsx
git commit -m "feat: add NotificationPermissionPrompt component"
```

---

### Task 3: 在 App.tsx 中接入触发逻辑和渲染

**Files:**
- Modify: `src/App.tsx:1-20` (imports), `src/App.tsx:85-96` (first-launch effect), `src/App.tsx:108-110` (ESC handler), `src/App.tsx:237-242` (render tree)

**Interfaces:**
- Consumes: `isWelcomeGuideOpen`, `setIsWelcomeGuideOpen`, `isNotificationPromptOpen`, `setIsNotificationPromptOpen` from `useUIStore`
- Uses: `NotificationPermissionPrompt` component

- [ ] **Step 1: 添加 import**

在 `src/App.tsx` 的 import 区域，`import WelcomeGuide` 之后添加：

```typescript
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt'
```

- [ ] **Step 2: 提取 uiStore 状态**

在 App 函数内，`isWelcomeGuideOpen` 和 `setIsWelcomeGuideOpen` 之后添加：

```typescript
  const isNotificationPromptOpen = useUIStore((s) => s.isNotificationPromptOpen)
  const setIsNotificationPromptOpen = useUIStore((s) => s.setIsNotificationPromptOpen)
```

- [ ] **Step 3: 添加触发 effect**

在首次启动自动弹出导览的 useEffect（第 88-96 行）**之后**新增：

```typescript
  // 导览关闭后弹出通知权限请求
  useEffect(() => {
    if (!initialized) return
    if (isWelcomeGuideOpen) return
    try {
      if (localStorage.getItem('notificationPromptSeen')) return
    } catch {}
    if (!('Notification' in window)) return
    if (Notification.permission !== 'default') return
    setIsNotificationPromptOpen(true)
  }, [initialized, isWelcomeGuideOpen])
```

- [ ] **Step 4: 在 ESC handler 中添加关闭逻辑**

在 ESC 关闭 handler（第 100-117 行 useEffect）中，现有弹窗检查列表末尾添加：

```typescript
      if (s.isNotificationPromptOpen) { s.setIsNotificationPromptOpen(false); return }
```

在 `if (s.isWelcomeGuideOpen)` 之后或之前任一位置（保持与现有风格一致）。

- [ ] **Step 5: 在 render tree 中添加组件渲染**

在 render tree 末尾（`{isWelcomeGuideOpen && ...}` 之后）添加：

```tsx
      {isNotificationPromptOpen && <NotificationPermissionPrompt onClose={() => setIsNotificationPromptOpen(false)} />}
```

- [ ] **Step 6: 类型检查和构建**

```powershell
npx tsc --noEmit
```

Expected: 无输出（通过）

- [ ] **Step 7: 提交**

```powershell
git add src/App.tsx
git commit -m "feat: wire NotificationPermissionPrompt into App lifecycle"
```
