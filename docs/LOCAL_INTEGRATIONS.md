# 课程任务、AI、MCP 与私有仓库同步

## 启动

需要 Node.js 22 或更高版本。

```sh
npm install
npm run build
npm run local
```

打开 `http://127.0.0.1:4318/TimeScheduler/`。登录与仓库同步位于右上角 **用户 → GitHub 登录与同步 / Gitee 登录与同步**，手机上也使用右上角用户图标。AI API 与 MCP 使用顶部 **AI / MCP** 入口。

任一面板均可输入终端显示的 8 位配对码，连接当前存档。首次设置至少 12 个字符的本地加密口令；以后每次启动用该口令解锁。账号面板与 AI 面板共享本机连接和解锁状态，切换面板无需重复配对。

开发时可分别运行 `npm run dev` 与 `npm run local`。本机服务默认允许 `http://localhost:5173` 与 `http://127.0.0.1:5173`。在 GitHub Pages 等其他来源的网页上使用时，需启动前设置 `TIMESCHEDULER_ALLOWED_ORIGIN` 为该网页的来源，例如 `https://icebearhound.github.io`。浏览器可能要求允许访问本地网络。

**存档属于当前浏览器来源。** 从原来的网站改为本机网页时，先通过原有的导出/导入功能迁移事件组，或在原网站允许的来源下连接本机服务。不同来源、浏览器、设备的 localStorage 不会自动合并。网页必须保持打开；浏览器休眠后 MCP 会提示重连。

重新加载网页后可使用同一终端配对码再次连接；重新配对会断开旧网页并锁定凭据库。服务重启会生成新配对码。

## 日历边缘摘要

日视图和灵活周视图的每一天都会在可视区域顶部、底部显示未完整出现在视口内的事件摘要，包括名称、起止日期和时间。摘要列表独立滚动，点击跳转到事件。跨日事件显示完整的起止日期；事件类型和事件组筛选同样作用于摘要。

## 课程作业 / 实验

顶部 **课程作业 / 实验** 打开课程任务工作台。每一行对应一条课程事件链，按截止时间排序灯珠：蓝色表示待完成，红色表示逾期，绿色表示完成，并同时显示文字状态。

- 新课程自动创建事件链；已有课程按名称复用。存在同名链时要求先重命名，避免归入错误课程。
- 点击灯珠修改名称、截止时间、提交方式、提交链接、内容、备注及完成状态。
- 任务作为普通事件存入现有事件链。`endTime` 表示验收截止时间，默认从截止前 30 分钟开始，并置顶 Todo。
- 任务详情放在 `properties` 内：`taskKind`、`submissionUrl`、`submissionMethod`、`taskContent`、`notes`、`completed`（字符串 `true` / `false`）。原有导出、备份和同步均会保留。

### 表格批量导入

支持 XLSX、XLS、CSV，以及从电子表格复制的制表符文本。最多 100 行、10 MB。所有工作表都应使用相同的表头规范；含无关工作表时请先删除无关表。

| 课程 | 名称 | 截止日期 | 类别 | 提交链接 | 提交方式 | 内容 | 备注 |
|---|---|---|---|---|---|---|---|
| 高等数学 | 第三次作业 | 2026-09-18T23:59 | 作业 | https://example.com/submit | 在线提交 | 积分练习 | PDF |

课程和名称必填；新任务的截止日期必填。纯日期按本地时间 23:59；Excel 日期数值和超链接单元格会被解析。提交链接仅接受 HTTP(S)。

**只批量获取链接：** 表格只需 `课程、名称、提交链接` 三列。程序按课程链和任务名称找到已有任务，更新链接并保留其截止时间和其他详情。重复导入不会重复创建任务；同一表格重复任务会报错。空白可选字段在批量更新时保留旧值，清空字段请用详情编辑。

导入先展示预览，再一次性应用。任意行出错不会部分导入。关闭工作台后可按 `Ctrl+Z` 整批撤销。

## AI API

支持以下协议，可自定义基础地址和模型：

| 协议 | 基础地址示例 | 追加的请求路径 |
|---|---|---|
| OpenAI 兼容 | `https://api.openai.com/v1` | `/chat/completions` |
| Anthropic | `https://api.anthropic.com/v1` | `/messages` |
| Gemini | `https://generativelanguage.googleapis.com/v1beta` | `/models/{model}:generateContent` |

DeepSeek、通义等服务使用其文档中的 OpenAI 兼容基础地址及模型名。本地模型可用 `http://127.0.0.1:.../v1`，无鉴权的本地兼容服务可填任意占位密钥。远程接口要求 HTTPS。当前保存一组活动 API 配置，切换后覆盖原配置。

点击 **生成操作预览** 才会发送当前完整存档和指令至所选 AI 服务。返回的 JSON 先经过参数、时间区间和引用完整性校验，再展示每一项变更。点击确认后写入存档，可整体撤销。如果生成预览后存档发生了修改，则拒绝应用旧预览，要求重新生成。

## 外部 AI 的 MCP

MCP 使用标准 **stdio** 传输，采用官方 `@modelcontextprotocol/sdk`。MCP 进程已经包含本机服务，不要同时启动 `npm run local`。建议客户端配置直接调用 Node，避免 npm 的启动横幅干扰 stdio。

例如本项目位于 `D:\CodeProjects\TimeScheduler` 时：

```json
{
  "mcpServers": {
    "time-scheduler": {
      "command": "node",
      "args": [
        "--import", "tsx",
        "D:/CodeProjects/TimeScheduler/server/index.ts",
        "--mcp"
      ],
      "cwd": "D:/CodeProjects/TimeScheduler"
    }
  }
}
```

