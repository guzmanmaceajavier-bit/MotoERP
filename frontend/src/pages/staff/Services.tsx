import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Trash2, Wrench } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { SectionHeader } from '../../components/ui'
import { Field, Input, Select, Textarea, Toggle, SearchInput } from '../../components/ui/form'
import { Modal, ConfirmDialog } from '../../components/ui/modal'
import { DataTable, type Column } from '../../components/ui/table'
import { gradientFor } from '../../lib/gradients'
import { BulkToggle, BulkNamesField, parseBulkNames } from '../../components/staff/BulkFields'

interface Category { id: number; name: string; icon?: string | null }
interface Service { id: number; name: string; price: number; category?: string | null; estimated_minutes?: number | null; description?: string | null; is_active?: boolean }

const PER_PAGE = 10

export default function Services() {
  const toast = useToast().toast
  const [items, setItems] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [confirm, setConfirm] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({ name: '', price: '', category: '', durationHours: '', durationMinutes: '', description: '', is_active: true })
  const [bulk, setBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')

  function minutesToFields(total?: number | null): { durationHours: string; durationMinutes: string } {
    const m = Number(total) || 0
    return { durationHours: String(Math.floor(m / 60)), durationMinutes: String(m % 60) }
  }

  const load = useCallback(async () => {
    const data = await api<Service[]>('/staff/catalog/services')
    setItems(data)
  }, [])

  useEffect(() => { load().catch(() => {}) }, [load])

  useEffect(() => { setPage(1) }, [search, statusFilter])

  useEffect(() => {
    api<Category[]>('/staff/catalog/categories').then(setCategories).catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    let list = items
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((s) => `${s.name} ${s.category ?? ''}`.toLowerCase().includes(q))
    if (statusFilter === 'active') list = list.filter((s) => s.is_active !== false)
    if (statusFilter === 'inactive') list = list.filter((s) => s.is_active === false)
    return list
  }, [items, search, statusFilter])

  const activeCount = items.filter((s) => s.is_active !== false).length
  const inactiveCount = items.length - activeCount

  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, lastPage)
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  const columns: Column<Service>[] = [
    {
      key: 'name',
      header: 'Servicio',
      render: (s) => (
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradientFor(s.name)} text-white`}>
            <Wrench className="h-4 w-4" />
          </span>
          <div>
            <p className="font-semibold text-carbon-950">{s.name}</p>
            <p className="text-xs text-carbon-400">{s.category || 'General'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Precio',
      render: (s) => <span className="font-bold text-brand-600">${s.price}</span>,
    },
    {
      key: 'time',
      header: 'Duración',
      render: (s) =>
        s.estimated_minutes ? (
          <span className="text-carbon-700">
            {s.estimated_minutes >= 60
              ? `${Math.floor(s.estimated_minutes / 60)} h${s.estimated_minutes % 60 ? ` ${s.estimated_minutes % 60} min` : ''}`
              : `${s.estimated_minutes} min`}
          </span>
        ) : (
          <span className="text-carbon-300">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (s) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-carbon-100 text-carbon-600'}`}>
          {s.is_active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => openEdit(s)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
          <button
            onClick={() => setConfirm(s)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Borrar
          </button>
        </div>
      ),
    },
  ]

  function openNew() {
    setEditing(null)
    setForm({ name: '', price: '', category: '', durationHours: '', durationMinutes: '', description: '', is_active: true })
    setBulk(false)
    setBulkText('')
    setOpen(true)
  }
  function openEdit(s: Service) {
    setEditing(s)
    setForm({
      name: s.name,
      price: String(s.price),
      category: s.category || '',
      ...minutesToFields(s.estimated_minutes),
      description: s.description || '',
      is_active: s.is_active !== false,
    })
    setOpen(true)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const base = {
        price: Number(form.price),
        category: form.category || null,
        estimated_minutes: (Number(form.durationHours) || 0) * 60 + (Number(form.durationMinutes) || 0) || null,
        description: form.description || null,
        is_active: form.is_active,
      }
      if (!editing && bulk) {
        const names = parseBulkNames(bulkText)
        if (!names.length) {
          toast.error('Escribe al menos un nombre')
          return
        }
        let created = 0
        const skipped: string[] = []
        for (const name of names) {
          try {
            await api('/staff/catalog/services', { method: 'POST', body: JSON.stringify({ name, ...base }) })
            created++
          } catch {
            skipped.push(name)
          }
        }
        setOpen(false)
        load()
        if (skipped.length) {
          toast.error(`${created} creado(s), ${skipped.length} omitido(s) por existir ya: ${skipped.join(', ')}`)
        } else {
          toast.success(`${created} servicios creados`)
        }
        return
      }
      const payload = {
        name: form.name,
        ...base,
      }
      if (editing) {
        await api(`/staff/catalog/services/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        toast.success('Servicio actualizado')
      } else {
        await api('/staff/catalog/services', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Servicio creado')
      }
      setOpen(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function removeConfirmed() {
    if (!confirm) return
    setDeleting(true)
    try {
      await api(`/staff/catalog/services/${confirm.id}`, { method: 'DELETE' })
      toast.success('Servicio eliminado')
      setConfirm(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        title="Servicios"
        subtitle="Tarifario de servicios del taller, usados al cotizar órdenes."
        variant="brand"
        action={
          <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97]">
            <Plus className="h-4 w-4" />
            Nuevo servicio
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-carbon-200 bg-white px-3 py-1.5 text-sm font-bold text-carbon-950">{items.length} · Total</span>
          <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-bold text-green-700">{activeCount} · Activos</span>
          <span className="rounded-full border border-carbon-200 bg-carbon-50 px-3 py-1.5 text-sm font-bold text-carbon-600">{inactiveCount} · Inactivos</span>
          {search.trim() && <span className="text-sm text-carbon-500">· {filtered.length} encontrados</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            variant="brand"
            className="w-auto"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </Select>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar servicios…" variant="brand" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-300 bg-white py-14 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Wrench className="h-7 w-7" />
          </span>
          <p className="mt-3 font-bold text-carbon-950">{search.trim() || statusFilter !== 'all' ? 'Sin coincidencias.' : 'Aún no hay servicios.'}</p>
          <p className="mt-1 text-sm text-carbon-500">
            {search.trim() || statusFilter !== 'all' ? 'Ajusta la búsqueda o el filtro de estado.' : 'Crea el primer servicio para poder cotizar órdenes.'}
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={paged}
          page={safePage}
          lastPage={lastPage}
          total={filtered.length}
          onPage={setPage}
          variant="brand"
          rowKey={(s) => s.id}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar servicio' : 'Nuevo servicio'}
        subtitle={editing ? editing.name : 'Se usará al cotizar una orden de trabajo.'}
        variant="brand"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button type="submit" form="service-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50">
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : bulk ? 'Crear todas' : 'Crear servicio'}
            </button>
          </>
        }
      >
        <form id="service-form" onSubmit={save} className="space-y-4">
          {!editing && (
            <div className="flex items-center justify-between gap-3">
              <BulkToggle bulk={bulk} onChange={setBulk} />
              {bulk && <p className="text-xs text-carbon-400">Un servicio por línea; el resto de datos se aplica a todos.</p>}
            </div>
          )}
          {(!bulk || editing) && (
            <Field label="Nombre del servicio *" variant="brand">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required variant="brand" placeholder="Ej. Cambio de aceite y filtro" />
            </Field>
          )}
          {bulk && !editing && <BulkNamesField value={bulkText} onChange={setBulkText} entity="servicio" />}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={bulk && !editing ? 'Precio * (se aplica a todos)' : 'Precio *'} variant="brand">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-carbon-400">$</span>
                <Input type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required variant="brand" className="pl-8" placeholder="0.00" />
              </div>
            </Field>
            <Field label="Categoría (opcional)" variant="brand">
              <Select value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} variant="brand">
                <option value="">General</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </Select>
              {categories.length === 0 && <p className="mt-1 text-xs text-carbon-400">Crea categorías para elegirlas aquí.</p>}
            </Field>
          </div>

          <Field label={bulk && !editing ? 'Tiempo estimado (se aplica a todos)' : 'Tiempo estimado'} variant="brand">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Input type="number" min={0} value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })} placeholder="0" variant="brand" className="pr-14" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-carbon-400">horas</span>
              </div>
              <div className="relative">
                <Input type="number" min={0} max={59} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} placeholder="0" variant="brand" className="pr-11" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-carbon-400">min</span>
              </div>
            </div>
          </Field>

          <Field label="Descripción" variant="brand">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} variant="brand" placeholder="Ej. Incluye mano de obra y lubricante." />
          </Field>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/40 px-4 py-3">
            <p className="text-sm font-semibold text-carbon-950">Servicio activo</p>
            <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
          </div>

          {(!bulk || editing) && (
            <Field label="Vista previa" variant="brand">
              <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-white p-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradientFor(form.name.trim() || 'servicio')} text-white shadow-md`}>
                <Wrench className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-carbon-950">{form.name.trim() || 'Nombre del servicio'}</p>
                <p className="text-xs text-carbon-500">
                  {form.category || 'General'}
                  {form.durationHours || form.durationMinutes ? ` · ${form.durationHours && Number(form.durationHours) > 0 ? `${form.durationHours} h ` : ''}${form.durationMinutes && Number(form.durationMinutes) > 0 ? `${form.durationMinutes} min` : ''}` : ''}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-base font-bold text-brand-600">${form.price || '0'}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${form.is_active ? 'bg-green-50 text-green-700' : 'bg-carbon-200 text-carbon-500'}`}>
                    {form.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>
          </Field>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={removeConfirmed}
        loading={deleting}
        title="Eliminar servicio"
        message={`¿Seguro que quieres eliminar "${confirm?.name ?? ''}"? Esta acción no se puede deshacer.`}
      />
    </div>
  )
}