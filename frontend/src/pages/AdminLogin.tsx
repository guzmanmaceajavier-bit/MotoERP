import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStaffAuth } from '../auth/StaffAuthContext'
import { isStaffRole } from '../lib/roles'
import { AuthInput, AuthShell, AuthSubmit } from '../components/AuthShell'

export default function AdminLogin() {
  const { login, user } = useStaffAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user && isStaffRole(user.role)) {
      navigate('/admin/dashboard', { replace: true })
    }
  }, [user, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const logged = await login(email, password)
      if (!isStaffRole(logged.role)) {
        setError('Este panel es exclusivo para el equipo del taller.')
        setSubmitting(false)
        return
      }
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Acceso del equipo"
      subtitle="Solo personal autorizado del taller."
      badge="Panel de administración"
      dark
    >
      <div className="anim-fade-up mb-5 flex items-center gap-2.5 rounded-xl border border-carbon-700 bg-carbon-950/60 px-4 py-3 text-xs text-carbon-400">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </span>
        Conexión protegida · Tus datos viajan cifrados
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput label="Correo electrónico" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="tucorreo@taller.com" dark />
        <AuthInput label="Contraseña" type="password" value={password} onChange={setPassword} autoComplete="current-password" placeholder="••••••••" dark />
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}
        <AuthSubmit submitting={submitting}>{submitting ? 'Verificando acceso...' : 'Entrar al panel'}</AuthSubmit>
      </form>

      <div className="mt-6 space-y-3 border-t border-carbon-800 pt-5">
        <p className="text-center text-xs text-carbon-500">
          ¿Perdiste tu acceso? Contacta al administrador del sistema.
        </p>
        <Link
          to="/"
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-brand-400 transition hover:text-brand-300"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver al sitio web
        </Link>
      </div>
    </AuthShell>
  )
}