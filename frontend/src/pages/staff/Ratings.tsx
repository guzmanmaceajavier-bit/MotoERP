import { useEffect, useState } from 'react'
import { Star, MessageSquareQuote, TrendingUp, User } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import type { Paginated } from '../../lib/pagination'
import Pagination from '../../components/Pagination'
import { StatCard } from '../../components/ui'

interface RatingRow {
  id: number
  score: number
  comment?: string
  created_at?: string
  user?: { name: string } | null
  work_order?: { order_number: string } | null
}

export default function Ratings() {
  const [ratings, setRatings] = useState<RatingRow[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [loading, setLoading] = useState(true)

  async function load(page = 1) {
    const res = await api<Paginated<RatingRow>>(`/staff/ratings?page=${page}`)
    setRatings(res.data)
    setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
    setLoading(false)
  }

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [])

  const avg =
    meta.total > 0 && ratings.length > 0
      ? Math.round((ratings.reduce((a, r) => a + r.score, 0) / ratings.length) * 10) / 10
      : 0

  function Stars({ n }: { n: number }) {
    return (
      <span className="text-amber-500">
        {'★'.repeat(n)}
        {'☆'.repeat(5 - n)}
      </span>
    )
  }

  if (loading) return <div className="py-10 text-center text-carbon-400">Cargando reseñas...</div>

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Reseñas" value={meta.total} tone="brand" icon={<Star className="h-[22px] w-[22px]" />} />
        <StatCard
          label="Promedio esta página"
          value={ratings.length ? avg.toFixed(1) + ' / 5' : '—'}
          tone="amber"
          icon={<TrendingUp className="h-[22px] w-[22px]" />}
        />
        <StatCard label="Con comentario" value={ratings.filter((r) => r.comment).length} tone="dark" icon={<MessageSquareQuote className="h-[22px] w-[22px]" />} />
      </div>

      <div className="space-y-3">
        {ratings.map((r) => (
          <div key={r.id} className="rounded-2xl border border-carbon-200 bg-white p-4 transition hover:border-brand-300">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-carbon-900 text-white">
                  <User className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-carbon-900">{r.user?.name ?? 'Cliente'}</span>
                    <Stars n={r.score} />
                  </div>
                  <span className="text-xs text-carbon-400">
                    {r.work_order?.order_number ?? 'Sin orden'} · {r.created_at ? new Date(r.created_at).toLocaleString('es-CO') : ''}
                  </span>
                </div>
              </div>
            </div>
            {r.comment && <p className="mt-3 whitespace-pre-line rounded-xl bg-carbon-50 px-4 py-3 text-sm text-carbon-700">{r.comment}</p>}
          </div>
        ))}
        {ratings.length === 0 && <p className="py-10 text-center text-carbon-400">Aún no hay reseñas de clientes.</p>}
      </div>

      <div className="mt-4">
        <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} onChange={(p) => load(p).catch(() => {})} />
      </div>
    </div>
  )
}