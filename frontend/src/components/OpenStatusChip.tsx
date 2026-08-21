import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { statusNow, type ScheduleInfo } from '../lib/schedule'

export default function OpenStatusChip({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<{ open: boolean; label: string } | null>(null)

  useEffect(() => {
    let alive = true
    api<ScheduleInfo>('/site-info')
      .then((d) => { if (alive) setStatus(statusNow(d)) })
      .catch(() => {})
    const t = setInterval(() => {
      api<ScheduleInfo>('/site-info').then((d) => { if (alive) setStatus(statusNow(d)) }).catch(() => {})
    }, 120000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  if (!status) return null

  return (
    <span
      title={status.label}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
        status.open ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${status.open ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
      {!compact && status.label}
      {compact && (status.open ? 'Abierto' : 'Cerrado')}
    </span>
  )
}