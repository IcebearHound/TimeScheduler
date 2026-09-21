# 课程任务、AI、MCP 与私有仓库同步

## 网页与账号同步

日历、课程任务与表格导入直接在网页使用。手机用户在右上角 **用户 → GitHub 登录与同步 / Gitee 登录与同步** 授权即可；网站会自动建私有仓库、同步并回读核验。用户无需安装 Node.js、运行命令、配置 OAuth 应用或配对。

网站部署者需一次性开通轻量授权服务，详见 [手机一键登录与自动同步](WEB_ACCOUNT_SYNC.md)。未部署时界面会显示“网站暂未开通账号同步”。

## 手机与电脑上的网页 AI

点击顶部或手机底部的 **Agent**，打开独立悬浮对话窗。电脑可拖动标题栏、放大和最小化，手机适配可视区域与软键盘；关闭窗口会保留草稿，进行中的请求仍会完成并记入历史。窗口支持 Escape 和浏览器返回关闭，嵌套的导入窗口优先关闭。

模型与 API 选择均在输入框下方。点击 **API 配置** 可直接添加、编辑、删除多个服务商配置，配置区内提供高级连接选项、网页读取密钥和外部 MCP 连接；通用设置不再提供 AI 配置。保存后点击“完成配置”即可继续聊天。密钥独立加密保存在此浏览器，不写入对话历史、日程备份或云同步。

顶部 **＋** 新建对话，历史按钮打开记录列表；支持按标题或消息内容搜索、重命名、删除、重新打开并继续对话。消息、生成文件、未发送草稿和每段对话的 API／模型选择会保存在当前浏览器，刷新后恢复；切换对话不会携带其他对话的消息上下文。上传附件原文件和读取到的网页正文不持久化，恢复后需重新提供；未确认的操作预览在切换或刷新后需重新生成。存储失败会在窗口内提示，不会静默丢弃当前页面消息。历史记录独立于日程备份与云同步。

描述安排后点击 **发送**，AI 查询、追问或给出操作预览；点击 **确认应用到存档** 才会修改日程。内置 DeepSeek、OpenAI、Gemini、Claude、通义千问和 Kimi 的地址与默认模型，用户无需安装程序或配对。

默认配置会使用部署者提供的 AI 转发服务；未配置时直接从浏览器访问服务商。可在 API 配置的高级连接设置中查看和切换连接方式。若服务商不允许浏览器跨域访问，需要网站部署者开通下述转发，手机用户无需配置服务器。API Key 必须有效且有模型权限与可用额度。

### 部署者：可选的 AI 转发

已有 `worker/index.ts` 新增 `/ai/propose`，无需数据库或 OAuth 应用即可单独提供 AI 转发。设置 `APP_URL` 为网站入口并部署 Worker，再设置 GitHub 仓库变量 `VITE_AI_SERVICE_URL` 为其 HTTPS 地址并重新构建网页。也可复用 `VITE_AUTH_SERVICE_URL` 指向的已升级 Worker。部署可由 Cloudflare 控制台连接仓库，或由部署者执行现有 Worker 部署命令；这些步骤不交给使用网站的手机用户。

转发仅允许配置的网站来源和内置服务商的固定上游地址。API Key 随请求在 Authorization 头中传入，转发服务仅在本次调用内存中使用，不写入数据库、日志或缓存；响应为 `Cache-Control: no-store`。保持 Worker 请求正文日志关闭。自定义 API 使用浏览器直连，不能把网站转发当作任意 URL 代理。

### 高级：电脑外部 MCP 客户端

仅外部 MCP 客户端仍需 Node.js 22+ 本机服务。普通网页 AI 不依赖它。

```sh
npm install
npm run build
npm run mcp
```

在 Agent 输入框下方打开 **API 配置 → 外部 MCP 连接**，输入终端的配对码。网页保持打开即可读写此浏览器存档；不需要解锁旧版服务端 AI 凭据库。GitHub Pages 来源需由部署者将 `TIMESCHEDULER_ALLOWED_ORIGIN` 设置为该网站来源。

## 日历边缘摘要

日视图和灵活周视图的每一天都会在可视区域顶部、底部显示未完整出现在视口内的事件摘要，包括名称、起止日期和时间。摘要列表独立滚动，点击跳转到事件。跨日事件显示完整的起止日期；事件类型和事件组筛选同样作用于摘要。

## 课程作业 / 实验

桌面右边栏 **作业 / 实验** 与 **TODO** 并列；手机底部 **课程** 打开同一栏目。右上角可全屏放大、缩回，切换栏目或大小保留正在编辑的任务草稿。

