import { z } from 'zod'

export const agentChoicesSchema = z.array(z.string().trim().min(1).max(1000)).max(20)

// Support providers and saved conversations still using numbered prose.
export function extractAgentChoices(text: string, choices?: string[]) {
  if (choices?.length) return { text, choices }
  if (!/[？?]|请选择|你指的是/.test(text)) return { text, choices: [] }
  const markers = [...text.matchAll(/[①②③④⑤⑥⑦⑧⑨⑩]|(?:^|\n)\s*\d{1,2}[.、)）]\s*/g)]
  if (markers.length < 2) return { text, choices: [] }
  const options = markers.map((marker, i) => text.slice(marker.index! + marker[0].length, markers[i + 1]?.index ?? text.length).trim().replace(/[；;。]+$/, ''))
  if (options.some(option => !option || option.length > 1000)) return { text, choices: [] }
  return { text: text.slice(0, markers[0].index).trim(), choices: options }
}
