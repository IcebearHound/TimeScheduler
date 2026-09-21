# iOS 主屏幕应用通知调研

调研日期：2026-09-21。依据 Codex Reset 当前公开页面与客户端脚本，以及 WebKit / MDN 文档。未访问其私有服务端代码，未创建推送订阅，也未进行真机投递测试。

## 结论

Codex Reset 的 iOS 后台提醒使用标准 Web Push：主屏幕 Web App + Service Worker + Push API + 服务端发送。页面自己的倒计时提醒是另一条代码路径，依赖页面运行。添加到主屏幕使网站具备请求 iOS Web Push 权限的条件，不会让网页定时器变成系统本地闹钟。

## 可核查的实现证据

| 来源 | 观察到的实现 |
|---|---|
| [manifest.webmanifest](https://codex-reset.com/manifest.webmanifest) | `display: "standalone"`、`start_url: "/"`、192/512 PNG 图标 |
| [push.js](https://codex-reset.com/assets/1dd2ca0229/push.js) | 读取 `/api/push/key`；检测 iOS、standalone、Service Worker、PushManager 和通知权限；注册 `/sw.js?v=2`，根作用域 `/` |
| 同上 | 用户点击后请求通知权限；调用 `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`；把 endpoint、locale 和兼容标记发送到 `/api/push/subscribe`；关闭时调用 unsubscribe 接口和浏览器的 `subscription.unsubscribe()` |
| [sw.js](https://codex-reset.com/sw.js?v=2) | `push` 事件中使用 `event.waitUntil()`；读取 `/api/push/notification` 后调用 `self.registration.showNotification()`；失败时显示兜底通知；点击通知聚焦已有窗口或打开页面 |
| 同上 | 明确不做离线缓存；推送处理不读取 `event.data`。网站隐私说明称其推送不带正文，唤醒后读取最新状态，因此多个事件可能合并 |
| [notify.js](https://codex-reset.com/assets/1dd2ca0229/notify.js) | 个人倒计时使用 `setTimeout()` + `new Notification()`，不具备关闭页面后由系统定时唤醒的能力 |
| [中文页面隐私说明](https://codex-reset.com/zh/) | 将“页面打开时触发的浏览器通知”与“推送通知”分别说明；网站自述运行在 Cloudflare Workers 上 |

公开客户端证明了订阅与接收路径；无法仅据这些文件确定其服务端数据库、任务队列及重试算法。

## iOS 支持条件与边界

- [WebKit 官方说明](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)：iOS/iPadOS 16.4 起，添加到主屏幕的 Web App 支持 Web Push。manifest 使用 standalone 或 fullscreen；通知权限须由用户直接交互触发。
- Web Push 使用 Apple 的推送服务，网站不必加入 Apple Developer Program。站点仍须有 HTTPS、推送发送端及订阅管理。
- [MDN Notification 构造函数说明](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification)：多数移动浏览器调用 `new Notification()` 会抛 TypeError，应使用 Service Worker registration 的 `showNotification()`。
- `showNotification()` 负责展示通知，不负责约定未来某时刻唤醒网站。Service Worker 也不应被视为持续运行的定时进程。
- iOS PWA 没有可普遍依赖的、与原生本地通知等价的离线定时通知 API。Web Push 可在网页未运行时投递，但受网络、设备通知设置及系统调度影响，不保证闹钟级精确定时。

## TimeScheduler 的落地方案

当前 `src/App.tsx` 每 30 秒检查提醒并调用 `new Notification()`，`src/utils/notificationManager.ts` 同样依赖页面内定时器。`index.html` 尚未链接 manifest，也未找到推送 Service Worker 注册。现有 Worker 只有请求处理入口，尚无定时推送任务。

建议按以下路径实现后台提醒：

1. **安装与授权**：添加 manifest、PNG 图标、Service Worker 和 iOS 添加到主屏幕引导；在用户点击“开启通知”时请求权限。GitHub Pages 项目部署路径是 `/TimeScheduler/`，manifest、SW 作用域及通知点击地址均须使用项目 base 路径，不能照抄示例站的根目录。
2. **设备订阅**：使用 VAPID 公钥订阅 Web Push，私钥留在服务端；保存每台设备的订阅及撤销凭据。采用带内容推送时，需要保存标准 PushSubscription 的 endpoint、p256dh 和 auth。
3. **提醒调度**：在现有 Cloudflare Worker 基础上增加订阅存储与提醒队列，可采用 Durable Object alarm 或定时触发器配合数据库。按绝对时间发送作业截止、实验课/验收/报告、考试提醒。
4. **最少数据**：默认只上传提醒所需的任务 ID、时间和必要展示字段，或发送通用文案；无需上传整个课表。个人提醒应按设备/用户鉴权，不能照抄示例站公开的“最新全站通知”接口。
5. **与编辑联动**：改时间、完成、删除、节假日跳过或撤销时同步更新提醒队列。使用任务 ID、提醒档位与版本去重；清理失效 endpoint。离线编辑后需在联网时同步，服务端才能取消或更新旧提醒。
6. **通知打开**：SW 接收推送并展示通知；点击后打开对应任务详情。前台提示与后台推送使用相同提醒标识，避免重复。

若要求完全离线的系统定时提醒，应另外提供系统日历导出/接入，或使用原生应用的本地通知能力。PWA 安装与前台通知可以先完成，但不能因此宣称已经支持锁屏后的定时推送。
