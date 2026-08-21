import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { UserPlus, Pencil, Trash2, Users, Wrench, Phone, ShieldCheck, KeyRound, IdCard, FileText, Camera } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import type { Paginated } from '../../lib/pagination'
import type { StaffUser } from '../../lib/types'
import { useToast } from '../../lib/toast'
import { SectionHeader, Badge } from '../../components/ui'
import { Toolbar, FilterPill } from '../../components/ui/toolbar'
import { Modal, ConfirmDialog } from '../../components/ui/modal'
import { Field, Input, Select, Textarea } from '../../components/ui/form'
import { gradientFor } from '../../lib/gradients'

type Counts = Record<string, number>
type Role = 'admin' | 'receptionist' | 'mechanic'

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  receptionist: 'Recepcionista',
  mechanic: 'Mecánico',
}

const roleTone: Record<string, string> = {
  admin: 'brand',
  receptionist: 'blue',
  mechanic: 'green',
}

export default function Team() {
  const toast = useToast().toast
  const [team, setTeam] = useState<StaffUser[]>([])
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number; counts?: Counts }>({
    current_page: 1,
    last_page: 1,
    total: 0,
  })
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<'all' | Role>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StaffUser | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'mechanic', password: '', specialty: '', bio: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toDelete, setToDelete] = useState<StaffUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(
    async (p = 1) => {
      const params = new URLSearchParams({ page: String(p) })
      if (query.trim()) params.set('search', query.trim())
      if (role !== 'all') params.set('role', role)
      const res = await api<Paginated<StaffUser>>(`/staff/staff?${params.toString()}`)
      setTeam(res.data)
      setMeta({
        current_page: res.meta.current_page,
        last_page: res.meta.last_page,
        total: res.meta.total,
        counts: res.meta.counts,
      })
    },
    [query, role],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      load(1).catch(() => toast.error('No se pudo cargar el equipo'))
    }, 300)
    return () => clearTimeout(t)
  }, [load, toast])

  function pickPhoto(file: File | null) {
    setPhoto(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : null)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'El nombre es obligatorio'
    if (!form.email.trim() || !/.+@.+\..+/.test(form.email)) errs.email = 'Correo inválido'
    if (!editing && form.password.length < 8) errs.password = 'La contraseña debe tener al menos 8 caracteres'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      let id: number | null = editing?.id ?? null
      if (editing) {
        await api(`/staff/staff/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || null,
            role: form.role,
            specialty: form.specialty.trim() || null,
            bio: form.bio.trim() || null,
          }),
        })
        toast.success('Integrante actualizado')
      } else {
        const created = await api<{ id: number }>('/staff/staff', {
          method: 'POST',
          body: JSON.stringify({ ...form, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, specialty: form.specialty.trim() || null, bio: form.bio.trim() || null }),
        })
        id = created?.id ?? null
        toast.success('Integrante agregado al equipo')
      }
      if (id && photo) {
        const fd = new FormData()
        fd.append('photo', photo)
        await api(`/staff/staff/${id}/photo`, { method: 'POST', body: fd }).catch(() => toast.error('La foto no se pudo subir'))
      }
      setShowForm(false)
      setEditing(null)
      setPhoto(null)
      setPhotoPreview(null)
      setForm({ name: '', email: '', phone: '', role: 'mechanic', password: '', specialty: '', bio: '' })
      await load(meta.current_page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api(`/staff/staff/${toDelete.id}`, { method: 'DELETE' })
      toast.success('Integrante eliminado')
      setToDelete(null)
      await load(meta.current_page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  function startEdit(m: StaffUser) {
    setEditing(m)
    setForm({ name: m.name, email: m.email, phone: m.phone ?? '', role: m.role, password: '', specialty: m.specialty ?? '', bio: m.bio ?? '' })
    setPhoto(null)
    setPhotoPreview(null)
    setErrors({})
    setShowForm(true)
  }

  function startNew() {
    setEditing(null)
    setForm({ name: '', email: '', phone: '', role: 'mechanic', password: '', specialty: '', bio: '' })
    setPhoto(null)
    setPhotoPreview(null)
    setErrors({})
    setShowForm(true)
  }

  const counts = meta.counts
  const kpis: { label: string; value: number; icon: typeof Users; accent: string; role?: Role }[] = [
    { label: 'Integrantes', value: counts?.all ?? 0, icon: Users, accent: 'from-brand-500 to-brand-700' },
    { label: 'Mecánicos', value: counts?.mechanic ?? 0, icon: Wrench, accent: 'from-emerald-500 to-emerald-700', role: 'mechanic' },
    { label: 'Recepcionistas', value: counts?.receptionist ?? 0, icon: Phone, accent: 'from-indigo-500 to-indigo-700', role: 'receptionist' },
    { label: 'Administradores', value: counts?.admin ?? 0, icon: ShieldCheck, accent: 'from-carbon-400 to-carbon-600', role: 'admin' },
  ]

  return (
    <div className="mx-auto max-w-7xl anim-fade-up">
      <SectionHeader
        title="Equipo"
        subtitle="Los integrantes del taller, su rol y especialidad."
        variant="brand"
        action={
          <button
            onClick={startNew}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97]"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo integrante
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => {
              setRole(k.role ?? 'all')
              setQuery('')
            }}
            className="flex items-center gap-4 rounded-2xl border border-brand-200 bg-white p-4 text-left transition hover:border-brand-400 hover:shadow-sm"
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${k.accent} text-white`}>
              <k.icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-2xl font-extrabold text-carbon-950">{k.value.toLocaleString('es-CO')}</p>
              <p className="text-sm text-carbon-500">{k.label}</p>
            </div>
          </button>
        ))}
      </div>

      <Toolbar
        searchValue={query}
        onSearch={setQuery}
        searchPlaceholder="Buscar por nombre, correo, teléfono o especialidad…"
        searchVariant="brand"
      >
        <FilterPill active={role === 'all'} variant="brand" onClick={() => setRole('all')}>
          Todos
        </FilterPill>
        <FilterPill active={role === 'mechanic'} variant="brand" onClick={() => setRole('mechanic')}>
          Mecánicos
        </FilterPill>
        <FilterPill active={role === 'receptionist'} variant="brand" onClick={() => setRole('receptionist')}>
          Recepcionistas
        </FilterPill>
        <FilterPill active={role === 'admin'} variant="brand" onClick={() => setRole('admin')}>
          Administradores
        </FilterPill>
      </Toolbar>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {team.map((m) => (
          <div key={m.id} className="group flex flex-col overflow-hidden rounded-2xl border border-brand-200 bg-white transition hover:shadow-lg hover:shadow-brand-200/40">
            <div className="flex h-24 items-center justify-center border-b border-brand-100 bg-gradient-to-br from-brand-50 to-brand-100/40">
              {m.photo ? (
                <img src={m.photo} alt={m.name} className="h-16 w-16 rounded-2xl object-cover shadow-md ring-4 ring-white" />
              ) : (
                <span className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl font-extrabold text-white shadow-md ring-4 ring-white ${gradientFor(m.name)}`}>
                  {(m.name || 'E').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-carbon-950">{m.name}</p>
                  <p className="truncate text-xs text-carbon-500">{m.email}</p>
                </div>
                <Badge tone={roleTone[m.role] ?? 'gray'} className="shrink-0 text-xs">{roleLabel[m.role] ?? m.role}</Badge>
              </div>
              {m.specialty && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-carbon-600">
                  <Wrench className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                  {m.specialty}
                </p>
              )}
              {m.bio && <p className="mt-2 line-clamp-2 text-xs text-carbon-500">{m.bio}</p>}
              {m.phone && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-carbon-400">
                  <Phone className="h-3 w-3" />
                  {m.phone}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between border-t border-brand-100 pt-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-carbon-400">Miembro del equipo</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => startEdit(m)}
                    title="Editar integrante"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 text-carbon-600 transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    <Pencil className="h-[15px] w-[15px]" />
                  </button>
                  <button
                    onClick={() => setToDelete(m)}
                    title="Eliminar integrante"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-[15px] w-[15px]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {team.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-brand-300 bg-white py-12 text-center text-sm text-carbon-400">
            Sin integrantes con los filtros actuales.
          </div>
        )}
      </div>

      {meta.last_page > 1 && (
        <div className="mt-4 flex justify-center">
          <div className="inline-flex items-center gap-1 overflow-hidden rounded-xl border border-brand-300 bg-white">
            {Array.from({ length: meta.last_page }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => load(p)}
                className={`px-3.5 py-2 text-sm font-semibold transition ${p === meta.current_page ? 'bg-brand-600 text-white' : 'text-carbon-600 hover:bg-brand-50'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Editar integrante' : 'Nuevo integrante'}
        subtitle={editing ? 'Actualiza los datos del miembro del equipo.' : 'Agrega un nuevo miembro al equipo del taller.'}
        size="lg"
        variant="brand"
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button type="submit" form="team-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50">
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar al equipo'}
            </button>
          </>
        }
      >
        <form id="team-form" onSubmit={save} className="space-y-5">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div className="relative">
              {photoPreview || (editing && editing.photo) ? (
                <img
                  src={photoPreview ?? (editing?.photo as string)}
                  alt="Foto de perfil"
                  className="h-24 w-24 rounded-2xl object-cover shadow"
                />
              ) : (
                <span className={`flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl font-extrabold text-white shadow ${gradientFor(form.name || 'equipo')}`}>
                  {(form.name || 'E').charAt(0).toUpperCase()}
                </span>
              )}
              <label
                htmlFor="staff-photo"
                title="Subir foto"
                className="absolute -bottom-2 -right-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-brand-600 text-white shadow ring-2 ring-white transition hover:bg-brand-700"
              >
                <Camera className="h-4 w-4" />
              </label>
              <input id="staff-photo" type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0] || null)} />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="font-bold text-carbon-950">{form.name || 'Nombre del integrante'}</p>
              <p className="text-sm text-carbon-500">{form.specialty || 'Especialidad'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-brand-50/60 px-3.5 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <IdCard className="h-4 w-4" />
              </span>
              <p className="text-sm font-bold text-brand-800">Datos personales</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre completo" error={errors.name} variant="brand">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan Pérez" variant="brand" />
              </Field>
              <Field label="Correo electrónico" error={errors.email} variant="brand">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="integrantes@motohub.com" variant="brand" />
              </Field>
              <Field label="Teléfono" variant="brand">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="3012345678" variant="brand" />
              </Field>
              <Field label="Rol en el taller" variant="brand">
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} variant="brand">
                  <option value="mechanic">Mecánico</option>
                  <option value="receptionist">Recepcionista</option>
                  <option value="admin">Administrador</option>
                </Select>
              </Field>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-brand-50/60 px-3.5 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <KeyRound className="h-4 w-4" />
              </span>
              <p className="text-sm font-bold text-brand-800">Acceso al panel</p>
            </div>
            <Field label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña'} error={errors.password} variant="brand">
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" variant="brand" />
            </Field>
            <p className="border-t border-brand-100 pt-4" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-brand-50/60 px-3.5 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
                <FileText className="h-4 w-4" />
              </span>
              <p className="text-sm font-bold text-brand-800">Perfil profesional</p>
            </div>
            <Field label="Especialidad" hint="Visible para el cliente (ej. Motor a inyección)" variant="brand">
              <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Ej. Motor a inyección" variant="brand" />
            </Field>
            <Field label="Biografía corta" variant="brand">
              <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} placeholder="Experiencia, años de servicio, certificaciones…" variant="brand" />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminar integrante"
        message={`¿Seguro que quieres eliminar a "${toDelete?.name}" del equipo?`}
        loading={deleting}
      />
    </div>
  )
}