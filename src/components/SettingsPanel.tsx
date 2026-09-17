import AISettings from './AISettings'
import { useEffect, useRef } from 'react'
import AppPanel from './AppPanel'
import useLayoutStore, { LayoutMode } from '../stores/layoutStore'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import { captureArchive, installArchive } from '../integrations/archive'
import { validateSnapshot } from '../integrations/contracts'
import { dialogConfirm, dialogAlert } from '../utils/dialog'

export default function SettingsPanel() {
  const ui = useUIStore(), layout = useLayoutStore()
  useEffect(() => { if (ui.settingsSection === 'ai') document.getElementById('ai-settings')?.scrollIntoView({ block: 'start' }) }, [ui.settingsSection])
  const file = useRef<HTMLInputElement>(null)
  const close = () => ui.setIsSettingsOpen(false)
  const backup = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(captureArchive(), null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = '时间规划器完整备份.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <AppPanel title="设置" onClose={close}>
    <div className="space-y-6">
      <AISettings />
      <fieldset><legend className="mb-2 font-semibold">界面布局</legend><div className="grid grid-cols-3 gap-2">
        {([['auto', '自动适配'], ['mobile', '手机版'], ['desktop', '桌面版']] as [LayoutMode, string][]).map(([mode, label]) => <button key={mode} aria-pressed={layout.mode === mode} className={`workspace-button min-h-11 ${layout.mode === mode ? 'primary' : ''}`} onClick={() => layout.setMode(mode)}>{label}</button>)}
      </div><p className="mt-2 text-xs text-slate-500">当前为{layout.isMobile ? '手机版' : '桌面版'}，此设备会记住你的选择。小屏使用桌面版时可横向滚动。</p></fieldset>
      <fieldset><legend className="mb-2 font-semibold">主题</legend><div className="grid grid-cols-3 gap-2">{(['light', 'dark', 'system'] as const).map((mode, i) => <button key={mode} aria-pressed={ui.themeMode === mode} className={`workspace-button min-h-11 ${ui.themeMode === mode ? 'primary' : ''}`} onClick={() => ui.setThemeMode(mode)}>{['浅色', '深色', '跟随系统'][i]}</button>)}</div></fieldset>
      <label className="flex min-h-11 items-center justify-between gap-3"><span>显示事件组图标</span><input type="checkbox" checked={ui.showGroupEmoji} onChange={e => ui.setShowGroupEmoji(e.target.checked)} /></label>
      <section><h3 className="mb-2 font-semibold">管理与帮助</h3><div className="grid grid-cols-2 gap-2"><button className="workspace-button min-h-11" onClick={() => { close(); ui.setIsTypeManagerOpen(true) }}>事件类型管理</button><button className="workspace-button min-h-11" onClick={() => { close(); ui.setIsWelcomeGuideOpen(true) }}>功能导览</button></div></section>
      <section><h3 className="mb-2 font-semibold">数据备份</h3><div className="grid grid-cols-2 gap-2"><button className="workspace-button min-h-11" onClick={backup}>导出全部数据</button><button className="workspace-button min-h-11" onClick={() => file.current?.click()}>恢复备份</button></div>
        <input ref={file} aria-label="选择完整备份" type="file" accept=".json" className="hidden" onChange={async e => {
          const chosen = e.target.files?.[0]; e.target.value = ''; if (!chosen) return
          try {
            if (chosen.size > 10 * 1024 * 1024) throw new Error('备份文件不能超过 10 MB')
            const snapshot = validateSnapshot(JSON.parse(await chosen.text()))
            if (await dialogConfirm(`恢复 ${snapshot.events.length} 个事件和 ${snapshot.groups.length} 个事件组，将替换当前日程；可通过撤销恢复。`, '恢复备份')) { installArchive(snapshot, '恢复完整备份'); ui.addToast('备份已恢复，可撤销') }
          } catch (error) { await dialogAlert(error instanceof Error ? error.message : '备份文件无法读取') }
        }} />
        <p className="mt-2 text-xs text-slate-500">包含日程、事件链、分组和学期日期。登录令牌不会导出。</p>
      </section>
      <button className="workspace-button min-h-11 w-full text-red-600" onClick={async () => {
        if (await dialogConfirm('确定清除所有日程？已登录时删除也会同步到云端，请先导出备份。', '清除数据', 'danger')) {
          useEventStore.getState().clear(); useEventGroupStore.setState({ groups: new Map(), groupOrder: [], activeGroupId: '' }); close()
        }
      }}>清除全部日程</button>
      {import.meta.env.DEV && <label className="flex min-h-11 items-center justify-between">调试面板<input type="checkbox" checked={ui.showDebugPanel} onChange={e => ui.setShowDebugPanel(e.target.checked)} /></label>}
    </div>
  </AppPanel>
}
