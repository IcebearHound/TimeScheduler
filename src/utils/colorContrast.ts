/** Select text that meets WCAG AA on user-selected opaque hexadecimal colors. */
export function readableEventText(color: string): '#ffffff' | '#000000' {
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex
  if (!/^[0-9a-f]{6}$/i.test(full)) return '#000000'
  const channels = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
  const whiteContrast = 1.05 / (luminance + .05)
  return whiteContrast >= 4.5 ? '#ffffff' : '#000000'
}
