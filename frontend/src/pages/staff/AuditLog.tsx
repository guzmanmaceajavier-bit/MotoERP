import { useEffect, useState } from 'react'
import { ScrollText, Search, ShieldAlert } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { SectionHeader, Badge, EmptyState } from '../../components/ui'
import { Input, Select } from '../../components/ui/form'
import type { Paginated } from '../../lib/pagination'

interface AuditRow {
  id: number
  user: string | null
  action: string
  entity_type: string | null
  entity_id: number | null
  details: string | Record<string, unknown> | unknown[] | null
  ip: string | null
  created_at: string
}

function detailsText(details: AuditRow['details']): string | null {
  if (details == null) return null
  if (typeof details === 'string') return details.trim() ? details : null
  return JSON.stringify(details)
}

const ACTION_TONES: Record<string, 'brand' | 'green' | 'red' | 'blue' | 'amber' | 'gray'> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  login: 'brand',
  logout: 'gray',
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Creación',
  update: 'Actualización',
  delete: 'Eliminación',
  login: 'Inicio de sesión',
  logout: 'Cierre de sesión',
}

export default function AuditLog() {
  const toast = useToast().toast
  const [rows, setRows] = useState<AuditRow[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')

  async function load(page = 1) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (action) params.set('action', action)
      if (entityType) params.set('entity_type', entityType)
      const res = await api<Paginated<AuditRow>>(`/staff/audit-log?${params}`)
      setRows(res.data)
      setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(1), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, entityType])

  const fmtTime = (d?: string) => (d ? new Date(d).toLocaleString('es-CO') : '—')

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        variant="brand"
        title="Auditoría"
        subtitle="Registro de acciones de los usuarios en el sistema. Solo lectura."
        action={
          <span className="hidden items-center gap-2 rounded-xl border border-brand-300 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 sm:inline-flex">
            <ShieldAlert className="h-4 w-4" />
            {meta.total} registros
          </span>
        }
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-400" />
          <Input placeholder="Buscar en el log..." className="pl-9" variant="brand" disabled />
        </div>
        <Select value={action} onChange={(e) => setAction(e.target.value)} variant="brand" className="w-44">
          <option value="">Toda acción</option>
          <option value="create">Creación</option>
          <option value="update">Actualización</option>
          <option value="delete">Eliminación</option>
          <option value="login">Inicio de sesión</option>
          <option value="logout">Cierre de sesión</option>
        </Select>
        <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} variant="brand" className="w-48">
          <option value="">Toda entidad</option>
          <option value="App\Models\User">Usuarios</option>
          <option value="App\Models\WorkOrder">Órdenes</option>
          <option value="App\Models\Invoice">Facturas</option>
          <option value="App\Models\Product">Productos</option>
          <option value="App\Models\Motorcycle">Motos</option>
          <option value="App\Models\Warranty">Garantías</option>
          <option value="App\Models\Post">Blog</option>
          <option value="App\Models\Supplier">Proveedores</option>
          <option value="App\Models\Purchase">Compras</option>
        </Select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-carbon-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-carbon-200 bg-carbon-50/60 text-carbon-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Acción</th>
              <th className="px-4 py-3">Entidad</th>
              <th className="px-4 py-3">Detalles</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-carbon-100 last:border-b-0">
                <td className="whitespace-nowrap px-4 py-3 text-carbon-600">{fmtTime(a.created_at)}</td>
                <td className="px-4 py-3 font-medium text-carbon-900">{a.user ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge tone={ACTION_TONES[a.action] ?? 'gray'}>{ACTION_LABELS[a.action] ?? a.action}</Badge>
                </td>
                <td className="px-4 py-3 text-carbon-600">
                  {a.entity_type ? (
                    <span className="text-xs">
                      {a.entity_type.split('\\').pop()}
                      {a.entity_id != null ? ` #${a.entity_id}` : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="max-w-[280px] px-4 py-3">
                  <p className="truncate text-carbon-600" title={detailsText(a.details) ?? ''}>
                    {detailsText(a.details) || '—'}
                  </p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-carbon-500">{a.ip ?? '—'}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10">
                  <EmptyState icon={<ScrollText className="h-8 w-8" />} title="Sin registros" subtitle="Las acciones de los usuarios aparecerán aquí." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {meta.last_page > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            disabled={meta.current_page <= 1}
            onClick={() => load(meta.current_page - 1)}
            className="rounded-lg border border-carbon-300 px-3 py-1.5 text-sm text-carbon-700 hover:bg-carbon-100 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-carbon-500">
            {meta.current_page} / {meta.last_page}
          </span>
          <button
            disabled={meta.current_page >= meta.last_page}
            onClick={() => load(meta.current_page + 1)}
            className="rounded-lg border border-carbon-300 px-3 py-1.5 text-sm text-carbon-700 hover:bg-carbon-100 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
