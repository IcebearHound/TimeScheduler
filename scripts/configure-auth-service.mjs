import { planAuthSecrets } from './auth-secret-plan.mjs'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    // Validate before any deployment; no secret values are printed or written to files.
    planAuthSecrets(process.env, ['AUTH_STATE_SECRET'])
    if (!process.argv.includes('--validate')) {
      const wrangler = (args, input) => {
        const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'wrangler@4', ...args, '--config', 'worker/wrangler.jsonc'], { input, encoding: 'utf8', shell: process.platform === 'win32', env: process.env })
        if (result.status !== 0) throw new Error('Worker 密钥配置失败，请检查 Cloudflare Token 的 Workers 编辑权限和账号 ID')
        return result.stdout
      }
      const existing = JSON.parse(wrangler(['secret', 'list'])).map(item => item.name)
      const secrets = planAuthSecrets(process.env, existing)
      if (Object.keys(secrets).length) wrangler(['secret', 'bulk'], JSON.stringify(secrets))
      console.log(`授权配置就绪。已设置的项目：${Object.keys(secrets).join('、') || '沿用 Worker 现有配置'}。`)
    }
  } catch (error) { console.error(error instanceof Error ? error.message : '授权配置失败'); process.exitCode = 1 }
}
