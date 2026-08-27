import { useEffect, useState, type ReactNode } from 'react'
import { Logo } from './Logo'
import { api } from '../lib/api'
import { APP_NAME } from '../lib/config'

interface AuthShellProps {
  title: string
  subtitle: string
  badge?: string
  dark?: boolean
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({ title, subtitle, badge, dark = false, children, footer }: AuthShellProps) {
  const [site, setSite] = useState<{ workshop_name?: string; workshop_logo?: string }>({})
  useEffect(() => {
    api<{ workshop_name?: string; workshop_logo?: string }>('/site-info').then(setSite).catch(() => {})
  }, [])

  if (dark) {
    return (
      <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden bg-carbon-950 px-4 py-16">
        <div className="pointer-events-none absolute inset-0 opacity-15 [background-image:radial-gradient(circle_at_12%_18%,#ea580c_0,transparent_42%),radial-gradient(circle_at_88%_82%,#ea580c_0,transparent_40%),radial-gradient(circle_at_80%_10%,#60a5fa_0,transparent_30%)]" />
        <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-carbon-800 bg-carbon-900/90 shadow-2xl backdrop-blur lg:grid-cols-[1fr_1.1fr]">
          {/* Panel de marca */}
          <div className="relative hidden flex-col justify-between bg-gradient-to-br from-brand-600 via-brand-700 to-carbon-900 p-8 lg:flex">
            <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0,transparent_35%),radial-gradient(circle_at_85%_80%,rgba(255,255,255,0.25)_0,transparent_30%)]" />
            <div className="relative">
              <Logo light size={34} name={site.workshop_name} image={site.workshop_logo} />
              <p className="mt-6 text-2xl font-black leading-tight text-white">El taller que cuida tu moto de punta a punta.</p>
              <p className="mt-3 max-w-xs text-sm text-white/75">
                Administra órdenes, agenda, inventario, ventas y clientes desde un solo panel.
              </p>
            </div>
            <ul className="relative space-y-3">
              {['Órdenes y reparaciones en tiempo real', 'Inventario y caja integrados', 'Notificaciones automáticas al cliente'].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-white/85">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Formulario */}
          <div className="relative p-8 sm:p-10">
            <div className="lg:hidden">
              <Logo light name={site.workshop_name} image={site.workshop_logo} />
            </div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-brand-400 lg:mt-0">{title}</p>
            <h1 className="mt-1 text-2xl font-black text-white">{badge ?? 'Inicia sesión'}</h1>
            <p className="mt-1 text-sm text-carbon-400">{subtitle}</p>
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-6">{footer}</div>}
            <p className="mt-8 border-t border-carbon-800 pt-4 text-xs text-carbon-500">© {new Date().getFullYear()} {site.workshop_name || APP_NAME} · Acceso restringido al equipo del taller.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-carbon-50 px-4 py-16">
      <div className="anim-fade-up w-full max-w-md rounded-2xl border border-carbon-200 bg-white p-8 shadow-lg">
        <div className="flex items-center gap-2">
          <Logo name={site.workshop_name} image={site.workshop_logo} />
          {badge && (
            <span className="ml-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{badge}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-carbon-500">{subtitle}</p>
        <div className="mt-6">{children}</div>
        {footer}
      </div>
    </div>
  )
}

export function AuthInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  dark = false,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  dark?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  return (
    <div>
      <label className={`mb-1 block text-sm font-medium ${dark ? 'text-carbon-300' : 'text-carbon-700'}`}>{label}</label>
      <div className="relative">
        <input
          type={isPassword && visible ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={
            dark
              ? 'w-full rounded-xl border border-carbon-700 bg-carbon-950 px-3.5 py-2.5 text-white placeholder:text-carbon-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30'
              : 'garaje-input w-full'
          }
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 transition hover:bg-black/5 ${dark ? 'text-carbon-400 hover:text-white' : 'text-carbon-400 hover:text-carbon-700'}`}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {visible ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export function AuthSubmit({ children, submitting }: { children: ReactNode; submitting: boolean }) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