客户端如不支持 `cwd`，用 Node 执行 `D:/CodeProjects/TimeScheduler/node_modules/tsx/dist/cli.mjs`，后接服务器绝对路径与 `--mcp`。服务器以项目自身位置解析静态资源。终端手动运行可使用 `npm run mcp`。配对码输出至 **stderr**，在 MCP 客户端的服务器日志中查看。密钥不需要写入 MCP 配置。

| 工具 | 输入 | 效果 |
|---|---|---|
| `get_archive` | `{}` | 读取已连接网页的事件、事件链、类型、组、学期起始时间及 SHA-256 版本 |
| `apply_actions` | `{revision, actions}` | 校验版本，向网页发出操作，收到网页持久化确认后才返回成功 |

操作类型：

- `create_chain`: `{op, id, chain:{name,typeId,color,defaultReminders:[]}}`
- `create_event`: `{op,event:{name,startTime,endTime,chainId,typeId,reminders:[],properties:{},isHighlight:false,priority:0}}`
- `update_event`: `{op,id,changes:{...允许修改的事件字段}}`
- `delete_event`: `{op,id}`

新链可由后续事件引用；新增事件自动加入活动事件组。一次最多 200 项操作；整批验证完成后才执行。工具不暴露凭据库、API 密钥或仓库令牌。配对代表允许外部 MCP 客户端读写当前存档；外部工具调用不再弹出网页内的二次确认。只有用户明确请求的操作才应调用写入工具。

两个网页同时连接时只有一个活动存档拥有写入通道。网页离线或休眠时拒绝读写；未及时确认的操作返回不确定结果，客户端必须重新读取存档核验，不能直接重放创建操作。

## GitHub / Gitee 授权、建库与同步

### GitHub 首次配置

1. 在 GitHub 的 **Settings → Developer settings → OAuth Apps** 创建应用。
2. 启用 **Device Flow**。打开右上角 **用户 → GitHub 登录与同步**，一次性填入 Client ID 并加密保存。
3. 点击 **授权登录 → 自动建库并同步**，打开授权页面，输入设备验证码并授权。
4. 程序自动创建默认的 `time-scheduler-private` 私有仓库，上传 `time-scheduler-archive.json` 并回读核验。

使用 `repo` 权限以支持个人私有仓库创建和读写。GitHub 设备流程不需要在程序中保存 Client Secret。

### Gitee 首次配置

1. 在 Gitee 创建第三方 OAuth 应用，权限选择 `user_info`、`projects`。
2. 回调地址必须与界面显示值一致，默认 `http://127.0.0.1:4318/oauth/gitee/callback`。
3. 打开右上角 **用户 → Gitee 登录与同步**，填入 Client ID 和 Client Secret，加密保存后点击授权登录。
4. 平台回调后，工作台自动创建私有仓库并同步核验。过期令牌通过本地加密保存的 refresh token 刷新。

平台是否允许注册应用、启用设备流或创建私有仓库，以用户账号和平台当前限制为准。本项目不包含平台签发的公共 OAuth 应用 ID / Secret。运营者提供有效应用配置后，终端用户可直接授权；自行部署者需完成上述一次性设置。

### 同步与冲突

- 授权后首次自动同步；之后点击 **同步并核验**。当前不在每次编辑后自动上传。
- 每次上传前重新检查远端仓库的 `private` 属性，公有仓库会被拒绝。
- 文件包含完整日程存档和 SHA-256 摘要，不包含凭据。上传成功后重新 GET 内容、校验摘要和存档结构。
- 使用平台文件 SHA 作为更新前提。本机未读取过的远端存档，或另一设备已更新的远端版本，会阻止覆盖。
- **下载远端预览** 后核对事件，点击恢复会替换本地完整存档，可撤销。恢复时还会检查本地与远端是否在预览期间发生变化。
- 当前采用整体存档替换，不自动逐字段合并。恢复之前请备份需要保留的本地独立变更。
- 同步失败会保留本地存档。若上传已经完成但回读失败，下次同步会先读取核验一致性。

## 本地凭据边界

默认凭据文件：`~/.time-scheduler/credentials.enc`。可用 `TIMESCHEDULER_DATA_DIR` 指定目录。

- scrypt 从口令和随机盐派生密钥；AES-256-GCM 提供加密与完整性认证，每次写入生成新 IV。
- OAuth 应用配置、登录 token、refresh token、AI API key 仅以密文落盘。加密口令、解密密钥、网页会话令牌和配对码不落盘。
- 浏览器的 localStorage 和同步存档仅保存日程数据。口令丢失后无法解密凭据，可重新创建凭据库并重新授权；日程存档不受影响。
- 本机服务仅绑定 `127.0.0.1`，检查 Host、来源、JSON 内容类型和内存会话令牌；OAuth 使用一次性 state 校验。出站凭据放在 HTTPS 请求头或令牌交换请求体中，不写 URL 查询串或日志。
- 点击锁定清除本机服务内存中的凭据库密钥；点击断开还会关闭 MCP 对当前网页的读写通道。
- 私有仓库中的日程是普通 JSON，隐私依赖平台仓库访问控制。SHA-256 用于内容核验，不替代平台鉴权。

## 验证

```sh
npm run type-check
npm run check:server
npm test
npm run test:workspace
```

`test:workspace` 使用 Playwright Chromium，需要已经安装浏览器（`npx playwright install chromium`），并要求 4318 端口空闲。它启动临时本机服务和真正的 MCP stdio 客户端，在隔离浏览器与临时凭据目录中验证课程表单、批量导入、边缘摘要、配对、MCP 写入、版本冲突和刷新后的持久化；截图输出至忽略提交的 `test-results/`。

平台 API 和三种 AI 协议在单元测试中使用模拟响应，未使用真实账号、密钥、付费请求或创建实际远端仓库。部署前需用自己的 OAuth 应用完成平台端到端验收。
