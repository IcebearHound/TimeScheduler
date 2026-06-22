import React, { useState, useRef, useEffect } from 'react'
import { X, Upload, ExternalLink, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import useUIStore from '../stores/uiStore'
import useEventStore from '../stores/eventStore'
import useEventGroupStore from '../stores/eventGroupStore'
import { parseCourseTableFile, coursesToEvents } from '../utils/courseTableParser'
import { generateId } from '../utils/idGenerator'

const SDU_URL = 'https://bkzhjx.wh.sdu.edu.cn/'

export default function CourseImportModal() {
  const isOpen = useUIStore((s) => s.isImportDialogOpen)
  const setIsOpen = useUIStore((s) => s.setIsImportDialogOpen)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [semesterDate, setSemesterDate] = useState('2026-03-02')

  const [loading, setLoading] = useState(false)
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)
  const [showRemarksWarning, setShowRemarksWarning] = useState(false)
  const [remarksContent, setRemarksContent] = useState('')

  const handleClose = () => {
    setIsOpen(false)
    setResultMsg(null)
    setShowRemarksWarning(false)
  }

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  const openSduWebsite = () => {
    window.open(SDU_URL, '_blank')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!semesterDate) {
      setResultMsg({ type: 'error', text: '请先设置学期开始日期' })
      return
    }

    setLoading(true)
    setResultMsg(null)
    setShowRemarksWarning(false)

    try {
      const { courses, remark, errors } = await parseCourseTableFile(file)

      if (errors.length > 0) {
        setResultMsg({ type: 'error', text: `解析错误: ${errors.join('; ')}` })
        setLoading(false)
        return
      }

      if (courses.length === 0) {
        setResultMsg({ type: 'error', text: '未解析到任何课程，请确认文件格式正确' })
        setLoading(false)
        return
      }

      // 检查备注
      if (remark && remark.replace(/备注[：:]\s*/, '').trim()) {
        const remarkClean = remark.replace(/备注[：:]\s*/, '').trim()
        setRemarksContent(remarkClean)
        setShowRemarksWarning(true)
      }

      // 创建事件链和事件
      const semesterStartDate = new Date(semesterDate)
      const { eventChains, events } = coursesToEvents(courses, semesterStartDate)

      const gs = useEventGroupStore.getState()
      const es = useEventStore.getState()

      // 批量操作
      es.pushHistory()

      // 插入事件链
      const chainIds: string[] = []
      useEventStore.setState(s => {
        const nc = new Map(s.eventChains)
        const now = new Date()
        for (const chain of eventChains) {
          const id = generateId('chain')
          nc.set(id, { ...chain, id, createdAt: now, updatedAt: now })
          chainIds.push(id)
        }
        return { eventChains: nc }
      })

      const nameToChainId = new Map<string, string>()
      for (let i = 0; i < eventChains.length; i++) nameToChainId.set(eventChains[i].name, chainIds[i])

      // 插入事件
      const eventIds: string[] = []
      useEventStore.setState(s => {
        const ne = new Map(s.events)
        const now = new Date()
        for (const evt of events) {
          const id = generateId('event')
          const cid = nameToChainId.get(evt.name) || chainIds[0]
          let st = new Date(evt.startTime)
          let et = new Date(evt.endTime)
          if (et <= st) et = new Date(st.getTime() + 50 * 60 * 1000)
          ne.set(id, { ...evt, id, chainId: cid, startTime: st, endTime: et, createdAt: now, updatedAt: now })
          eventIds.push(id)
        }
        return { events: ne }
      })

      es.setSemesterStartDate(semesterStartDate)

      // 新建事件组，重名自动+1
      let baseName = `课程表 ${semesterDate}`
      let groupName = baseName
      let n = 1
      while (gs.getAllGroups().some(g => g.name === groupName)) {
        n++
        groupName = `${baseName} (${n})`
      }
      const newGroup = gs.addGroup({
        name: groupName, emoji: '📚',
        eventChainIds: chainIds, eventIds,
        description: `学期开始: ${semesterDate}，共 ${eventChains.length} 门课程`,
      })
      gs.setActiveGroup(newGroup.id)

      setResultMsg({
        type: 'success',
        text: `成功导入 ${eventChains.length} 门课程，共 ${events.length} 个事件。已自动创建课程事件链组。`,
      })
    } catch (error) {
      setResultMsg({ type: 'error', text: `导入失败: ${String(error)}` })
    } finally {
      setLoading(false)
      // 重置文件输入，允许重复导入同一文件
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-modal-backdrop" onClick={handleClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-modal-dark border border-slate-200/60 dark:border-slate-700/60 max-w-xl w-full mx-4 animate-modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200/60 dark:border-slate-700/60">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            导入课程表
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* 步骤1：获取课表文件 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
              第一步：获取课表文件
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              登录教务系统，从"培养管理 → 我的课表 → 学期理论课表"中选择对应学期并点击"导出"获取 .xls 课表文件。
            </p>
            <button
              onClick={openSduWebsite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-600 hover:bg-accent-700 shadow-sm shadow-accent-600/20 text-white text-sm rounded-lg font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              打开教务系统
            </button>
          </div>

          {/* 步骤2：设置学期开始日期 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              第二步：设置学期开始日期（周一）
            </h3>
            <input
              type="date"
              value={semesterDate}
              onChange={(e) => {
                setSemesterDate(e.target.value)
                setResultMsg(null)
              }}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/40 text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              系统将自动计算该日期起20周内的课程事件
            </p>
          </div>

          {/* 步骤3：上传文件 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              第三步：选择课程表文件
            </h3>
            <label className={`flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              loading
                ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/50'
                : 'border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/10'
            }`}>
              {loading ? (
                <>
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-slate-500">正在解析课程表...</span>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-blue-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    点击选择 .xls 课程表文件
                  </span>
                  <span className="text-xs text-slate-400">
                    支持山东大学导出的标准课表格式
                  </span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileSelect}
                disabled={loading}
                className="hidden"
              />
            </label>
          </div>

          {/* 结果提示 */}
          {resultMsg && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              resultMsg.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                : resultMsg.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
            }`}>
              {resultMsg.type === 'success' && <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              {resultMsg.type === 'error' && <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              {resultMsg.type === 'warning' && <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              <span>{resultMsg.text}</span>
            </div>
          )}

          {/* 备注警告弹窗 */}
          {showRemarksWarning && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-600 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-200 text-sm mb-1">
                    课表备注提醒
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {remarksContent}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    请注意：此备注可能包含重要的课程安排变更信息。
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRemarksWarning(false)}
                className="mt-3 px-3 py-1 bg-amber-200 dark:bg-amber-700 hover:bg-amber-300 dark:hover:bg-amber-600 text-amber-900 dark:text-amber-100 text-sm rounded-lg font-medium transition-colors"
              >
                我知道了
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-4 border-t border-slate-200/60 dark:border-slate-700/60">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-lg font-medium text-sm transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
