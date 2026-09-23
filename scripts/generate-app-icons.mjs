// Rasterize the existing logo; rerun after changing public/favicon.svg.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const root = new URL('../public/', import.meta.url)
const svg = await readFile(new URL('favicon.svg', root), 'utf8')
await mkdir(new URL('icons/', root), { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  for (const [name, size, padding] of [
    ['apple-touch-icon', 180, 0.10],
    ['icon-192', 192, 0.10],
    ['icon-512', 512, 0.10],
    // Keep the whole calendar within Android's central safe circle.
    ['icon-maskable-512', 512, 0.22],
    ['favicon', 32, 0],
  ]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await page.setContent(`<html><style>html,body{margin:0;width:100%;height:100%;background:${name === 'favicon' ? 'transparent' : '#eff6ff'}}body{box-sizing:border-box;padding:${size * padding}px}svg{width:100%;height:100%;display:block}</style><body>${svg}</body></html>`)
    const png = await page.screenshot({ omitBackground: name === 'favicon' })
    if (name === 'favicon') {
      // ICO supports PNG image payloads on modern Windows and desktop browsers.
      const header = Buffer.alloc(22)
      header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
      header[6] = size; header[7] = size
      header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12)
      header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18)
      await writeFile(new URL('favicon.ico', root), Buffer.concat([header, png]))
    } else await writeFile(new URL(`icons/${name}.png`, root), png)
    await page.close()
  }
} finally { await browser.close() }
