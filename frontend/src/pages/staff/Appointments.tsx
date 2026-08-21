import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CalendarPlus,
  CalendarCheck,
  Clock,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Wrench,
  CalendarDays,
  Users,
  Pencil,
  Trash2,
} from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import type { Paginated } from '../../lib/pagination'
import type { AppointmentRow, StaffUser } from '../../lib/types'
import { useToast } from '../../lib/toast'
import { SectionHeader, Badge } from '../../components/ui'
import { DataTable, type Column } from '../../components/ui/table'
import { Toolbar, FilterPill, IconButton } from '../../components/ui/toolbar'
import { Modal, ConfirmDialog } from '../../components/ui/modal'
import { Field, Input, Select, Textarea } from '../../components/ui/form'
import { gradientFor } from '../../lib/gradients'

interface ServiceOption { id: number; name: string }

type Counts = Record<string, number>

const statusTone: Record<string, string> = {
  pending: 'amber',
  confirmed: 'green',
  cancelled: 'red',
  done: 'blue',
}

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  done: 'Hecha',
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled' | 'done'

export default function Appointments() {
  const toast = useToast().toast
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [mechanics, setMechanics] = useState<StaffUser[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number; counts?: Counts }>({
    current_page: 1,
    last_page: 1,
    total: 0,
  })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AppointmentRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ name: '', email: '', phone: '', service_id: '', date: '', time: '10:00', notes: '' })
  const [toCancel, setToCancel] = useState<AppointmentRow | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [toDelete, setToDelete] = useState<AppointmentRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(
    async (p = 1) => {
      const params = new URLSearchParams({ page: String(p) })
      if (query.trim()) params.set('search', query.trim())
      if (status !== 'all') params.set('status', status)
      const res = await api<Paginated<AppointmentRow>>(`/staff/appointments?${params.toString()}`)
      setAppointments(res.data)
      setMeta({
        current_page: res.meta.current_page,
        last_page: res.meta.last_page,
        total: res.meta.total,
        counts: res.meta.counts,
      })
    },
    [query, status],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      load(1).catch(() => toast.error('No se pudieron cargar las citas'))
    }, 300)
    return () => clearTimeout(t)
  }, [load, toast])

  useEffect(() => {
    ;(async () => {
      const team = await api<Paginated<StaffUser>>('/staff/staff?page=1&per_page=100').catch(() => null)
      if (team) setMechanics(team.data.filter((u) => u.role === 'mechanic'))
      const svc = await api<ServiceOption[]>('/staff/catalog/services').catch(() => [])
      setServices(svc)
    })()
  }, [])

  function openNew() {
    setEditing(null)
    setForm({ name: '', email: '', phone: '', service_id: '', date: '', time: '10:00', notes: '' })
    setErrors({})
    setShowForm(true)
  }

  function openEdit(a: AppointmentRow) {
    setEditing(a)
    setForm({
      name: a.name,
      email: a.email,
      phone: a.phone ?? '',
      service_id: '',
      date: a.date,
      time: a.time,
      notes: '',
    })
    setErrors({})
    setShowForm(true)
  }

  async function createAppointment(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'El nombre es obligatorio'
    if (!form.email.trim() || !/.+@.+\..+/.test(form.email)) errs.email = 'Correo inválido'
    if (!form.date) errs.date = 'La fecha es obligatoria'
    if (!form.time) errs.time = 'La hora es obligatoria'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setCreating(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        service_id: form.service_id ? Number(form.service_id) : null,
        notes: form.notes.trim() || null,
        date: form.date,
        time: form.time,
      }
      if (editing) {
        const res = await api<{ wa_sent?: boolean }>(`/staff/appointments/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        toast.success(res.wa_sent ? 'Cita actualizada (WhatsApp enviado al cliente)' : 'Cita actualizada')
      } else {
        await api('/staff/appointments/create', { method: 'POST', body: JSON.stringify(body) })
        toast.success('Cita creada y confirmada al cliente')
      }
      setEditing(null)
      setShowForm(false)
      await load(meta.current_page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar la cita')
    } finally {
      setCreating(false)
    }
  }

  async function change(id: number, newStatus: string) {
    try {
      const res = await api<{ wa_sent?: boolean }>(`/staff/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
      if (newStatus === 'confirmed') {
        toast.success(res.wa_sent ? 'Cita confirmada (WhatsApp enviado al cliente)' : 'Cita confirmada (cliente sin WhatsApp/config no activa)')
      } else {
        toast.success(`Cita ${statusLabel[newStatus] ?? newStatus}`)
      }
      await load(meta.current_page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar la cita')
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api(`/staff/appointments/${toDelete.id}`, { method: 'DELETE' })
      toast.success('Cita eliminada')
      setToDelete(null)
      await load(meta.current_page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar la cita')
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  async function assign(id: number, mechanicId: number | null) {
    try {
      await api(`/staff/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ mechanic_id: mechanicId }) })
      toast.success('Mecánico asignado')
      await load(meta.current_page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al asignar')
    }
  }

  async function confirmCancel() {
    if (!toCancel) return
    setCancelling(true)
    try {
      await api(`/staff/appointments/${toCancel.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) })
      toast.success('Cita cancelada')
      setToCancel(null)
      await load(meta.current_page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar')
      setToCancel(null)
    } finally {
      setCancelling(false)
    }
  }

  const counts = meta.counts
  const kpis: { label: string; value: number; icon: typeof Users; accent: string; tone?: string }[] = [
    { label: 'Pendientes', value: counts?.pending ?? 0, icon: Clock, accent: 'from-amber-500 to-orange-600' },
    { label: 'Confirmadas', value: counts?.confirmed ?? 0, icon: CalendarCheck, accent: 'from-emerald-500 to-emerald-700' },
    { label: 'Hechas', value: counts?.done ?? 0, icon: CheckCircle2, accent: 'from-brand-500 to-brand-700' },
    { label: 'Canceladas', value: counts?.cancelled ?? 0, icon: XCircle, accent: 'from-carbon-400 to-carbon-600' },
  ]

  const columns: Column<AppointmentRow>[] = [
    {
      key: 'name',
      header: 'Cliente',
      render: (a) => (
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${gradientFor(a.name)}`}>
            {a.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-carbon-950">{a.name}</p>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-carbon-500">
              {a.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3 text-carbon-400" />{a.email}</span>}
              {a.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-carbon-400" />{a.phone}</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Servicio',
      render: (a) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-carbon-600">
          <Wrench className="h-3.5 w-3.5 text-carbon-400" />
          {a.service_type || 'General'}
          {a.motorcycle ? <span className="text-brand-600"> · {a.motorcycle}</span> : null}
        </span>
      ),
    },
    {
      key: 'datetime',
      header: 'Fecha y hora',
      render: (a) => (
        <div>
          <p className="inline-flex items-center gap-1.5 font-bold text-carbon-950">
            <CalendarDays className="h-3.5 w-3.5 text-brand-500" />
            {new Date(a.date + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 pl-5 text-xs text-carbon-500">
            <Clock className="h-3 w-3 text-carbon-400" />
            {a.time} {a.day_name ? `· ${a.day_name}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'mechanic',
      header: 'Mecánico',
      render: (a) => (
        <Select
          value={a.mechanic_id ?? ''}
          onChange={(e) => assign(a.id, e.target.value ? Number(e.target.value) : null)}
          className="w-36"
        >
          <option value="">Sin asignar</option>
          {mechanics.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </Select>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (a) => <Badge tone={statusTone[a.status] ?? 'gray'}>{statusLabel[a.status] ?? a.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      render: (a) => (
        <div className="flex items-center justify-end gap-1.5">
          {a.status === 'pending' && (
            <button
              title="Confirmar cita"
              onClick={() => change(a.id, 'confirmed')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 text-emerald-600 transition hover:bg-emerald-50"
            >
              <CheckCircle2 className="h-[15px] w-[15px]" />
            </button>
          )}
          {a.status === 'confirmed' && (
            <button
              title="Marcar como hecha"
              onClick={() => change(a.id, 'done')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 text-brand-600 transition hover:bg-brand-50"
            >
              <CheckCircle2 className="h-[15px] w-[15px]" />
            </button>
          )}
          {a.status !== 'cancelled' && a.status !== 'done' && (
            <IconButton title="Cancelar cita" danger onClick={() => setToCancel(a)}>
              <XCircle className="h-[15px] w-[15px]" />
            </IconButton>
          )}
          <IconButton title="Editar cita" onClick={() => openEdit(a)}>
            <Pencil className="h-[15px] w-[15px]" />
          </IconButton>
          <IconButton title="Eliminar cita" danger onClick={() => setToDelete(a)}>
            <Trash2 className="h-[15px] w-[15px]" />
          </IconButton>
        </div>
      ),
    },
  ]

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'confirmed', label: 'Confirmadas' },
    { key: 'done', label: 'Hechas' },
    { key: 'cancelled', label: 'Canceladas' },
  ]

  return (
    <div className="mx-auto max-w-7xl anim-fade-up">
      <SectionHeader
        title="Citas"
        subtitle="Agenda, programa y confirma las citas del taller."
        variant="brand"
        action={
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97]"
          >
            <CalendarPlus className="h-4 w-4" />
            Nueva cita
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <Toolbar searchValue={query} onSearch={setQuery} searchPlaceholder="Buscar por nombre, correo o teléfono…" searchVariant="brand">
        {filters.map((f) => (
          <FilterPill key={f.key} active={status === f.key} variant="brand" onClick={() => setStatus(f.key)}>
            {f.label}{counts && counts[f.key] !== undefined && f.key !== 'all' ? ` (${counts[f.key]})` : ''}
          </FilterPill>
        ))}
      </Toolbar>

      <DataTable
        columns={columns}
        rows={appointments}
        page={meta.current_page}
        lastPage={meta.last_page}
        total={meta.total}
        onPage={load}
        emptyText="No hay citas con los filtros actuales."
        minWidth="min-w-[940px]"
        variant="brand"
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Editar cita' : 'Nueva cita'}
        subtitle={editing ? 'Actualiza los datos de la cita.' : 'El cliente recibirá confirmación por WhatsApp.'}
        size="lg"
        variant="brand"
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button type="submit" form="appointment-form" disabled={creating} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50">
              {creating ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear cita'}
            </button>
          </>
        }
      >
        <form id="appointment-form" onSubmit={createAppointment} className="space-y-5">
          <div className="flex items-center gap-2 rounded-xl bg-brand-50/60 px-3.5 py-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Users className="h-4 w-4" />
            </span>
            <p className="text-sm font-bold text-brand-800">Datos del cliente</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" error={errors.name} variant="brand">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan Pérez" variant="brand" />
            </Field>
            <Field label="Correo electrónico" error={errors.email} variant="brand">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cliente@mail.com" variant="brand" />
            </Field>
            <Field label="WhatsApp" hint="Para el aviso de confirmación" variant="brand">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="3012345678" variant="brand" />
            </Field>
            <Field label="Servicio" variant="brand">
              <Select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })} variant="brand">
                <option value="">General / sin servicio</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-brand-50/60 px-3.5 py-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
              <CalendarPlus className="h-4 w-4" />
            </span>
            <p className="text-sm font-bold text-brand-800">Fecha y hora</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fecha" error={errors.date} variant="brand">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} variant="brand" />
            </Field>
            <Field label="Hora" error={errors.time} variant="brand">
              <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} variant="brand" />
            </Field>
          </div>

          <Field label="Notas" variant="brand">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Detalles del servicio solicitado…" variant="brand" />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={confirmCancel}
        title="Cancelar cita"
        message={`¿Seguro que quieres cancelar la cita de "${toCancel?.name}"?`}
        loading={cancelling}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminar cita"
        message={`¿Seguro que quieres eliminar la cita de "${toDelete?.name}"? Esta acción no se puede deshacer.`}
        loading={deleting}
      />
    </div>
  )
}