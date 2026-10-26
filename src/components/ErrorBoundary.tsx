import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, Download, RefreshCw } from 'lucide-react'
import { downloadJSON } from '../utils/download'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean; downloaded: boolean }> {
  state = { error: false, downloaded: false }
  static getDerivedStateFromError() { return { error: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Application render failed', error, info.componentStack) }
  backup = () => {
    try {
      // Download scheduler data only; never include credentials or other browser storage.
      const read = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
      const events = useEventStore.getState(), groups = useEventGroupStore.getState()
      downloadJSON({ eventStore: read('eventStore'), eventGroupStore: read('eventGroupStore'), inMemoryArchive: { version: 1, semesterStartDate: events.semesterStartDate, events: [...events.events.values()], eventChains: [...events.eventChains.values()], eventTypes: [...events.eventTypes.values()], groups: [...groups.groups.values()], groupOrder: groups.groupOrder, activeGroupId: groups.activeGroupId } }, '时间规划器原始数据.json')
      this.setState({ downloaded: true })
    } catch { this.setState({ downloaded: false }) }
  }
  render() {
    if (!this.state.error) return this.props.children
    return <main className="error-recovery"><div><AlertTriangle size={36} aria-hidden="true" /><h1>页面暂时遇到了问题</h1><p>请先导出当前设备的原始数据，再重新加载页面。重新加载不会主动清除本地日程。</p><div className="flex flex-wrap justify-center gap-3"><button className="btn-secondary" onClick={this.backup}><Download size={16} />导出原始数据</button><button className="btn-primary" onClick={() => location.reload()}><RefreshCw size={16} />重新加载</button></div>{this.state.downloaded && <p role="status">原始数据已导出。</p>}</div></main>
  }
}
