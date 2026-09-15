# 手机一键登录与自动同步

## 普通用户怎么使用

打开网站 → 右上角“用户” → GitHub / Gitee 登录与同步 → 使用账号登录 → 在平台确认授权。

返回网页后自动完成：

1. 加密保存当前设备的登录令牌。
2. 查找账号下的 `time-scheduler-private` 私有仓库；不存在时自动创建。
3. 新设备自动找回云端存档；已有本地内容时尝试合并。
4. 编辑后约 1.5 秒自动同步，上传后回读核验。窗口恢复、重新联网和每 30 秒检查远端变化。
5. 离线时继续保存到浏览器，联网后自动补传。

用户不需要安装软件、运行命令、填写 Client ID/Secret、输入设备码或额外设置加密口令。刷新网页会自动恢复登录；使用另一台设备时只需再次登录同一个平台账号。

当前一次连接一个平台账号。退出登录保留此设备的日程；清除网站数据会清除该设备的登录状态和本地存档，之后可重新登录找回已同步的数据。

若页面显示“网站暂未开通账号同步”，说明部署者尚未完成下面的配置。网站不会把部署步骤交给手机用户。

## 部署者的一次性配置

本项目的 GitHub Pages 只托管静态网页。OAuth 客户端密钥不能放进公开前端，因此另提供一个无数据库的 Cloudflare Worker：`worker/index.ts`。

### 1. 创建授权服务

可以在本仓库的 GitHub Actions 中运行 **Deploy account authorization service** 工作流。先在仓库 Settings → Secrets and variables → Actions 中设置这些 **Secrets**：

| GitHub Secret | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 有 Workers 部署权限的 Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID |
| `AUTH_STATE_SECRET` | 至少 32 字符的高熵随机值，用来封装短期授权 state 和回调票据 |
| `GH_OAUTH_CLIENT_ID` | GitHub OAuth App Client ID |
| `GH_OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `GITEE_CLIENT_ID` | Gitee OAuth App Client ID |
| `GITEE_CLIENT_SECRET` | Gitee OAuth App Client Secret |

GitHub 自定义 Secret 不能用 `GITHUB_` 前缀，因此工作流使用 `GH_OAUTH_*`，部署到 Worker 时映射为 `GITHUB_CLIENT_*`。

`worker/wrangler.jsonc` 的 `APP_URL` 默认是 `https://icebearhound.github.io/TimeScheduler/`。自行部署到其他网站时改成实际的网页入口，必须精确匹配路径和末尾斜杠。服务只允许这个来源发起 API 请求及返回这个入口，防止开放重定向和跨站读取。

也可以由部署者在电脑上使用 Wrangler 手动部署：

```sh
npx wrangler@4 login
npm run deploy:auth
npx wrangler@4 secret put AUTH_STATE_SECRET --config worker/wrangler.jsonc
npx wrangler@4 secret put GITHUB_CLIENT_ID --config worker/wrangler.jsonc
npx wrangler@4 secret put GITHUB_CLIENT_SECRET --config worker/wrangler.jsonc
npx wrangler@4 secret put GITEE_CLIENT_ID --config worker/wrangler.jsonc
npx wrangler@4 secret put GITEE_CLIENT_SECRET --config worker/wrangler.jsonc
```

这些命令仅供网站部署者使用。手动部署允许只开通其中一个平台，未配置的平台按钮会禁用。部署后得到实际的 HTTPS Worker 地址；可以先部署空配置服务取得地址，再创建下面的 OAuth 应用并补齐 Secrets。

### 2. 注册平台 OAuth 应用

假设授权服务地址为 `https://你的实际授权服务域名`：

| 平台 | 回调地址 | 权限 |
|---|---|---|
| GitHub OAuth App | `https://你的实际授权服务域名/oauth/callback/github` | `repo`，用于个人私有仓库创建和读写 |
| Gitee 第三方应用 | `https://你的实际授权服务域名/oauth/callback/gitee` | `user_info projects` |

GitHub 使用标准网页授权码流程，无需开启 Device Flow。将平台签发的应用配置填入 Worker Secrets（或上面的 GitHub Actions Secrets 后重新部署），不要写进代码、前端构建变量或普通配置文件。

### 3. 连接前端

在 GitHub 仓库 **Actions Variables** 中设置公开变量：

`VITE_AUTH_SERVICE_URL = 实际的 HTTPS Worker 地址`，不带末尾斜杠。