日期总览从今天开始，每门课程一行、每天一列，自动适应宽度，也支持未来 7／14／30 天。灯珠使用实验（烧瓶）、作业（书本）、考试（学位帽）图标；TODO 仍区分实验课、验收、报告、作业和考试五种事项。实验课和考试按开始日期显示，截止事项按截止日期；颜色表示待处理、今日截止、逾期或完成，悬浮提示和无障碍名称包含类别、名称、时间与状态。逾期未完成任务单独列出；“全部课程任务”保留按课程查看历史与远期任务的入口。

TODO 的“课程任务 · 按时间排序”统一列出所有课程的五类事项，不受置顶、重点、手动拖拽、近期天数及其他安排的来源开关影响，历史逾期和远期事项不会遗漏。支持全部／待完成／已完成筛选。实验课与考试默认在结束后自动完成，也可手动切换；手动状态持续保留。验收、报告、作业各自勾选，互不影响。已跳过的任务不进入 TODO，也不触发浏览器通知。

- 新课程自动创建事件链；已有课程按名称复用。存在同名链时要求先重命名，避免归入错误课程。
- 双击／双点或右键灯珠打开详情，修改名称、上课时间或截止时间、提交方式、提交链接、内容、备注及完成状态。
- 添加实验课时可一并填写验收和报告截止时间，三项一次保存、一次撤销；已有实验课也可补充这两项。未填写的截止事项不会创建。详情中可跳转同一次实验的其他事项。
- “填入下次实验课时间”从同课程实际课表查找下一场实验课，跳过停课或空周，复制其当前开始时间。它是一次性填入，后续调课需手动调整截止时间；没有下一场时提示手动填写。
- 任务作为独立事件存入课程链。实验课和考试保留真实起止时间；验收、报告、作业的 `endTime` 表示各自截止时间，日历占位默认从截止前 30 分钟开始；新任务不置顶。
- `properties.taskKind` 为 `实验课`、`实验验收`、`实验报告`、`作业`、`考试`。旧值 `实验` 兼容解释为实验验收；无 `taskKind` 且事件类型 `category=lab` 的旧事件解释为实验课，无需迁移存档。无 taskKind 的 homework/exam 类型分别识别为作业/考试；旧存档自动补齐缺失的实验、作业、考试默认类型。
- `properties.labGroupId` 关联同一次实验的三个事项；`completed`（字符串 `true` / `false`）和 `completedAt`（ISO 时间或空字符串）记录各截止事项的独立完成状态。`submissionUrl`、`submissionMethod`、`taskContent`、`notes` 保留提交详情。原有导出、备份和同步均会保留这些属性。

### 灯珠交互、编号与重复规则

- 单击／点按切换完成状态和颜色；双击／双点或右键打开详情。为区分双击，单击有约 500ms 延迟。键盘 Enter/Space 切换，Shift+F10 打开详情。移动端扩大触控区域，支持横向滑动日期表格、底部详情面板和固定保存按钮。
- 行首选择作业／实验／考试会批量修改该课程行已有任务，保留时间、详情和完成状态，整批可撤销。切回实验时恢复记住的实验子类型；普通作业转为实验验收。同一事件链的不同事项始终处于同一行，日期相同时上下排列。
- “编号 / 跳过”中选定任意基准事项及数字，自动生成之前和之后的正整数编号；作业、实验、考试分别计数，同一 labGroupId 的实验课、验收和报告共享编号。无足够前置编号空间时提示增大基准。
- 跳过规则使用北京时间、中国大陆 2026 年官方放假安排（含调休假期、不含补班日）。实验整组按实验课日期判断，缺实验课时按最早截止日期；作业按截止日期。考试不因节假日自动跳过。其他年份显示提示，可手动配置额外跳过日期与照常进行日期，照常进行优先。记录保留，跳过的事项不占编号、不进入 TODO、不发送提醒；关闭规则可恢复。
- 快捷添加可每 1–12 周重复，共 1–52 次（含首项），每次实验组合使用独立关联编号，一次最多 200 个事件；规则按浏览器／本机 MCP 服务所在时区维持钟面时间。生成后可逐项编辑。作业和实验始终使用对应默认类型，不会错误地保存为课程类型。
- 考试在未来 7 天显示醒目提醒和倒计时，TODO 与灯珠使用醒目颜色；新建考试设为重点，课程没有默认提醒时增加提前 1 天、2 小时提醒。浏览器通知需授权且页面运行。
- 详情中突出显示完成状态、修改时间、所属事件链；更改事件链只移动当前事项，不移动同组其他事项。

### 表格批量导入

支持 XLSX、XLS、CSV，以及从电子表格复制的制表符文本。最多 100 行、10 MB。所有工作表都应使用相同的表头规范；含无关工作表时请先删除无关表。

