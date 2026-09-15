import { Github, Cloud } from 'lucide-react'
import useWorkspaceStore, { AccountProvider } from '../stores/workspaceStore'

export default function AccountMenuEntries({ onSelect }: { onSelect: () => void }) {
  const open = (provider: AccountProvider) => {
    onSelect()
    useWorkspaceStore.getState().open('account', provider)
  }
  return <div className="space-y-0.5 px-4 py-3">
    <p className="mb-2 text-[10px] font-semibold tracking-widest text-slate-400">账号与同步</p>
    <button onClick={() => open('github')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50"><Github className="h-4 w-4 shrink-0" />GitHub 登录与同步</button>
    <button onClick={() => open('gitee')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50"><Cloud className="h-4 w-4 shrink-0" />Gitee 登录与同步</button>
  </div>
}
