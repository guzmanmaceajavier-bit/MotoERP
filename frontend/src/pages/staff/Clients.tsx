import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Users, Pencil, Trash2, Plus, Download, Bike, Phone, Mail, Star, CalendarDays, UserPlus, FileText, ChevronDown, KeyRound, Send } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import type { Paginated } from '../../lib/pagination'
import { useToast } from '../../lib/toast'
import { SectionHeader, Badge } from '../../components/ui'
import { DataTable, type Column } from '../../components/ui/table'
import { Toolbar, IconButton } from '../../components/ui/toolbar'
import { Modal, ConfirmDialog } from '../../components/ui/modal'
import { Field, Input, Select } from '../../components/ui/form'
import { gradientFor } from '../../lib/gradients'
import type { Brand, MotorcycleModel } from '../../lib/types'

interface ClientRow {
  id: number
  name: string
  email: string
  phone?: string
  points_balance?: number
  created_at?: string
  motorcycles_count: number
}

interface ClientMoto {
  id: number
  nickname?: string
  plate?: string
  year?: number
  color?: string
  vin?: string
  brand?: string
  model?: string
  current_odometer: number
  status?: string
  accessories?: string[]
  documentation?: string
  registered_at?: string
  photo?: string
}

interface ClientDetail {
  client: { id: number; name: string; email: string; phone?: string; points_balance: number; created_at?: string }
  motorcycles: ClientMoto[]
  orders: {
    id: number
    order_number: string
    status: string
    service_type?: string
    created_at?: string
    motorcycle?: string
    total: number
  }[]
  stats: { motorcycles: number; orders: number; active_orders: number; invoiced: number }
}

type Counts = Record<string, number>

const statusTone: Record<string, string> = {
  pending: 'amber',
  in_progress: 'blue',
  awaiting_approval: 'brand',
  approved: 'green',
  completed: 'green',
  delivered: 'gray',
  cancelled: 'red',
}

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=600&fit=crop'

interface MotoFormState {
  plate: string
  brandId: string
  modelId: string
  year: string
  color: string
  odometer: string
}

const emptyMoto = (): MotoFormState => ({ plate: '', brandId: '', modelId: '', year: '', color: '', odometer: '' })

