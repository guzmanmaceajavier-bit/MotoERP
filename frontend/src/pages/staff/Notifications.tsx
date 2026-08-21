import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { apiStaff } from '../../lib/api'
import Pagination from '../../components/Pagination'
import type { Paginated } from '../../lib/pagination'
import type { AppNotification } from '../../lib/types'

const typeStyles: Record<string, string> = {
  success: 'border-green-200 bg-green-50',
  warning: 'border-amber-200 bg-amber-50',
  info: 'border-blue-200 bg-blue-50',
  default: 'border-carbon-200 bg-white',
}

const channelLink: Record<string, { to: string; label: string }> = {
  order: { to: '/admin/ordenes', label: 'Ver órdenes' },
  invoice: { to: '/admin/ventas', label: 'Ver ventas' },
  store: { to: '/admin/ventas', label: 'Ver ventas' },
  inventory: { to: '/admin/inventario', label: 'Ver inventario' },
}

export default function StaffNotifications() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load(page = 1) {
    try {
      const res = await apiStaff<Paginated<AppNotification>>(`/notifications?page=${page}`)
      setItems(res.data)
      setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }

  async function markRead(id: number) {
    await apiStaff(`/notifications/${id}/read`, { method: 'POST' })
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  async function markAllRead() {
    await apiStaff('/notifications/read-all', { method: 'POST' })
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function remove(n: AppNotification) {
    if (!confirm(`¿Eliminar la notificación "${n.title}"?`)) return
    try {
      await apiStaff(`/notifications/${n.id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((x) => x.id !== n.id))
      setMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const unread = items.filter((n) => !n.read).length

  return (
    <div className="mx-auto max-w-3xl">
      {unread > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-brand-900">
                Tienes {unread} notificación{unread === 1 ? '' : 'es'} sin leer
              </p>
              <p className="text-xs text-brand-700">Pedidos nuevos, comprobantes por revisar y avisos de stock.</p>
            </div>
          </div>
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas leídas
          </button>
        </div>
      )}

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-carbon-900">Notificaciones</h2>
          <p className="text-sm text-carbon-500">Avisos del taller y de la tienda online.</p>
        </div>
      </div>

      {loading && <div className="p-4 text-carbon-500">Cargando...</div>}
      {error && <div className="p-4 text-red-600">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border border-carbon-200 bg-white p-8 text-center text-carbon-500">
          No hay notificaciones todavía.
        </div>
      )}

      <div className="space-y-3">
        {items.map((n) => (
          <div
            key={n.id}
            className={`rounded-xl border p-4 ${typeStyles[n.type] || typeStyles.default} ${n.read ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-carbon-900">{n.title}</p>
                  {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                </div>
                <p className="mt-1 text-sm text-carbon-700">{n.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-carbon-500">
                  <span>{n.created_at}</span>
                  {channelLink[n.channel] && (
                    <Link to={channelLink[n.channel].to} className="font-semibold text-brand-600 hover:underline">
                      {channelLink[n.channel].label}
                    </Link>
                  )}
                  {n.wa_sent ? <span className="text-green-600">Enviado por WhatsApp</span> : <span>In-app</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Leída
                  </button>
                )}
                <button
                  onClick={() => remove(n)}
                  className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-200"
                  title={`Eliminar "${n.title}"`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} onChange={(p) => load(p)} />
    </div>
  )
}