| 课程 | 名称 | 截止日期 | 类别 | 提交链接 | 提交方式 | 内容 | 备注 |
|---|---|---|---|---|---|---|---|
| 高等数学 | 第三次作业 | 2026-09-18T23:59 | 作业 | https://example.com/submit | 在线提交 | 积分练习 | PDF |

课程和名称必填；新任务的截止日期必填。类别为五类事项之一（旧“实验”仍兼容）；实验课或考试额外填写“开始时间”，截止日期填写结束时间。可用“实验关联编号”将同一次实验的多行关联。纯截止日期按本地时间 23:59；Excel 日期数值和超链接单元格会被解析。提交链接仅接受 HTTP(S)。

**只批量获取链接：** 表格只需 `课程、名称、提交链接` 三列；同名事项不唯一时还必须填写“类别”。程序按课程链、名称和类别找到已有任务，更新链接并保留其时间和其他详情。重复导入不会重复创建任务；同一表格重复任务会报错。空白可选字段在批量更新时保留旧值，清空字段请用详情编辑。

导入先展示预览，再一次性应用。任意行出错不会部分导入。关闭工作台后可按 `Ctrl+Z` 整批撤销。

## AI API

支持以下协议，可自定义基础地址和模型：

| 协议 | 基础地址示例 | 追加的请求路径 |
|---|---|---|
| OpenAI 兼容 | `https://api.openai.com/v1` | `/chat/completions` |
| Anthropic | `https://api.anthropic.com/v1` | `/messages` |
| Gemini | `https://generativelanguage.googleapis.com/v1beta` | `/models/{model}:generateContent` |

内置服务商自动填写地址和模型，高级设置允许更换模型；其他服务可选择“自定义兼容 API”。本地模型可用 `http://127.0.0.1:.../v1`，无鉴权的本地兼容服务可填任意占位密钥。远程接口要求 HTTPS。支持保存多组 API 配置，在对话输入区下方切换，不覆盖其他配置。

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
| `list_course_tasks` | `{courseId?, kind?, status?, from?, to?}` | 按时间读取五类事项；返回 revision、课程 ID、任务 ID、sequence、skipped、skipReason 和 scheduleWarnings。status 为 all/pending/completed/overdue，默认 all；日期区间两端均包含 |
| `create_course_task` | `{revision, task:{courseId,name,kind,endTime,startTime?,labGroupId?,...详情}}` | 新增单个课程事项；实验课和考试必填 startTime，其他事项以 endTime 为截止 |
| `create_lab` | `{revision, lab:{courseId,name,startTime?,endTime?,existingClassId?,acceptanceDeadline?,acceptanceAtNextClass?,reportDeadline?,...详情}}` | 一次创建实验课和独立截止事项；existingClassId 可为已有实验课补充截止事项，保留课表时间 |
| `update_course_task` | `{revision,id,changes:{name?,courseId?,startTime?,endTime?,...详情}}` | 精确修改一个事项；courseId 可修改所属事件链，其他关联事项不随之移动；保留类别、关联编号、状态及未指定属性 |
| `set_course_task_status` | `{revision,id,completed}` | 单独完成或重新打开该项；支持实验课和考试的持久手动状态，不联动其他事项 |
| `set_course_row_category` | `{revision,courseId,category}` | category 为作业／实验／考试，批量修改该行已有任务，可撤销 |
| `configure_course_task_rules` | `{revision,courseId,rules}` | 替换编号与跳过规则，保留未要求修改的字段；规则结构见下 |
| `create_weekly_course_tasks` | `{revision,tasks:[首周事项],rule:{count,intervalWeeks}}` | tasks 为 1–3 项，可包含同组实验事项；按周生成不同组，每次最多 200 项 |

`rules` 包含可选的 `homeworkAnchor`、`labAnchor`、`examAnchor`（各为 `{eventId,number}`），以及 `skipHolidays`、`extraSkipDates`、`keepDates`。日期数组使用 `YYYY-MM-DD`。空规则对象清除全部规则；编号基准必须属于本课程对应类型且未被跳过。先通过 `list_course_tasks` 读取当前规则。列表 status=all 保留跳过记录，其他状态筛选排除跳过记录。

详情字段为 `submissionUrl`、`submissionMethod`、`taskContent`、`notes`，更新时空字符串可清空。所有输入时间必须带时区，例如 `2026-09-24T14:00:00+08:00`。用 `list_course_tasks` 返回的课程 ID 和任务 ID 操作，不猜测 ID。可先通过 `apply_actions/create_chain` 建立新课程链。

例如，读取最新 revision 和课程 ID 后，创建一次实验：

