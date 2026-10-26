import { Loader2 } from 'lucide-react'

export default function LoadingState({ label = '正在加载…' }: { label?: string }) {
  return <div role="status" className="loading-state"><Loader2 className="animate-spin" size={22} aria-hidden="true" /><span>{label}</span></div>
}
