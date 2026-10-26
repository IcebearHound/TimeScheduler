import test from 'node:test'
import assert from 'node:assert/strict'
import { readableEventText } from '../src/utils/colorContrast'

test('event labels meet AA contrast across dark, middle and light custom colors', () => {
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    const color = '#' + [r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')
    const [red, green, blue] = [r, g, b].map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    const luminance = .2126 * red + .7152 * green + .0722 * blue
    const ratio = readableEventText(color) === '#ffffff' ? 1.05 / (luminance + .05) : (luminance + .05) / .05
    assert.ok(ratio >= 4.5, `${color} contrast is ${ratio}`)
  }
})
