import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../lib/theme'
import { useToast } from '../lib/toast'
import { api, setToken } from '../lib/api'
import { SectionHeader } from '../components/ui'
import { Field, Input } from '../components/ui/form'

type Tab = 'cuenta' | 'seguridad' | 'preferencias'

const roleLabels: Record<string, string> = {
  customer: 'Cliente',
  admin: 'Administrador',
  receptionist: 'Recepcionista',
  mechanic: 'Mecánico',
}

export default function PortalSettings() {
  const { user, logout, refreshUser } = useAuth()
  const toast = useToast().toast
  const { mode, setMode } = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<Tab>('cuenta')

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdError, setPwdError] = useState('')

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setEmail(user.email)
    setPhone(user.phone ?? '')
  }, [user])

  async function save() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'El nombre es obligatorio'
    if (!email.trim() || !/.+@.+\..+/.test(email)) e.email = 'Ingresa un correo válido'
    if (!phone.trim()) e.phone = 'El teléfono es obligatorio'
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    setError('')
    try {
      await api('/user', { method: 'PATCH', body: JSON.stringify({ name, email, phone }) })
      await refreshUser()
      toast.success('Datos actualizados')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

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
      await api('/user/photo', { method: 'POST', body })
      await refreshUser()
      toast.success('Foto actualizada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir la foto')
    } finally {
      setUploading(false)
    }
  }

  async function changePassword() {
    if (password.length < 8) {
      setPwdError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setPwdError('Las contraseñas no coinciden.')
      return
    }
    setSavingPwd(true)
    setPwdError('')
    try {
      const res = await api<{ token: string }>('/user', {
        method: 'PATCH',
        body: JSON.stringify({ current_password: current, password }),
      })
      if (res.token) setToken(res.token)
      setCurrent('')
      setPassword('')
      setConfirm('')
      toast.success('Contraseña actualizada')
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Error al cambiar la contraseña')
    } finally {
      setSavingPwd(false)
    }
  }

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="mx-auto max-w-4xl anim-fade-up">
      <SectionHeader title="Configuración" subtitle="Tu perfil, seguridad y preferencias del portal en un solo lugar." />

      <div className="overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-sm dark:border-carbon-200 dark:bg-carbon-100">
        <div className="flex flex-col items-center gap-4 px-6 py-6 sm:flex-row">
          <div className="relative shrink-0">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-bold text-white shadow-md">
              {user?.photo ? <img src={user.photo} alt={user.name} className="h-full w-full object-cover" /> : initials}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Cambiar foto"
              aria-label="Cambiar foto"
              className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-md ring-2 ring-white transition hover:bg-brand-700 disabled:opacity-50 dark:ring-carbon-100"
            >
              {uploading ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
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
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <h2 className="truncate text-lg font-bold text-carbon-900 dark:text-carbon-700">{user?.name}</h2>
            <p className="truncate text-sm text-carbon-500">{user?.email}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">
                {roleLabels[user?.role ?? 'customer'] ?? user?.role}
              </span>
              {user?.created_at && (
                <span className="chip bg-carbon-100 text-carbon-600 dark:bg-carbon-200 dark:text-carbon-600">
                  Miembro desde {new Date(user.created_at).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-md items-center gap-1 rounded-2xl border border-carbon-200 bg-white p-1.5 shadow-sm dark:border-carbon-200 dark:bg-carbon-100">
        {([
          ['cuenta', 'Cuenta'],
          ['seguridad', 'Seguridad'],
          ['preferencias', 'Preferencias'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
              tab === key
                ? 'bg-brand-600 text-white shadow'
                : 'text-carbon-500 hover:bg-carbon-100 hover:text-carbon-800 dark:hover:bg-carbon-200 dark:hover:text-carbon-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cuenta' && (
        <div className="mt-6 rounded-2xl border border-carbon-200 bg-white p-6 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
              <UserIcon />
            </span>
            <div>
              <h3 className="font-bold text-carbon-900 dark:text-carbon-700">Información personal</h3>
              <p className="mt-1 text-sm text-carbon-500">Mantén tus datos al día para recibir notificaciones y facturas.</p>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </div>
          )}
          <div className="mt-5 space-y-4">
            <Field label="Nombre" error={errors.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Correo electrónico" error={errors.email}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Teléfono" hint="Ej. 3012345678" error={errors.phone}>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="3012345678" />
            </Field>
            <div className="flex items-center justify-end border-t border-carbon-100 pt-4 dark:border-carbon-200">
              <button onClick={save} disabled={saving} className="btn-primary !text-sm">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'seguridad' && (
        <div className="mt-6 rounded-2xl border border-carbon-200 bg-white p-6 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
              <LockIcon />
            </span>
            <div>
              <h3 className="font-bold text-carbon-900 dark:text-carbon-700">Cambiar contraseña</h3>
              <p className="mt-1 text-sm text-carbon-500">
                Usa al menos 8 caracteres. Al cambiarla, tu sesión se renueva automáticamente.
              </p>
            </div>
          </div>
          {pwdError && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {pwdError}
            </div>
          )}
          <div className="mt-5 space-y-4">
            <Field label="Contraseña actual">
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nueva contraseña">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </Field>
              <Field label="Confirmar nueva contraseña">
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              </Field>
            </div>
            <div className="flex items-center justify-end border-t border-carbon-100 pt-4 dark:border-carbon-200">
              <button onClick={changePassword} disabled={savingPwd} className="btn-primary !text-sm">
                {savingPwd ? 'Actualizando…' : 'Actualizar contraseña'}
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-red-200 bg-red-50/60 p-5 dark:border-red-500/30 dark:bg-red-500/10">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                <LogoutIcon />
              </span>
              <div>
                <h4 className="font-semibold text-red-700 dark:text-red-400">Cerrar sesión</h4>
                <p className="mt-0.5 text-sm text-carbon-500">
                  Finaliza tu sesión en este dispositivo. Volverás a la página de inicio de sesión.
                </p>
                <button
                  onClick={() => logout()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-500/40 dark:bg-carbon-100 dark:hover:bg-red-500/20"
                >
                  Cerrar sesión ahora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'preferencias' && (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-carbon-200 bg-white p-6 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                <PaletteIcon />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-carbon-900 dark:text-carbon-700">Apariencia</h3>
                <p className="mt-1 text-sm text-carbon-500">Elige cómo se ve tu portal.</p>
              </div>
              <span className="chip shrink-0 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">
                {mode === 'light' ? 'Claro' : 'Oscuro'}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => setMode('light')}
                className={`rounded-xl border p-4 text-left transition ${
                  mode === 'light' ? 'border-brand-500 bg-brand-50' : 'border-carbon-200 bg-white hover:border-brand-300 dark:border-carbon-200 dark:bg-carbon-100'
                }`}
              >
                <SunIcon />
                <p className="mt-2 text-sm font-semibold text-carbon-800 dark:text-carbon-700">Modo claro</p>
                <p className="text-xs text-carbon-400">Fondo claro y alto contraste</p>
              </button>
              <button
                onClick={() => setMode('dark')}
                className={`rounded-xl border p-4 text-left transition ${
                  mode === 'dark' ? 'border-brand-500 bg-brand-50' : 'border-carbon-200 bg-white hover:border-brand-300 dark:border-carbon-200 dark:bg-carbon-100'
                }`}
              >
                <MoonIcon />
                <p className="mt-2 text-sm font-semibold text-carbon-800 dark:text-carbon-700">Modo oscuro</p>
                <p className="text-xs text-carbon-400">Ideal para noches y menos brillo</p>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-carbon-200 bg-white p-6 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                <BellIcon />
              </span>
              <div>
                <h3 className="font-bold text-carbon-900 dark:text-carbon-700">Notificaciones</h3>
                <p className="mt-1 text-sm text-carbon-500">
                  Recibe avisos de servicios, cotizaciones, pedidos y promociones. Adminístralas desde tu bandeja.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9" />
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22a10 10 0 110-20 7 7 0 010 14h-1.5a2 2 0 00-1.5 3.3A1.7 1.7 0 0012 22z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" />
      <circle cx="16.5" cy="10.5" r="1" fill="currentColor" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500">
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
    </svg>
  )
}