```json
{
  "revision": "<list_course_tasks 返回的 revision>",
  "lab": {
    "courseId": "<课程 ID>",
    "name": "实验三 · 电路测量",
    "startTime": "2026-09-17T14:00:00+08:00",
    "endTime": "2026-09-17T16:00:00+08:00",
    "acceptanceAtNextClass": true,
    "reportDeadline": "2026-09-26T23:59:00+08:00"
  }
}
```

`acceptanceAtNextClass` 与 `acceptanceDeadline` 不能同时指定。前者复制下一场实际实验课的当前开始时间，并不建立自动调课联动；查不到下一场时返回错误。省略验收／报告日期就不创建对应事项，不猜测日期。同一关联编号下已有同类事项时拒绝重复添加，需使用 `update_course_task`。

所有课程写工具均先校验最新 revision，再通过现有网页存档通道执行一次可撤销事务，收到持久化确认后返回新 revision 和任务列表；版本冲突或超时必须重新读取后再决定是否重试。

操作类型：

- `create_chain`: `{op, id, chain:{name,typeId,color,defaultReminders:[]}}`
- `create_event`: `{op,event:{name,startTime,endTime,chainId,typeId,reminders:[],properties:{},isHighlight:false,priority:0}}`
- `update_event`: `{op,id,changes:{...允许修改的事件字段}}`
- `delete_event`: `{op,id}`
- `set_course_task_rules`: `{op,id,rules}`（id 为事件链 ID）

新链可由后续事件引用；新增事件自动加入活动事件组。一次最多 200 项操作；整批验证完成后才执行。工具不暴露凭据库、API 密钥或仓库令牌。配对代表允许外部 MCP 客户端读写当前存档；外部工具调用不再弹出网页内的二次确认。只有用户明确请求的操作才应调用写入工具。

两个网页同时连接时只有一个活动存档拥有写入通道。网页离线或休眠时拒绝读写；未及时确认的操作返回不确定结果，客户端必须重新读取存档核验，不能直接重放创建操作。

## GitHub / Gitee 授权、建库与同步

账号界面使用托管授权服务，凭据在浏览器本地加密保存。编辑后自动同步、离线补传，并在跨设备冲突时暂停、提供版本选择。完整使用方式、合并规则、凭据保护边界与部署步骤见 [账号同步指南](WEB_ACCOUNT_SYNC.md)。

`server/` 中保留旧版本机仓库接口供兼容和测试使用，当前账号界面不再调用这些接口。下述本地凭据库说明适用于本机服务；网页账号登录的存储位置和加密机制见上面的账号同步指南。

## 本地凭据边界

系统日历订阅的设置、自动同步规则及 Worker 部署见 [系统日历提醒](SYSTEM_CALENDAR_SYNC.md)。

默认凭据文件：`~/.time-scheduler/credentials.enc`。可用 `TIMESCHEDULER_DATA_DIR` 指定目录。

- scrypt 从口令和随机盐派生密钥；AES-256-GCM 提供加密与完整性认证，每次写入生成新 IV。
- 网页 AI API Key 与登录令牌使用 AES-GCM 密文保存在本机 IndexedDB，设备 CryptoKey 不可导出；它们不进入日程备份或同步仓库。旧版本机服务凭据库仍使用口令加密，配对码和会话令牌不落盘。
- 浏览器的 localStorage 和同步存档仅保存日程数据。口令丢失后无法解密凭据，可重新创建凭据库并重新授权；日程存档不受影响。
- 本机服务仅绑定 `127.0.0.1`，检查 Host、来源、JSON 内容类型和内存会话令牌；OAuth 使用一次性 state 校验。出站凭据放在 HTTPS 请求头或令牌交换请求体中，不写 URL 查询串或日志。
- 点击锁定清除本机服务内存中的凭据库密钥；点击断开还会关闭 MCP 对当前网页的读写通道。
- 私有仓库中的日程是普通 JSON，隐私依赖平台仓库访问控制。SHA-256 用于内容核验，不替代平台鉴权。

## 验证

```sh
npm run type-check
npm run check:server
npm run check:worker
npm test
npm run test:cloud
npm run test:workspace
npm run test:browser-ai
npm run test:ai-relay
```

`test:workspace` 使用 Playwright Chromium，需要已经安装浏览器（`npx playwright install chromium`），并要求 4318 端口空闲。它启动临时本机服务和真正的 MCP stdio 客户端，在隔离浏览器与临时凭据目录中验证课程表单、批量导入、边缘摘要、配对、MCP 写入、版本冲突和刷新后的持久化；截图输出至忽略提交的 `test-results/`。

平台 API 和三种 AI 协议在单元测试中使用模拟响应，未使用真实账号、密钥、付费请求或创建实际远端仓库。部署前需用自己的 OAuth 应用完成平台端到端验收。
