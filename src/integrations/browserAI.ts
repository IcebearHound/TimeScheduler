import { aiConfigSchema, AIConfig, proposeActions, proposeAgent, parseAgentReply, AgentReply } from './ai'
import { aiPresets } from './aiPresets'
import { browserVault } from './browserVault'
import { actionsSchema, projectActions, Snapshot, snapshotRevision } from './contracts'
import { AgentAttachment, attachmentsSchema } from './attachments'
import { AgentWebPage, webPagesSchema } from './agentArtifacts'

export interface BrowserAIConfig extends AIConfig { preset: string; transport: 'direct' | 'relay' }
export const aiRelayEndpoint = (import.meta.env.VITE_AI_SERVICE_URL || import.meta.env.VITE_AUTH_SERVICE_URL || '').replace(/\/$/, '')
const vaultName = 'ai-api-config'
export async function loadBrowserAI() { return browserVault.get<BrowserAIConfig>(vaultName) }
export async function saveBrowserAI(config: BrowserAIConfig) {
  aiConfigSchema.parse(config)
  validateAIAddress(config.baseUrl)
  if (config.transport === 'relay' && (!aiRelayEndpoint || !aiPresets[config.preset] || aiPresets[config.preset].baseUrl !== config.baseUrl || aiPresets[config.preset].provider !== config.provider)) throw new Error('网站转发仅支持内置服务商，请使用直连访问自定义地址')
  await browserVault.set(vaultName, config)
}
export const forgetBrowserAI = () => browserVault.remove(vaultName)
function validateAIAddress(address: string) {
  const url = new URL(address)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('API 地址需要 HTTPS')
  if (url.username || url.password || url.search || url.hash) throw new Error('API 地址不能包含凭据、查询参数或片段')
}
export async function proposeBrowserActions(config: BrowserAIConfig, instruction: string, snapshot: Snapshot, signal: AbortSignal) {
  aiConfigSchema.parse(config); validateAIAddress(config.baseUrl)
  if (!instruction.trim() || instruction.length > 20000) throw new Error('请输入 1 至 20000 字的安排')
  const revision = await snapshotRevision(snapshot)
  let actions
  try {
    if (config.transport === 'relay') {
      if (!aiRelayEndpoint) throw new Error('网站尚未开通 AI 转发，请选择直连')
      validateAIAddress(aiRelayEndpoint)
      const response = await fetch(aiRelayEndpoint + '/ai/propose', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ preset: config.preset, model: config.model, instruction, snapshot }), redirect: 'error', signal })
      const result = await response.json()
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : '网站 AI 转发暂时不可用')
      actions = actionsSchema.parse(result.actions)
    } else actions = await proposeActions(config, instruction, snapshot, { browser: true, signal })
  } catch (error) {
    if (signal.aborted) throw new Error('请求已取消或超时，请重试')
    if (error instanceof TypeError) throw new Error(config.transport === 'direct' ? `无法连接 AI 服务，请检查网络。若服务商限制浏览器访问，${aiRelayEndpoint ? '可在高级设置选择网站转发' : '请换用支持网页直连的服务商，或联系网站管理员开通转发'}。` : '无法连接网站 AI 转发服务，请稍后重试')
    throw error
  }
  // Check IDs, dates and references before displaying an actionable proposal.
  projectActions(snapshot, actions, () => crypto.randomUUID())
  return { actions, revision }
}

export interface AIProfile extends BrowserAIConfig { id: string; name: string }
export interface AIProfiles { profiles: AIProfile[]; activeId: string; readerApiKey?: string }
const profilesVault = 'ai-api-profiles'
export async function loadAIProfiles(): Promise<AIProfiles> {
  const value = await browserVault.get<AIProfiles>(profilesVault)
  if (value) return value
  const legacy = await loadBrowserAI()
  const migrated = { profiles: legacy ? [{ ...legacy, id: crypto.randomUUID(), name: aiPresets[legacy.preset]?.label || '默认配置' }] : [], activeId: '' }
  migrated.activeId = migrated.profiles[0]?.id || ''
  if (legacy) { await saveAIProfiles(migrated); await forgetBrowserAI() }
  return migrated
}
export async function saveAIProfiles(value: AIProfiles) {
  for (const config of value.profiles) {
    aiConfigSchema.parse(config); validateAIAddress(config.baseUrl)
    if (config.transport === 'relay' && (!aiRelayEndpoint || aiPresets[config.preset]?.baseUrl !== config.baseUrl || aiPresets[config.preset]?.provider !== config.provider)) throw new Error('网站转发仅支持内置服务商')
  }
  await browserVault.set(profilesVault, value)
  window.dispatchEvent(new Event('ai-profiles-changed'))
}
export async function requestBrowserAgent(config: BrowserAIConfig, instruction: string, snapshot: Snapshot, signal: AbortSignal, attachments: AgentAttachment[] = [], webPages: AgentWebPage[] = []): Promise<AgentReply & { revision: string }> {
  aiConfigSchema.parse(config); validateAIAddress(config.baseUrl)
  attachmentsSchema.parse(attachments)
  webPagesSchema.parse(webPages)
  if (!instruction.trim() || instruction.length > 20000) throw new Error('对话过长，请清空会话后重试')
  const revision = await snapshotRevision(snapshot)
  try {
    let reply: AgentReply
    if (config.transport === 'relay') {
      if (!aiRelayEndpoint) throw new Error('网站尚未配置转发服务')
      validateAIAddress(aiRelayEndpoint)
      const response = await fetch(aiRelayEndpoint + '/ai/propose', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ mode: 'agent', preset: config.preset, model: config.model, instruction, snapshot, attachments, webPages }), redirect: 'error', signal })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'AI 转发失败')
      reply = parseAgentReply(result, snapshot)
    } else reply = await proposeAgent(config, instruction, snapshot, { browser: true, signal, attachments, webPages })
    if (reply.actions.length) projectActions(snapshot, reply.actions, () => crypto.randomUUID())
    return { ...reply, revision }
  } catch (error) {
    if (signal.aborted) throw new Error('请求已取消或超时')
    if (error instanceof TypeError) throw new Error('无法连接 AI 服务，请检查网络、地址或在对话框下方的 API 配置中切换网站转发')
    throw error
  }
}
