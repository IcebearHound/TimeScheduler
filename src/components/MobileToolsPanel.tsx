import { Download, Plug, Undo2, Redo2, PanelRightOpen } from 'lucide-react'
import AppPanel from './AppPanel'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useWorkspaceStore from '../stores/workspaceStore'

export default function MobileToolsPanel() {
  const ui = useUIStore(), canUndo = useEventStore(s => s.canUndo), canRedo = useEventStore(s => s.canRedo)
  const close = () => ui.setIsMobileToolsOpen(false)
  const run = (action: () => void) => { close(); ui.setIsLeftSidebarOpen(false); ui.setIsRightPanelOpen(false); action() }
  return <AppPanel title="工具" onClose={close}><div className="grid grid-cols-2 gap-3">
    <button className="mobile-tool" onClick={() => run(() => ui.setIsImportDialogOpen(true))}><Download />导入课表</button>
    <button className="mobile-tool" onClick={() => run(() => useWorkspaceStore.getState().open('ai'))}><Plug />AI / MCP</button>
    <button className="mobile-tool" disabled={!canUndo} onClick={() => { useEventStore.getState().undo(); ui.addToast('已撤销') }}><Undo2 />撤销</button>
    <button className="mobile-tool" disabled={!canRedo} onClick={() => { useEventStore.getState().redo(); ui.addToast('已重做') }}><Redo2 />重做</button>
    <button className="mobile-tool col-span-2" onClick={() => run(() => ui.setIsRightPanelOpen(true))}><PanelRightOpen />{ui.selectedEventId ? '事件详情与事件链' : '待办侧栏'}</button>
  </div></AppPanel>
}