随后重新运行 **Deploy to GitHub Pages**。网页只接收授权服务地址，不接收应用密钥。其他托管方式在构建时提供同名环境变量即可。

### 4. 实际验收

用手机正常登录一次，确认私有仓库自动创建；添加事件后用第二台设备登录同一账号，确认恢复；在飞行模式下修改后恢复网络，确认自动补传。检查仓库仍为私有，网页显示“所有更改已同步”。

仓库尚未包含真实的 OAuth 应用配置或 Cloudflare 部署凭据。自动测试使用模拟平台响应验证真实 Worker 和浏览器代码，不能替代平台对 OAuth 应用的审批、回调地址配置及真实账号验收。

## 架构与凭据边界

```text
手机/电脑浏览器 ──登录跳转──> GitHub / Gitee
       │                         │
       │<── 加密的短期回调票据 ── Worker
       │── 设备校验信息换取令牌 ─>│── 平台授权码交换
       │                         │
       ├─ IndexedDB：AES-GCM 加密登录令牌
       ├─ IndexedDB：不可导出的本机 CryptoKey
       ├─ localStorage：日程存档
       │
       └── 限定的仓库 API 中继 ── Worker ── 个人私有仓库
```

- **用户访问令牌和刷新令牌仅在浏览器本地加密持久化。** Worker 只在请求内存中交换/转发，不创建用户数据库、服务端会话或 Token 文件。Worker 环境里存放的是部署者的 OAuth 应用配置和授权封装密钥。
- 浏览器 Web Crypto 生成不可导出的 AES-256-GCM 密钥，IndexedDB 保存密钥对象与随机 IV 的密文。自动解密不需要第二个口令。凭据不进入日程存档、普通 localStorage、URL 查询串或同步仓库。
- 这保护的是静态凭据存储和普通数据导出，不抵御已控制同源网页的恶意脚本或已解锁设备。必须保持 HTTPS、代码依赖和网页来源可信。不能将“不可导出密钥”理解为硬件保险库。
- 回调票据是加密的短期授权码封装，不是访问令牌。只有持有本机随机 verifier 的浏览器可以换取令牌；state、有效期、平台、网站地址和 nonce 都会校验。平台授权码单次使用，交换失败后重新登录。
- 平台原生授权回调中仍包含短期授权码。应用不记录请求 URL/请求体/令牌，Worker 默认关闭 observability。部署者不应额外启用含这些信息的请求日志。
- 中继固定访问 GitHub/Gitee 官方 API，仅允许读取用户、创建固定名称的私有仓库，以及读写其中的 `time-scheduler-archive.json`。不接受任意目标 URL，也不提供通用代理。
- 同步的日程 JSON 对仓库所有者和其授权协作者可读；文件内容做 SHA-256 回读核验。每次同步检查仓库私有属性，更新带文件 SHA，避免无条件覆盖。

## 自动合并与冲突

每台设备保存上次同步的基准存档。不同事件或同一事件不同字段的修改会自动合并；删除不会被简单并集重新恢复。只有同一字段的不同修改、修改与删除等真正冲突才暂停同步。

冲突界面提供“保留此设备版本”和“采用云端版本”。选择前在本机加密保存双方恢复副本，采用云端内容也可以用原有撤销功能恢复。确认后仍会重新读取最新远端版本，再同步，防止覆盖随后发生的修改。

同一浏览器多标签通过 Web Locks 串行同步；每个标签保留自己的合并基准，防止休眠标签把其他标签新增的数据误判为删除。浏览器后台可能暂停定时器，因此不是关闭网页后仍能运行的系统后台服务；重新打开或回到前台会补同步。

## 测试

```sh
npm run type-check
npm run check:worker
npm test
npm run test:cloud
npm run test:workspace
```

云同步端到端测试启动临时 HTTP 服务模拟托管环境，执行实际 Worker 代码和真实浏览器 OAuth 跳转，用平台模拟响应验证手机登录、私有仓库创建、回读、跨设备恢复、离线补传、冲突选择、刷新免登录、令牌自动续期、多标签退出及本机密文存储。不依赖 4318 本机服务，也不会创建真实远端仓库。

部署前可用 `npx wrangler@4 deploy --dry-run --outdir test-results/worker --config worker/wrangler.jsonc` 校验 Worker 的实际打包结果；此命令不会发布服务。
