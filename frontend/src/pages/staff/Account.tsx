import { useState } from 'react'
import type { FormEvent } from 'react'
import { useStaffAuth } from '../../auth/StaffAuthContext'
import { useToast } from '../../lib/toast'

export default function Account() {
  const { user, updateProfile } = useStaffAuth()
  const toast = useToast().toast
  const [form, setForm] = useState(() => ({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  }))
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (password && password !== confirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    if (password && password.length < 8) {
      toast.error('La contraseña debe tener mínimo 8 caracteres')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, string> = { name: form.name, email: form.email, phone: form.phone }
      if (password) {
        payload.password = password
        payload.current_password = currentPassword
      }
      await updateProfile(payload)
      setPassword('')
      setConfirm('')
      setCurrentPassword('')
      toast.success('Cuenta actualizada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-carbon-900">Mi cuenta</h1>
      <p className="text-sm text-carbon-500">Actualiza tus datos de acceso al panel.</p>

      <form onSubmit={save} className="mt-4 space-y-4 rounded-2xl border border-carbon-200 bg-white p-5">
        <label className="block text-sm text-carbon-600">
          Nombre
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="garaje-input mt-1 block w-full" />
        </label>
        <label className="block text-sm text-carbon-600">
          Email
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="garaje-input mt-1 block w-full" />
        </label>
        <label className="block text-sm text-carbon-600">
          Teléfono
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="garaje-input mt-1 block w-full" />
        </label>

        <div className="border-t border-carbon-100 pt-4">
          <h2 className="font-semibold text-carbon-900">Cambiar contraseña</h2>
          <p className="text-xs text-carbon-400">Déjala en blanco para mantener la actual.</p>
          <label className="mt-3 block text-sm text-carbon-600">
            Contraseña actual
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" className="garaje-input mt-1 block w-full" />
          </label>
          <label className="mt-3 block text-sm text-carbon-600">
            Nueva contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="garaje-input mt-1 block w-full" />
          </label>
          <label className="mt-3 block text-sm text-carbon-600">
            Confirmar nueva contraseña
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="garaje-input mt-1 block w-full" />
          </label>
        </div>

        <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}