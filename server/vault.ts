import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'

export class Vault {
  private key?: Buffer
  private salt?: Buffer
  private values: Record<string, unknown> = {}
  constructor(readonly path: string) {}
  get unlocked() { return !!this.key }
  unlock(password: string) {
    if (this.unlocked) throw new Error('请先锁定凭据库')
    if (password.length < 12) throw new Error('本地加密口令至少 12 个字符')
    const stored = existsSync(this.path) ? JSON.parse(readFileSync(this.path, 'utf8')) : null
    const salt = stored ? Buffer.from(stored.salt, 'base64') : randomBytes(16)
    const key = scryptSync(password, salt, 32)
    try {
      let values = {}
      if (stored) {
        if (stored.version !== 1) throw new Error('版本不支持')
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(stored.iv, 'base64'))
        decipher.setAuthTag(Buffer.from(stored.tag, 'base64'))
        values = JSON.parse(Buffer.concat([decipher.update(Buffer.from(stored.data, 'base64')), decipher.final()]).toString('utf8'))
      }
      this.key = key; this.salt = salt; this.values = values
      if (!stored) this.persist()
    } catch { key.fill(0); this.lock(); throw new Error('口令错误或凭据库损坏') }
  }
  lock() { this.key?.fill(0); this.key = undefined; this.salt = undefined; this.values = {} }
  get<T>(name: string): T | undefined { if (!this.key) throw new Error('请解锁本地凭据库'); return structuredClone(this.values[name]) as T | undefined }
  set(name: string, value: unknown) { if (!this.key) throw new Error('请解锁本地凭据库'); const before = this.values[name]; this.values[name] = value; try { this.persist() } catch (error) { this.values[name] = before; throw error } }
  private persist() {
    if (!this.key || !this.salt) throw new Error('凭据库已锁定')
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const data = Buffer.concat([cipher.update(JSON.stringify(this.values), 'utf8'), cipher.final()])
    const encrypted = JSON.stringify({ version: 1, salt: this.salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') })
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 })
    writeFileSync(`${this.path}.tmp`, encrypted, { mode: 0o600 })
    renameSync(`${this.path}.tmp`, this.path)
  }
}
