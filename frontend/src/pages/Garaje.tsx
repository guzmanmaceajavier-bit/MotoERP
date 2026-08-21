import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { EmptyState, SectionHeader } from '../components/ui'
import { Modal, ConfirmDialog } from '../components/ui/modal'
import { Field, Input, Select, Textarea, FormRow } from '../components/ui/form'
import NewServiceRequestModal from '../components/NewServiceRequestModal'
import type { Brand, Motorcycle, MotorcycleModel } from '../lib/types'
import { RowSkeleton } from '../components/Skeletons'

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=600&fit=crop'

export default function Garaje() {
  const toast = useToast().toast
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [models, setModels] = useState<MotorcycleModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    nickname: '', plate: '', brandId: '', modelId: '', year: '', color: '', odometer: '', vin: '', accessories: '', documentation: '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toDelete, setToDelete] = useState<Motorcycle | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState('')

  const [reqOpen, setReqOpen] = useState(false)
  const [reqMotoId, setReqMotoId] = useState<number | null>(null)

  const loadMotorcycles = useCallback(async () => {
    const data = await api<Motorcycle[]>('/motorcycles')
    setMotorcycles(data)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const [motos, marcas] = await Promise.all([
          api<Motorcycle[]>('/motorcycles'),
          api<Brand[]>('/brands'),
        ])
        setMotorcycles(motos)
        setBrands(marcas)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar')
      } finally {
        setLoading(false)
      }
    })()
  }, [loadMotorcycles])

  async function handleBrandChange(value: string) {
    setForm((f) => ({ ...f, brandId: value, modelId: '' }))
    setModels([])
    if (!value) return
    const data = await api<MotorcycleModel[]>(`/brands/${value}/models`)
    setModels(data)
  }

  function startNew() {
    setEditingId(null)
    setForm({ nickname: '', plate: '', brandId: '', modelId: '', year: '', color: '', odometer: '0', vin: '', accessories: '', documentation: '' })
    setErrors({})
    setFormOpen(true)
  }

  function startEdit(m: Motorcycle) {
    setEditingId(m.id)
    setForm({
      nickname: m.nickname ?? '',
      plate: m.plate ?? '',
      brandId: m.brand?.id ? String(m.brand.id) : '',
      modelId: m.model?.id ? String(m.model.id) : '',
      year: m.year ? String(m.year) : '',
      color: m.color ?? '',
      odometer: String(m.current_odometer),
      vin: m.vin ?? '',
      accessories: (m.accessories ?? []).join(', '),
      documentation: m.documentation ?? '',
    })
    setErrors({})
    setModels([])
    setFormOpen(true)
  }

  async function saveMoto() {
    const e: Record<string, string> = {}
    if (!form.plate.trim()) e.plate = 'La placa es obligatoria'
    if (!e.plate && !/^[A-Za-z0-9-]{4,10}$/.test(form.plate.trim())) e.plate = 'Placa inválida (ej. ABC12D)'
    if (!form.brandId) e.brandId = 'Selecciona una marca'
    if (!form.year || Number(form.year) < 1900) e.year = 'Año inválido'
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    try {
      const payload = {
        nickname: form.nickname || null,
        plate: form.plate.toUpperCase() || null,
        brand_id: form.brandId ? Number(form.brandId) : null,
        motorcycle_model_id: form.modelId ? Number(form.modelId) : null,
        year: form.year ? Number(form.year) : null,
        color: form.color || null,
        vin: form.vin || null,
        current_odometer: form.odometer ? Number(form.odometer) : 0,
        accessories: form.accessories ? form.accessories.split(',').map((s) => s.trim()).filter(Boolean) : [],
        documentation: form.documentation || null,
      }
      if (editingId) {
        await api(`/motorcycles/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success('Moto actualizada')
      } else {
        await api('/motorcycles', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Moto registrada')
      }
      setFormOpen(false)
      setEditingId(null)
      await loadMotorcycles()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function deleteMoto() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api(`/motorcycles/${toDelete.id}`, { method: 'DELETE' })
      toast.success('Moto eliminada')
      setToDelete(null)
      await loadMotorcycles()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  function openRequest(m: Motorcycle) {
    setReqMotoId(m.id)
    setReqOpen(true)
  }

  async function onRequestCreated(_orderNumber: string) {
    toast.success('Nueva orden de servicio creada')
    await loadMotorcycles()
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <RowSkeleton cols={4} rows={3} />
      </div>
    )
  }
  if (error) return <div className="p-8 text-red-600">{error}</div>

  const q = query.trim().toLowerCase()
  const visible = q
    ? motorcycles.filter((m) =>
        [m.nickname, m.plate, m.brand?.name, m.model?.name, m.color]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    : motorcycles

  return (
    <div className="mx-auto max-w-7xl anim-fade-up">
      <SectionHeader
        title="Mi Garaje"
        subtitle="Tus motos y su hoja de vida digital: servicios, garantías, facturas y mantenimientos."
        action={
          <button onClick={startNew} className="btn-primary !text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Agregar moto
          </button>
        }
      />

      {motorcycles.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-carbon-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por placa, marca o apodo…"
              className="w-full rounded-xl border border-carbon-300 bg-white py-2.5 pl-10 pr-4 text-sm text-carbon-800 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-carbon-200 dark:bg-carbon-100 dark:text-carbon-700"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">
              <MotoMiniInner />
              {visible.length} {visible.length === 1 ? 'moto' : 'motos'}
            </span>
          </div>
        </div>
      )}

      {motorcycles.length === 0 ? (
        <EmptyState
          icon={<MotoPlaceholder />}
          title="Aún no tienes motocicletas"
          subtitle="Agrega tu primera moto para empezar su hoja de vida digital: servicios, garantías, facturas y mantenimientos."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<SearchIcon />}
          title="Sin resultados"
          subtitle={`No encontramos motos con "${query}". Prueba con otra placa, marca o apodo.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {visible.map((m) => (
            <MotoCard
              key={m.id}
              moto={m}
              onEdit={() => startEdit(m)}
              onDelete={() => setToDelete(m)}
              onRequestService={() => openRequest(m)}
              onChanged={() => loadMotorcycles()}
            />
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Editar motocicleta' : 'Registrar motocicleta'}
        subtitle={editingId ? 'Actualiza los datos de tu moto.' : 'Completa los datos para registrar tu nueva moto.'}
        size="lg"
        footer={
          <>
            <button onClick={() => setFormOpen(false)} className="btn-ghost !text-sm">Cancelar</button>
            <button onClick={saveMoto} disabled={saving} className="btn-primary !text-sm">{saving ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <FormRow>
            <Field label="Apodo / nombre" hint="Opcional">
              <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="Ej: Mi Pulsar" />
            </Field>
            <Field label="Placa" hint="Ej. ABC12D" error={errors.plate}>
              <Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="ABC12D" className="uppercase" />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Marca" error={errors.brandId}>
              <Select value={form.brandId} onChange={(e) => handleBrandChange(e.target.value)}>
                <option value="">Selecciona marca</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Modelo">
              <Select value={form.modelId} onChange={(e) => setForm({ ...form, modelId: e.target.value })} disabled={!form.brandId}>
                <option value="">Selecciona modelo</option>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Año" error={errors.year}>
              <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2024" />
            </Field>
            <Field label="Color">
              <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Negro, rojo…" />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="VIN" hint="Número de chasis, opcional">
              <Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} placeholder="Número de chasis" />
            </Field>
            <Field label="Kilometraje actual">
              <Input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} />
            </Field>
          </FormRow>
          <Field label="Accesorios instalados" hint="Separados por coma">
            <Input value={form.accessories} onChange={(e) => setForm({ ...form, accessories: e.target.value })} placeholder="Parabrisas, maletero, cargador USB" />
          </Field>
          <Field label="Documentación" hint="SOAT, tecnomecánica, seguro…">
            <Textarea value={form.documentation} onChange={(e) => setForm({ ...form, documentation: e.target.value })} rows={2} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={deleteMoto}
        title="Eliminar motocicleta"
        message={`¿Seguro que quieres eliminar "${toDelete?.nickname || toDelete?.plate || 'esta moto'}"? Se perderá toda su hoja de vida.`}
        loading={deleting}
      />

      <NewServiceRequestModal
        open={reqOpen}
        initialMotoId={reqMotoId}
        onClose={() => setReqOpen(false)}
        onCreated={onRequestCreated}
      />
    </div>
  )
}

function MotoCard({
  moto,
  onEdit,
  onDelete,
  onRequestService,
  onChanged,
}: {
  moto: Motorcycle
  onEdit: () => void
  onDelete: () => void
  onRequestService: () => void
  onChanged: () => void
}) {
  const toast = useToast().toast
  const fileRef = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const m = moto
  const brandName = m.brand?.name || 'Marca'
  const modelName = m.model?.name || ''
  const title = m.nickname || `${brandName}${modelName ? ' ' + modelName : ''}`.trim() || 'Moto sin nombre'

  const registered = m.registered_at
    ? new Date(m.registered_at + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  async function uploadPhoto(file: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen')
      return
    }
    setUploading(true)
    try {
      const body = new FormData()
      body.append('photo', file)
      await api(`/motorcycles/${m.id}/photo`, { method: 'POST', body })
      toast.success('Foto de la moto actualizada')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir la foto')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-sm transition-shadow hover:shadow-xl hover:shadow-carbon-200/60 dark:bg-carbon-100 dark:border-carbon-200">
      {/* Hero photo */}
      <div className="relative h-60 overflow-hidden bg-carbon-100 md:h-64">
        <img
          src={m.photo || PLACEHOLDER_IMG}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Subir foto de la moto"
          aria-label="Subir foto de la moto"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/30 backdrop-blur-sm transition hover:bg-brand-600 hover:ring-brand-600 disabled:opacity-60"
        >
          {uploading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <CameraIcon />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) uploadPhoto(f)
            e.target.value = ''
          }}
        />
        <Link
          to={`/panel/garaje/${m.id}`}
          title="Hoja de vida"
          aria-label="Hoja de vida"
          className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white shadow-lg ring-1 ring-white/30 backdrop-blur-sm transition hover:bg-brand-600 hover:ring-brand-600"
        >
          <BookIcon small />
          Hoja de vida
        </Link>
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold text-white drop-shadow">{title}</h2>
            <p className="truncate text-sm font-medium text-white/80">
              {brandName}{modelName ? ` · ${modelName}` : ''}{m.year ? ` · ${m.year}` : ''}
            </p>
            {registered && <p className="mt-0.5 text-xs text-white/60">Desde {registered}</p>}
          </div>
          {m.plate && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/25 bg-white/15 px-2.5 py-1.5 text-xs font-bold tracking-wider text-white backdrop-blur-sm">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 20a2 2 0 100-4 2 2 0 000 4zM18 20a2 2 0 100-4 2 2 0 000 4zM2 8h13l4 8" /></svg>
              {m.plate}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <div className="rounded-xl border border-carbon-200 bg-carbon-50/60 dark:border-carbon-200 dark:bg-carbon-200/30">
          <p className="border-b border-carbon-200 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-carbon-400 dark:border-carbon-200">
            Ficha técnica
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 sm:grid-cols-3">
            <Spec label="Color" value={m.color || '—'} />
            <Spec label="Año" value={m.year ? String(m.year) : '—'} />
            <Spec label="Kilometraje" value={`${m.current_odometer.toLocaleString('es-CO')} km`} />
            <Spec label="VIN / Chasis" value={m.vin || '—'} mono />
            <Spec label="Estado" value="Activa" />
            <Spec label="Modelo" value={modelName || '—'} />
          </div>
        </div>

        {m.accessories && m.accessories.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {m.accessories.slice(0, 4).map((a, idx) => (
              <span key={idx} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{a}</span>
            ))}
            {m.accessories.length > 4 && (
              <span className="rounded-lg bg-carbon-100 px-2.5 py-1 text-xs font-medium text-carbon-500 dark:bg-carbon-200">+{m.accessories.length - 4}</span>
            )}
          </div>
        )}

      {m.documentation && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 inline-flex items-center gap-1 self-start text-xs font-semibold text-carbon-500 transition hover:text-brand-600"
          >
            <DocIcon />
            {expanded ? 'Ocultar' : 'Ver'} documentación
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
        {expanded && m.documentation && (
          <div className="mt-2 rounded-xl bg-carbon-50 p-4 text-sm whitespace-pre-line text-carbon-600 dark:bg-carbon-200/40 dark:text-carbon-500">
            {m.documentation}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex items-center gap-2 border-t border-carbon-100 px-5 py-4 dark:border-carbon-200">
          <button onClick={onRequestService} className="btn-primary !text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Nueva orden
          </button>
          <button onClick={onEdit} title="Editar" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-carbon-300 text-carbon-700 transition hover:bg-carbon-50 dark:border-carbon-300 dark:text-carbon-500 dark:hover:bg-carbon-200">
            <EditMini />
          </button>
          <button onClick={onDelete} title="Eliminar" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-red-400/30 dark:hover:bg-red-500/10">
            <TrashMini />
          </button>
          <Link
            to={`/panel/garaje/${m.id}`}
            className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            Hoja de vida
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14m-6-6l6 6-6 6" /></svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

function Spec({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-carbon-400">{label}</p>
      <p className={`mt-0.5 truncate font-semibold text-carbon-900 dark:text-carbon-700 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</p>
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h8l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" />
      <path d="M14 2v4h4M9 13h6M9 17h4" />
    </svg>
  )
}

function EditMini() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
  )
}

function TrashMini() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /></svg>
  )
}

function MotoMiniInner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 16l3.5-6.5a2 2 0 011.8-1H16l2 4.5H20a1 1 0 011 1V16H5z" />
      <circle cx="8.5" cy="16" r="1.5" />
      <circle cx="16.5" cy="16" r="1.5" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-carbon-400">
      <path d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
    </svg>
  )
}

function BookIcon({ small }: { small?: boolean }) {
  return (
    <svg width={small ? 13 : 17} height={small ? 13 : 17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  )
}

function MotoPlaceholder() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-carbon-400">
      <path d="M5 16l3.5-6.5a2 2 0 011.8-1H16l2 4.5H20a1 1 0 011 1V16H5z" />
      <circle cx="8.5" cy="16" r="1.5" />
      <circle cx="16.5" cy="16" r="1.5" />
    </svg>
  )
}