export default function Clients() {
  const toast = useToast().toast
  const [clients, setClients] = useState<ClientRow[]>([])
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number; counts?: Counts }>({
    current_page: 1,
    last_page: 1,
    total: 0,
  })
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ClientRow | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', points_balance: '', password: '' })
  const [motos, setMotos] = useState<MotoFormState[]>([emptyMoto()])
  const [motoModels, setMotoModels] = useState<Record<number, MotorcycleModel[]>>({})
  const [brands, setBrands] = useState<Brand[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toDelete, setToDelete] = useState<ClientRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [detail, setDetail] = useState<ClientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [sendCreds, setSendCreds] = useState<ClientRow | null>(null)
  const [sendPassword, setSendPassword] = useState('')
  const [sending, setSending] = useState(false)

  const fmt = (n: number) => '$' + Number(n).toLocaleString('es-CO')

  useEffect(() => {
    api<Brand[]>('/brands')
      .then(setBrands)
      .catch(() => {})
  }, [])

  async function handleBrandChange(index: number, value: string) {
    setMotos((ms) => ms.map((m, i) => (i === index ? { ...m, brandId: value, modelId: '' } : m)))
    setMotoModels((mm) => ({ ...mm, [index]: [] }))
    if (!value) return
    try {
      const data = await api<MotorcycleModel[]>(`/brands/${value}/models`)
      setMotoModels((mm) => ({ ...mm, [index]: data }))
    } catch {
      setMotoModels((mm) => ({ ...mm, [index]: [] }))
    }
  }

  function addMoto() {
    setMotos((ms) => [...ms, emptyMoto()])
  }

  function removeMoto(index: number) {
    setMotos((ms) => ms.filter((_, i) => i !== index))
    setMotoModels((mm) => {
      const next: Record<number, MotorcycleModel[]> = { ...mm }
      delete next[index]
      return next
    })
  }

  const fetchPage = useCallback(
    async (p: number) => {
      const params = new URLSearchParams({ page: String(p) })
      if (query.trim()) params.set('search', query.trim())
      const res = await api<Paginated<ClientRow>>(`/staff/clients?${params.toString()}`)
      setClients(res.data)
      setMeta({
        current_page: res.meta.current_page,
        last_page: res.meta.last_page,
        total: res.meta.total,
        counts: res.meta.counts,
      })
    },
    [query],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      fetchPage(1).catch(() => toast.error('No se pudo cargar los clientes'))
    }, 300)
    return () => clearTimeout(t)
  }, [fetchPage, toast])

  async function loadPage(p: number) {
    setPage(p)
    await fetchPage(p)
  }

  async function view(c: ClientRow) {
    setDetailLoading(true)
    setDetail(null)
    setShowDetail(true)
    try {
      setDetail(await api<ClientDetail>(`/staff/clients/${c.id}`))
    } catch {
      toast.error('No se pudo cargar el garaje')
    } finally {
      setDetailLoading(false)
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'El nombre es obligatorio'
    if (!form.email.trim() || !/.+@.+\..+/.test(form.email)) errs.email = 'Correo inválido'
    if (form.points_balance !== '' && (!Number.isFinite(Number(form.points_balance)) || Number(form.points_balance) < 0)) {
      errs.points_balance = 'Puntos inválidos (número mayor o igual a 0)'
    }
    if (form.password && form.password.length < 8) errs.password = 'La contraseña debe tener al menos 8 caracteres'
    if (!editing) {
      const hasData = (m: MotoFormState) => m.plate.trim() || m.brandId || m.year
      const filled = motos.filter(hasData)
      if (filled.length === 0) {
        errs.moto = 'Registra al menos una moto: todo cliente tiene su moto'
      } else {
        const emptyPlates = filled.filter((m) => !m.plate.trim())
        if (emptyPlates.length) {
          errs.moto = 'Todas las motos necesitan número de placa'
        } else {
          const badPlate = filled.find((m) => !/^[A-Za-z0-9-]{4,10}$/.test(m.plate.trim()))
          if (badPlate) errs.moto = 'Placa inválida en una moto (ej. ABC12D)'
        }
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      const payload: Record<string, unknown> = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null }
      if (editing) {
        payload.points_balance = form.points_balance !== '' ? Number(form.points_balance) : 0
        if (form.password) payload.password = form.password
      }
      if (!editing) {
        const filled = motos.filter((m) => m.plate.trim() || m.brandId || m.year)
        payload.motorcycles = filled.map((m) => ({
          nickname: null,
          plate: m.plate.toUpperCase().trim(),
          brand_id: m.brandId ? Number(m.brandId) : null,
          motorcycle_model_id: m.modelId ? Number(m.modelId) : null,
          year: m.year ? Number(m.year) : null,
          color: m.color.trim() || null,
          current_odometer: m.odometer ? Number(m.odometer) : 0,
        }))
      }
      if (editing) {
        await api(`/staff/clients/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        toast.success('Cliente actualizado')
      } else {
        await api('/staff/clients', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Cliente creado')
      }
      setForm({ name: '', email: '', phone: '', points_balance: '0', password: '' })
      setMotos([emptyMoto()])
      setMotoModels({})
      setEditing(null)
      setFormOpen(false)
      await fetchPage(page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api(`/staff/clients/${toDelete.id}`, { method: 'DELETE' })
      toast.success('Cliente eliminado')
      setToDelete(null)
      const newPage = clients.length === 1 && page > 1 ? page - 1 : page
      setPage(newPage)
      await fetchPage(newPage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  async function sendCredentials() {
    if (!sendCreds || !sendPassword || sendPassword.length < 8) return
    setSending(true)
    try {
      await api(`/staff/clients/${sendCreds.id}/send-credentials`, {
        method: 'POST',
        body: JSON.stringify({ password: sendPassword }),
      })
      toast.success('Credenciales enviadas por WhatsApp')
      setSendCreds(null)
      setSendPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar credenciales')
    } finally {
      setSending(false)
    }
  }

  function startEdit(c: ClientRow) {
    setEditing(c)
    setForm({ name: c.name, email: c.email, phone: c.phone ?? '', points_balance: String(c.points_balance ?? 0), password: '' })
    setMotos([emptyMoto()])
    setMotoModels({})
    setErrors({})
    setFormOpen(true)
  }

  function startNew() {
    setEditing(null)
    setForm({ name: '', email: '', phone: '', points_balance: '0', password: '' })
    setMotos([emptyMoto()])
    setMotoModels({})
    setErrors({})
    setFormOpen(true)
  }

  function downloadCsv(rows: ClientRow[]) {
    const head = ['Nombre', 'Correo', 'Teléfono', 'Motos', 'Puntos', 'Registrado']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      head.join(';'),
      ...rows.map((c) =>
        [c.name, c.email, c.phone ?? '', c.motorcycles_count, c.points_balance ?? 0, c.created_at ? new Date(c.created_at).toLocaleDateString('es-CO') : '']
          .map(esc)
          .join(';'),
      ),
    ]
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const all: ClientRow[] = []
      let p = 1
      let last = 1
      do {
        const params = new URLSearchParams({ per_page: '50', page: String(p) })
        if (query.trim()) params.set('search', query.trim())
        const res = await api<Paginated<ClientRow>>(`/staff/clients?${params.toString()}`)
        all.push(...res.data)
        last = res.meta.last_page
        p++
      } while (p <= last && p < 200)

      if (all.length === 0) {
        toast.error('No hay clientes para exportar')
        return
      }
      downloadCsv(all)
      toast.success(`Excel descargado con ${all.length} cliente(s)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  const counts = meta.counts
  const kpis: { label: string; value: number; icon: typeof Users; accent: string }[] = [
    { label: 'Clientes', value: counts?.all ?? meta.total, icon: Users, accent: 'from-brand-500 to-brand-700' },
    { label: 'Nuevos este mes', value: counts?.this_month ?? 0, icon: UserPlus, accent: 'from-indigo-500 to-indigo-700' },
  ]

  const columns: Column<ClientRow>[] = [
    {
      key: 'name',
      header: 'Cliente',
      render: (c) => (
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${gradientFor(c.name)}`}>
            {c.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-carbon-950">{c.name}</p>
            <p className="truncate text-xs text-carbon-500">{c.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Teléfono',
      render: (c) => (
        <span className="inline-flex items-center gap-1.5 text-carbon-600">
          <Phone className="h-3.5 w-3.5 text-carbon-400" />
          {c.phone || '—'}
        </span>
      ),
    },
    {
      key: 'motos',
      header: 'Motos',
      align: 'center',
      render: (c) => (
        <span
          className={`inline-flex min-w-9 items-center justify-center rounded-full px-2 py-0.5 text-sm font-black ${
            c.motorcycles_count > 0 ? 'bg-brand-100 text-brand-700' : 'bg-carbon-100 text-carbon-500'
          }`}
        >
          {c.motorcycles_count}
        </span>
      ),
    },
    {
      key: 'points',
      header: 'Puntos',
      align: 'center',
      render: (c) => (
        <span className="inline-flex items-center gap-1 text-sm text-carbon-600">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          {c.points_balance ?? 0}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Registrado',
      render: (c) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-carbon-600">
          <CalendarDays className="h-3.5 w-3.5 text-carbon-400" />
          {c.created_at ? new Date(c.created_at).toLocaleDateString('es-CO') : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          <IconButton title="Ver garaje y motos" onClick={() => view(c)}>
            <Bike className="h-[15px] w-[15px]" />
          </IconButton>
          <IconButton title="Enviar credenciales por WhatsApp" onClick={() => { setSendCreds(c); setSendPassword('') }}>
            <Send className="h-[15px] w-[15px]" />
          </IconButton>
          <IconButton title="Editar cliente" onClick={() => startEdit(c)}>
            <Pencil className="h-[15px] w-[15px]" />
          </IconButton>
          <IconButton title="Eliminar cliente" danger onClick={() => setToDelete(c)}>
            <Trash2 className="h-[15px] w-[15px]" />
          </IconButton>
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-7xl anim-fade-up">
      <SectionHeader
        title="Clientes"
        subtitle="Gestiona los clientes del taller, sus motos y su garaje."
        variant="brand"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exportando…' : 'Descargar Excel'}
            </button>
            <button
              onClick={startNew}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center gap-4 rounded-2xl border border-brand-200 bg-white p-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${k.accent} text-white`}>
              <k.icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-2xl font-extrabold text-carbon-950">{k.value.toLocaleString('es-CO')}</p>
              <p className="text-sm text-carbon-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <Toolbar searchValue={query} onSearch={setQuery} searchPlaceholder="Buscar por nombre, correo o teléfono…" searchVariant="brand" />

      <DataTable
        columns={columns}
        rows={clients}
        page={page}
        lastPage={meta.last_page}
        total={meta.total}
        onPage={(p) => loadPage(p)}
        emptyText="Sin clientes con los filtros actuales."
        minWidth="min-w-[920px]"
        variant="brand"
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        subtitle={editing ? undefined : 'Se creará con contraseña motohub123 para que acceda a su panel.'}
        size="lg"
        variant="brand"
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button type="submit" form="client-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50">
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear cliente'}
            </button>
          </>
        }
      >
        <form id="client-form" onSubmit={save} className="space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-brand-50/60 px-3.5 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <Users className="h-4 w-4" />
              </span>
              <p className="text-sm font-bold text-brand-800">Datos del cliente</p>
            </div>
            <Field label="Nombre completo" error={errors.name} variant="brand">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan Pérez" variant="brand" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Correo electrónico" error={errors.email} variant="brand">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cliente@mail.com" variant="brand" />
              </Field>
              <Field label="Teléfono" variant="brand">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="3012345678" variant="brand" />
              </Field>
            </div>
            {editing && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 rounded-xl bg-amber-50/60 px-3.5 py-2.5">
<span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-bold text-amber-800">Acceso y puntos</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Puntos" error={errors.points_balance} variant="brand">
                    <Input type="number" min={0} value={form.points_balance} onChange={(e) => setForm({ ...form, points_balance: e.target.value })} placeholder="0" variant="brand" />
                  </Field>
                  <Field label="Nueva contraseña" hint="Déjalo vacío para no cambiarla" error={errors.password} variant="brand">
                    <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" variant="brand" />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {!editing && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 bg-white px-3.5 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
                  <Bike className="h-4 w-4" />
                </span>
                <p className="text-sm font-bold text-brand-800">
                  Motos del cliente <span className="font-medium normal-case text-carbon-400">(un cliente puede tener 1 o más motos)</span>
                </p>
              </div>

              {errors.moto && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{errors.moto}</p>}

              {motos.map((m, index) => (
                <div key={index} className={`rounded-2xl border bg-white p-4 ${motos.length > 1 ? 'border-brand-200' : 'border-brand-100'}`}>
                  {motos.length > 1 && (
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-carbon-400">Moto {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeMoto(index)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Quitar
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={motos.length > 1 ? `Placa (moto ${index + 1})` : 'Placa'} error={errors[`plate${index}`]} variant="brand">
                      <Input value={m.plate} onChange={(e) => setMotos((ms) => ms.map((x, i) => (i === index ? { ...x, plate: e.target.value } : x)))} placeholder="ABC12D" className="uppercase" variant="brand" />
                    </Field>
                    <Field label="Año" variant="brand">
                      <Input type="number" value={m.year} onChange={(e) => setMotos((ms) => ms.map((x, i) => (i === index ? { ...x, year: e.target.value } : x)))} placeholder="2024" variant="brand" />
                    </Field>
                    <Field label="Marca" variant="brand">
                      <Select value={m.brandId} onChange={(e) => handleBrandChange(index, e.target.value)} variant="brand">
                        <option value="">Selecciona marca</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Modelo" variant="brand">
                      <Select value={m.modelId} onChange={(e) => setMotos((ms) => ms.map((x, i) => (i === index ? { ...x, modelId: e.target.value } : x)))} disabled={!m.brandId} variant="brand">
                        <option value="">Selecciona modelo</option>
                        {(motoModels[index] ?? []).map((mod) => (
                          <option key={mod.id} value={mod.id}>{mod.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Color" variant="brand">
                      <Input value={m.color} onChange={(e) => setMotos((ms) => ms.map((x, i) => (i === index ? { ...x, color: e.target.value } : x)))} placeholder="Negro, rojo…" variant="brand" />
                    </Field>
                    <Field label="Kilometraje actual" variant="brand">
                      <Input type="number" value={m.odometer} onChange={(e) => setMotos((ms) => ms.map((x, i) => (i === index ? { ...x, odometer: e.target.value } : x)))} placeholder="0" variant="brand" />
                    </Field>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addMoto}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/40 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
              >
                <Plus className="h-4 w-4" />
                Añadir otra moto
              </button>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        title="Eliminar cliente"
        message={`¿Seguro que quieres eliminar a "${toDelete?.name}"? Se conservará el historial.`}
        loading={deleting}
      />

      <Modal
        open={!!sendCreds}
        onClose={() => { setSendCreds(null); setSendPassword('') }}
        title="Enviar credenciales por WhatsApp"
        subtitle={sendCreds ? `A ${sendCreds.name} (${sendCreds.phone || 'sin teléfono'})` : undefined}
        size="sm"
        variant="brand"
        footer={
          <>
            <button onClick={() => { setSendCreds(null); setSendPassword('') }} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button
              onClick={sendCredentials}
              disabled={sending || !sendPassword || sendPassword.length < 8 || !sendCreds?.phone}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 active:scale-[0.97] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Enviando…' : 'Enviar por WhatsApp'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {!sendCreds?.phone && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
              Este cliente no tiene teléfono registrado. Agrega un teléfono primero.
            </div>
          )}
          <Field label="Contraseña a enviar" variant="brand">
            <Input
              type="password"
              value={sendPassword}
              onChange={(e) => setSendPassword(e.target.value)}
              placeholder="••••••••"
              variant="brand"
            />
          </Field>
          <p className="text-xs text-carbon-400">
            Se enviará un mensaje de WhatsApp con el correo y la contraseña del cliente.
          </p>
        </div>
      </Modal>

      <Modal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        title={`Garaje de ${detail?.client.name ?? '…'}`}
        subtitle={[detail?.client.email, detail?.client.phone].filter(Boolean).join(' · ')}
        size="lg"
        variant="brand"
      >
        {detailLoading || !detail ? (
          <div className="space-y-3 py-4">
            <div className="h-4 w-24 animate-pulse rounded bg-brand-100" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-brand-50" />)}
            </div>
            <div className="h-48 animate-pulse rounded-xl bg-brand-50" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-lg font-extrabold text-white ${gradientFor(detail.client.name)}`}>
                {detail.client.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-carbon-950">{detail.client.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-carbon-500">
                  <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{detail.client.email}</span>
                  {detail.client.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{detail.client.phone}</span>}
                  {detail.client.created_at && (
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Cliente desde {new Date(detail.client.created_at).toLocaleDateString('es-CO')}</span>
                  )}
                </div>
              </div>
              <Badge tone="brand" className="text-xs">
                <Star className="mr-1 inline h-3 w-3" />{detail.client.points_balance} pts
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Motos" value={String(detail.stats.motorcycles)} accent="from-brand-500 to-brand-700" icon={Bike} />
              <MiniStat label="Órdenes" value={String(detail.stats.orders)} accent="from-indigo-500 to-indigo-700" icon={CalendarDays} />
              <MiniStat label="En curso" value={String(detail.stats.active_orders)} accent="from-amber-500 to-orange-600" icon={Users} />
              <MiniStat label="Facturado" value={fmt(detail.stats.invoiced)} accent="from-emerald-500 to-emerald-700" icon={Download} />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-carbon-500">Motos</h4>
                <div className="h-px flex-1 bg-brand-100" />
              </div>
              {detail.motorcycles.length === 0 ? (
                <p className="rounded-xl border border-dashed border-brand-300 bg-white py-6 text-center text-sm text-carbon-400">
                  Este cliente aún no tiene motos registradas.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {detail.motorcycles.map((m) => (
                    <MotoCard key={m.id} m={m} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-carbon-500">Órdenes / Historial</h4>
                <div className="h-px flex-1 bg-brand-100" />
              </div>
              {detail.orders.length === 0 ? (
                <p className="rounded-xl border border-dashed border-brand-300 bg-white py-6 text-center text-sm text-carbon-400">
                  Sin órdenes registradas para este cliente.
                </p>
              ) : (
                <div className="space-y-2">
                  {detail.orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-carbon-950">{o.order_number}</p>
                        <p className="truncate text-xs text-carbon-500">
                          {[o.created_at ? new Date(o.created_at).toLocaleDateString('es-CO') : '', o.motorcycle, o.service_type].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge tone={statusTone[o.status] ?? 'gray'}>{o.status}</Badge>
                        <p className="mt-1 text-sm font-bold text-carbon-950">{fmt(o.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function MotoCard({ m }: { m: ClientMoto }) {
  const [showDocs, setShowDocs] = useState(false)
  const title = m.nickname || [m.brand, m.model].filter(Boolean).join(' ') || 'Moto'
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-brand-200 bg-white">
      <div className="relative h-40 w-full overflow-hidden bg-carbon-100">
        <img src={m.photo || PLACEHOLDER_IMG} alt={title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold text-white drop-shadow">{title}</p>
            <p className="truncate text-xs font-medium text-white/80">
              {[m.brand, m.model, m.year].filter(Boolean).join(' · ') || 'Sin especificar'}
            </p>
            {m.registered_at && (
              <p className="mt-0.5 text-[11px] text-white/60">Desde {new Date(m.registered_at + 'T00:00:00').toLocaleDateString('es-CO')}</p>
            )}
          </div>
          {m.plate && (
            <span className="shrink-0 rounded-lg border border-white/25 bg-white/15 px-2.5 py-1 text-xs font-bold tracking-wider text-white backdrop-blur-sm">
              {m.plate}
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="rounded-xl border border-brand-100 bg-brand-50/40">
          <p className="border-b border-brand-100 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
            Ficha técnica
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-3.5 py-3 sm:grid-cols-3">
            <Spec label="Color" value={m.color || '—'} />
            <Spec label="Año" value={m.year ? String(m.year) : '—'} />
            <Spec label="Kilometraje" value={`${Number(m.current_odometer ?? 0).toLocaleString('es-CO')} km`} />
            <Spec label="VIN / Chasis" value={m.vin || '—'} mono />
            <Spec label="Estado" value={m.status || 'Activa'} />
            <Spec label="Modelo" value={m.model || '—'} />
          </div>
        </div>
        {m.accessories && m.accessories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {m.accessories.slice(0, 4).map((a, idx) => (
              <span key={idx} className="rounded-lg bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700">{a}</span>
            ))}
            {m.accessories.length > 4 && (
              <span className="rounded-lg bg-carbon-100 px-2.5 py-1 text-xs font-medium text-carbon-500">+{m.accessories.length - 4}</span>
            )}
          </div>
        )}
        {m.documentation && (
          <button
            onClick={() => setShowDocs(!showDocs)}
            className="mt-3 inline-flex items-center gap-1 self-start text-xs font-semibold text-carbon-500 transition hover:text-brand-600"
          >
            <FileText className="h-3.5 w-3.5" />
            {showDocs ? 'Ocultar' : 'Ver'} documentación
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDocs ? 'rotate-180' : ''}`} />
          </button>
        )}
        {showDocs && m.documentation && (
          <div className="mt-2 whitespace-pre-line rounded-xl bg-brand-50/60 p-3.5 text-sm text-carbon-600">
            {m.documentation}
          </div>
        )}
      </div>
    </div>
  )
}

function Spec({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-carbon-400">{label}</p>
      <p className={`mt-0.5 truncate font-semibold text-carbon-900 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</p>
    </div>
  )
}

function MiniStat({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof Users; accent: string }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white p-3">
      <p className="text-lg font-extrabold text-carbon-950">{value}</p>
      <p className="flex items-center gap-1 text-xs text-carbon-500">
        <span className={`flex h-4 w-4 items-center justify-center rounded bg-gradient-to-br ${accent} text-white`}>
          <Icon className="h-2.5 w-2.5" />
        </span>
        {label}
      </p>
    </div>
  )
}