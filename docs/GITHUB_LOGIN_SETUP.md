# 从零开通 GitHub 授权登录（全程网页操作）

这是网站部署者的一次性设置。完成后，手机用户只需在右上角用户栏点击 GitHub 登录。

## 中国大陆访问与部署选择

下面的 Cloudflare Workers 方案便于部署，但普通 Cloudflare 全球网络不保证中国大陆的可达性和速度，不宜把默认 `workers.dev` 地址作为大陆用户唯一的登录入口。绑定自定义域名也不代表可以保证访问稳定。

Cloudflare 的 [China Network](https://www.cloudflare.com/network/china/) 是另行开通的企业服务，涉及中国大陆域名备案等接入条件，不是免费 Workers 自动附带的能力；具体产品支持范围须向服务商确认。

如果主要服务中国大陆用户，可优先评估香港云服务器或适用的国内云函数部署授权服务，并实测各运营商网络。当前代码和自动部署脚本针对 Cloudflare Workers，迁移到其他运行环境需要适配。即使更换授权服务，GitHub 登录页面和 GitHub Pages 前端的可达性仍会影响完整体验；Gitee 登录可作为另一入口。手机用户无需安装 Node.js 或运行 npm，部署工作由网站维护者一次性完成。

## 第一步：准备 Cloudflare

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com/)，注册或登录账号。
2. 进入 **Workers & Pages**，按首次使用向导创建自己的 `workers.dev` 子域名。
3. 在账号概览中复制 **Account ID（账户 ID）**。
4. 打开 [API Tokens](https://dash.cloudflare.com/profile/api-tokens)，选择 **Create Token → Edit Cloudflare Workers** 模板；账户资源限定为上一步的账户，创建并复制 Token。无需域名 DNS 权限，也不需要购买域名。
5. 打开 [TimeScheduler 的 Actions Secrets](https://github.com/IcebearHound/TimeScheduler/settings/secrets/actions)，点击 **New repository secret**，分别新增：

| Secret 名称 | 内容 |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `CLOUDFLARE_API_TOKEN` | 刚创建的 Workers 部署 Token |

Token 只填入 Secrets，不要发到聊天或提交到仓库。此时还不需要 GitHub OAuth App。

## 第二步：先部署服务，取得回调地址

1. 打开 [Deploy account authorization service 工作流](https://github.com/IcebearHound/TimeScheduler/actions/workflows/deploy-auth.yml)。
2. 点击 **Run workflow**，选择 `main`，确认运行。
3. 等待绿色成功结果，在此次运行的 **Summary** 查看 **GitHub 授权服务已部署**。
4. 复制服务地址和 GitHub 回调地址。形如：

```text
服务地址：https://time-scheduler-auth.你的子域名.workers.dev
回调地址：https://time-scheduler-auth.你的子域名.workers.dev/oauth/callback/github
```

请使用运行结果中的真实地址，不能照抄示例。若 Summary 未显示域名，进入 Cloudflare → Workers & Pages → `time-scheduler-auth` → Settings → Domains & Routes，复制正式的 `workers.dev` 地址。

首次部署会自动生成授权校验密钥，后续部署保留该密钥。尚未配置 OAuth App 时，登录按钮暂不可用是正常现象。

## 第三步：在 GitHub 创建 OAuth App

打开 [Register a new OAuth application](https://github.com/settings/applications/new)，填写：

| 字段 | 填写值 |
|---|---|
| Application name | `TimeScheduler` |
| Homepage URL | `https://icebearhound.github.io/TimeScheduler/` |
| Application description | `个人日程管理与私有仓库同步`（可选） |
| Authorization callback URL | 第二步得到的完整回调地址，以 `/oauth/callback/github` 结尾 |

点击 **Register application**。无需启用 Device Flow；若有回调通配符选项，保持关闭，回调地址使用精确匹配。

应用创建后：

1. 复制 **Client ID**。
2. 点击 **Generate a new client secret**，按 GitHub 要求完成验证后复制新 Secret。
3. 返回 [仓库 Actions Secrets](https://github.com/IcebearHound/TimeScheduler/settings/secrets/actions)，新增：

| Secret 名称 | 内容 |
|---|---|
| `GH_OAUTH_CLIENT_ID` | OAuth App 页面上的 Client ID |
| `GH_OAUTH_CLIENT_SECRET` | 刚生成的 Client Secret |

注意名称是 `GH_OAUTH_`，不是 `GITHUB_`。部署时会自动映射到 Worker 对应配置。

再次运行 **Deploy account authorization service**，等待成功。可以仅开通 GitHub，Gitee 无需配置。

## 第四步：让网站使用授权服务

1. 打开 [Actions Variables](https://github.com/IcebearHound/TimeScheduler/settings/variables/actions)。
2. 新增 **Repository variable**：名称 `VITE_AUTH_SERVICE_URL`，值为第二步的服务地址，**不要附加 `/oauth/callback/github`，不要带末尾斜杠**。
3. 打开 [Deploy to GitHub Pages](https://github.com/IcebearHound/TimeScheduler/actions/workflows/deploy.yml)，点击 **Run workflow**。
4. 成功后刷新网站，在右上角 **用户 → GitHub 登录与同步 → 使用 GitHub 账号登录**。

应用会跳到 GitHub 选择账号和授权，返回后自动创建私有仓库、同步并核验。无需粘贴个人访问令牌，也无需在手机安装任何工具。

## 验收与常见问题

- **按钮仍不可用**：确认两个部署工作流都成功；检查 `VITE_AUTH_SERVICE_URL` 位于 Variables、两个 `GH_OAUTH_*` 位于 Secrets，然后在账号面板点击“重新检查登录服务”。
- **回调地址不匹配**：GitHub OAuth App 中的地址必须与 Summary 中的地址完全相同，包含 `https://`、域名及 `/oauth/callback/github`。不要填 GitHub Pages 页面地址。
- **Cloudflare 部署失败**：核对 Account ID、Token 有效期和 Workers 编辑权限，并确认已经完成 Workers 子域名设置。
- **取消授权**：日程仍保存在此设备，可以重新登录。
- **权限说明**：GitHub 的 OAuth `repo` 权限范围包括私有仓库；本项目服务只允许操作 `time-scheduler-private` 专用仓库。`offline_access` 用于取得可续期令牌。
- **撤销授权**：账号面板中的“管理 GitHub 授权”会打开此应用的 GitHub 授权管理页。“退出登录”只清除此设备登录状态，不会删除日程或远端仓库。

## 实现依据

按 [GitHub 官方《授权 OAuth 应用》](https://docs.github.com/zh/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) 使用 Web Application Flow：随机 `state`、PKCE `S256`、服务端授权码交换、`/user` 身份验证和刷新令牌轮换。OAuth Client Secret 保存在 Worker Secrets，用户访问令牌和刷新令牌仅在当前浏览器加密持久化。

自动测试使用模拟 GitHub 响应验证实际 Worker 与浏览器代码。填写真实配置后，仍需按第四步使用自己的账号完成一次平台授权验收。
