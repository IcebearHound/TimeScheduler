import { AIConfig } from './ai'

/** Public defaults only. Credentials belong exclusively to the browser vault. */
export const aiPresets: Record<string, { label: string } & Omit<AIConfig, 'apiKey'>> = {
  deepseek: { label: 'DeepSeek', provider: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  openai: { label: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' },
  gemini: { label: 'Google Gemini', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash' },
  anthropic: { label: 'Anthropic Claude', provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514' },
  qwen: { label: '通义千问', provider: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  moonshot: { label: 'Kimi', provider: 'openai', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
}

export const aiModelSuggestions: Record<string, string[]> = {
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  openai: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514'],
  qwen: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
  moonshot: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
}
