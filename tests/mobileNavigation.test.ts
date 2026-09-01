import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('mobile navigation exposes the primary actions with accessible labels', () => {
  const header = readSource('src/components/MobileHeader.tsx')
  const bottomNavigation = readSource('src/components/MobileBottomNav.tsx')

  assert.match(header, /aria-label="打开导航"/)
  assert.match(header, /aria-label="搜索"/)
  assert.match(header, /\['day', 'week', 'month'\]/)
  assert.match(bottomNavigation, /aria-label="主导航"/)
  assert.match(bottomNavigation, />分组</)
  assert.match(bottomNavigation, />待办</)
  assert.match(bottomNavigation, /aria-label="新建事件"/)
})

test('mobile layout includes safe areas, drawers, bottom sheet, and touch gestures', () => {
  const styles = readSource('src/index.css')
  const eventBlock = readSource('src/components/TimeTable/EventBlockItem.tsx')
  const dayColumn = readSource('src/components/TimeTable/DayColumn.tsx')

  assert.match(styles, /env\(safe-area-inset-bottom\)/)
  assert.match(styles, /\.app-left-panel/)
  assert.match(styles, /\.app-right-panel/)
  assert.match(styles, /\.mobile-bottom-nav/)
  assert.match(eventBlock, /pointerType === 'touch'/)
  assert.match(eventBlock, /touch-drag-handle/)
  assert.match(dayColumn, /startSlotLongPress/)
})
