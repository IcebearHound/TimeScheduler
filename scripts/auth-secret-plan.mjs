import { randomBytes } from 'node:crypto'

/** Build an in-memory upload; absent providers leave existing Worker secrets intact. */
export function planAuthSecrets(env, existingNames = []) {
  const secrets = {}
  for (const provider of ['GITHUB', 'GITEE']) {
    const id = (env[`${provider}_CLIENT_ID`] || '').trim(), secret = (env[`${provider}_CLIENT_SECRET`] || '').trim()
    if (!!id !== !!secret) throw new Error(`${provider} Client ID 和 Client Secret 必须成对填写`)
    if (id) { secrets[`${provider}_CLIENT_ID`] = id; secrets[`${provider}_CLIENT_SECRET`] = secret }
  }
  const configured = (env.AUTH_STATE_SECRET || '').trim()
  if (configured && configured.length < 32) throw new Error('AUTH_STATE_SECRET 至少需要 32 字符')
  if (configured) secrets.AUTH_STATE_SECRET = configured
  else if (!existingNames.includes('AUTH_STATE_SECRET')) secrets.AUTH_STATE_SECRET = randomBytes(32).toString('hex')
  return secrets
}
