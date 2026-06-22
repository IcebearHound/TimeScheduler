# 通知权限请求弹窗 — 设计文档

**日期:** 2026-06-21
**状态:** 已批准

## 概述

在首次启动体验中，WelcomeGuide 关闭后弹出一个精致的通知权限请求对话框，引导用户开启桌面通知。

## 背景

当前通知系统依赖 Browser Notification API，但浏览器原生权限提示可能被静默拒绝或用户忽略。需要一个自定义引导弹窗，在用户了解功能价值后再请求权限。

## 触发逻辑

```
WelcomeGuide 关闭
  → 检查 Notification.permission
    → 'granted' → 不弹
    → 'denied' → 不弹（不重复骚扰）
    → 'default' → 检查 localStorage('notificationPromptSeen')
      → 无标记 → 弹出 NotificationPermissionPrompt
      → 有标记 → 不弹
```

## UI 设计

居中模态弹窗，风格与 WelcomeGuide 一致：

```
┌──────────────────────────────────────┐
│  [X]                                 │
│                                      │
│     🔔 Bell 图标（带 CSS 动画）        │
│                                      │
│     开启通知，不再错过重要事项          │
│                                      │
│   时间规划器会在事件开始前              │
│   按你设置的提醒时间发送桌面通知。       │
│   通知仅在本设备显示，不上传任何数据。    │
│                                      │
│   ┌──────────────────────────────┐   │
│   │       开启通知              │   │  accent 按钮
│   └──────────────────────────────┘   │
│          以后再说                     │  灰色文字链接
└──────────────────────────────────────┘
```

- **"开启通知"** → `Notification.requestPermission()` → granted 则 2 秒后关闭
- **X / "以后再说"** → 关闭，写入 `notificationPromptSeen: true` 到 localStorage

### denied 状态变体

若权限已为 `denied` 但仍触发（如从调试面板手动打开），显示替代文案：

```
通知权限已被浏览器阻止

请在浏览器地址栏左侧点击锁/信息图标，
找到"通知"选项，改为"允许"。

[关闭]
```

## 状态管理

`uiStore` 新增：
- `isNotificationPromptOpen: boolean` — 弹窗开/关
- `setIsNotificationPromptOpen: (open: boolean) => void`

## 文件改动

| 文件 | 改动 |
|------|------|
| `src/components/NotificationPermissionPrompt.tsx` | **新建** — 弹窗组件 |
| `src/App.tsx` | 新增 effect：监听 WelcomeGuide 关闭 → 条件触发弹窗；渲染 `<NotificationPermissionPrompt>` |
| `src/stores/uiStore.ts` | 新增 `isNotificationPromptOpen` 状态及 setter |

## 与 WelcomeGuide 的关系

时间线：`App 挂载 → 检测 hasSeenWelcomeGuide → 打开 WelcomeGuide → 用户关闭 WelcomeGuide → 弹出 NotificationPermissionPrompt（条件：权限为 default 且未处理过）`

两个弹窗不会同时显示（WelcomeGuide 关闭后才触发通知弹窗）。
