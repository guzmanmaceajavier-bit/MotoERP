import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import Pagination from '../components/Pagination'
import type { Paginated } from '../lib/pagination'
import type { AppNotification } from '../lib/types'

const typeStyles: Record<string, string> = {
  success: 'border-green-200 bg-green-50',
  warning: 'border-amber-200 bg-amber-50',
  info: 'border-blue-200 bg-blue-50',
  default: 'border-carbon-200 bg-white',
}

export default function Notifications() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load(page = 1) {
    try {
      const res = await api<Paginated<AppNotification>>(`/notifications?page=${page}`)
      setItems(res.data)
      setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }

  async function markRead(id: number) {
    await api(`/notifications/${id}/read`, { method: 'POST' })
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  async function markAllRead() {
    await api('/notifications/read-all', { method: 'POST' })
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function remove(n: AppNotification) {
    if (!confirm(`¿Eliminar la notificación "${n.title}"?`)) return
    try {
      await api(`/notifications/${n.id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((x) => x.id !== n.id))
      setMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-carbon-900">Notificaciones</h1>
          <p className="text-sm text-carbon-500">
            Avisos sobre tus órdenes, facturas, garantías y más.
          </p>
        </div>
        {items.some((n) => !n.read) && (
          <button
            onClick={markAllRead}
            className="rounded-lg border border-carbon-300 px-4 py-1.5 text-sm font-semibold text-carbon-700 hover:bg-carbon-100"
          >
            Marcar todas leídas
          </button>
        )}
      </div>

      {loading && <div className="p-4 text-carbon-500">Cargando...</div>}
      {error && <div className="p-4 text-red-600">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border border-carbon-200 bg-white p-8 text-center text-carbon-500">
          No tienes notificaciones todavía.
        </div>
      )}

      <div className="space-y-3">
        {items.map((n) => (
          <div
            key={n.id}
            className={`rounded-xl border p-4 ${typeStyles[n.type] || typeStyles.default} ${n.read ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-carbon-900">{n.title}</p>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                </div>
                <p className="mt-1 text-sm text-carbon-700">{n.message}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-carbon-500">
                  <span>{n.created_at}</span>
                  {n.channel === 'order' && <Link to="/panel/servicios" className="text-brand-600 hover:underline">Ver mis servicios</Link>}
                  {n.channel === 'invoice' && <Link to="/panel/mi-cuenta" className="text-brand-600 hover:underline">Ver facturas</Link>}
                  {n.channel === 'store' && <Link to="/panel/favoritos" className="text-brand-600 hover:underline">Ver favoritos</Link>}
                  {n.wa_sent ? <span className="text-green-600">Enviado por WhatsApp</span> : <span>In-app</span>}
                </div>
              </div>
              {!n.read && (
                <button
                  onClick={() => markRead(n.id)}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Marcar leída
                </button>
              )}
              <button
                onClick={() => remove(n)}
                className="rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-200"
                title={`Eliminar "${n.title}"`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} onChange={(p) => load(p)} />
    </div>
  )
}
