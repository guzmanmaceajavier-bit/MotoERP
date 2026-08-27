import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStaffAuth } from '../auth/StaffAuthContext'
import { isStaffRole } from '../lib/roles'
import { api } from '../lib/api'
import { useEffect } from 'react'
import { APP_NAME } from '../lib/config'

export default function AdminLogin() {
  const { login, logout } = useStaffAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [site, setSite] = useState<{ workshop_name?: string; workshop_logo?: string }>({})

  useEffect(() => {
    api<{ workshop_name?: string; workshop_logo?: string }>('/site-info').then(setSite).catch(() => {})
    logout()
  }, [])

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
    <div className="flex min-h-screen bg-white">
      {/* Panel izquierdo - marca */}
      <div className="relative hidden w-[45%] overflow-hidden lg:flex lg:flex-col lg:justify-between bg-gradient-to-br from-carbon-50 to-carbon-100 p-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 top-1/4 h-96 w-96 rotate-12 rounded-3xl bg-brand-500/10 blur-3xl" />
          <div className="absolute bottom-10 -left-10 h-64 w-64 rounded-full bg-brand-500/5 blur-2xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            {site.workshop_logo ? (
              <img src={site.workshop_logo} alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">MH</div>
            )}
            <div>
              <p className="text-lg font-extrabold text-carbon-900">{site.workshop_name || APP_NAME}</p>
              <p className="text-xs text-carbon-500">Taller y tienda de motos</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <h2 className="text-4xl font-black leading-tight text-carbon-900">
            Bienvenido<br />a <span className="text-brand-600">{site.workshop_name || APP_NAME}</span>
          </h2>
          <div className="mt-3 h-1 w-12 rounded-full bg-brand-600" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-carbon-500">
            Accede al panel de administración para gestionar órdenes, inventario, clientes y más.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              { icon: '📋', title: 'Gestión de órdenes', desc: 'Administra reparaciones y servicios en tiempo real.' },
              { icon: '📦', title: 'Inventario integrado', desc: 'Controla productos, precios y stock desde un solo lugar.' },
              { icon: '🔔', title: 'Notificaciones', desc: 'Alertas automáticas para ti y tus clientes.' },
            ].map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-base">{f.icon}</span>
                <div>
                  <p className="text-sm font-bold text-carbon-800">{f.title}</p>
                  <p className="text-xs text-carbon-500">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-xs text-carbon-400">
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            Conexión segura
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
            Acceso restringido
          </span>
        </div>
      </div>

      {/* Panel derecho - formulario */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          {/* Logo móvil */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            {site.workshop_logo ? (
              <img src={site.workshop_logo} alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">MH</div>
            )}
            <p className="text-lg font-extrabold text-carbon-900">{site.workshop_name || APP_NAME}</p>
          </div>

          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </div>

          <p className="mt-5 text-center text-xs font-bold uppercase tracking-wider text-brand-600">Inicia sesión</p>
          <h1 className="mt-1 text-center text-2xl font-black text-carbon-900">Acceso del equipo</h1>
          <p className="mt-1 text-center text-sm text-carbon-500">Ingresa tus datos para continuar</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {/* Email */}
            <div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-carbon-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Correo electrónico"
                  className="w-full rounded-xl border border-carbon-200 bg-carbon-50/50 py-3 pl-11 pr-4 text-sm text-carbon-900 placeholder:text-carbon-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-carbon-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Contraseña"
                  className="w-full rounded-xl border border-carbon-200 bg-carbon-50/50 py-3 pl-11 pr-11 text-sm text-carbon-900 placeholder:text-carbon-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-carbon-400 transition hover:text-carbon-600"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-carbon-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-carbon-300 text-brand-600 focus:ring-brand-500"
                />
                Recuérdame
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verificando...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
                  Entrar al panel
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-carbon-500 transition hover:text-brand-600">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Volver al sitio web
            </Link>
          </div>

          <p className="mt-8 border-t border-carbon-100 pt-5 text-center text-xs text-carbon-400">
            © {new Date().getFullYear()} {site.workshop_name || APP_NAME} · Acceso restringido al equipo del taller.
          </p>
        </div>
      </div>
    </div>
  )
}
