import { useEffect, useState } from 'react'

/** Refresh on minute boundaries and immediately when the page becomes visible. */
export default function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => { clearTimeout(timer); setNow(new Date()); timer = setTimeout(refresh, 60000 - Date.now() % 60000) }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return now
}
