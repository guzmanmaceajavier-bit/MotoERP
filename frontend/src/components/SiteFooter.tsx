import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { scheduleSummary, type ScheduleInfo } from '../lib/schedule'
import { Logo } from './Logo'
import { APP_NAME } from '../lib/config'

const quickLinks = [
  { to: '/', label: 'Inicio' },
  { to: '/servicios', label: 'Servicios' },
  { to: '/tienda', label: 'Tienda' },
  { to: '/blog', label: 'Blog' },
  { to: '/nosotros', label: 'Nosotros' },
  { to: '/contacto', label: 'Contacto' },
]

const usefulLinks = [
  { to: '/agendar', label: 'Agendar cita' },
  { to: '/consultar', label: 'Consultar orden' },
  { to: '/carrito', label: 'Carrito de compras' },
  { to: '/login', label: 'Iniciar sesión' },
  { to: '/registro', label: 'Crear cuenta' },
]

interface FooterInfo extends ScheduleInfo {
  workshop_phone?: string
  workshop_address?: string
  workshop_name?: string
  workshop_logo?: string
  workshop_email?: string
  social_facebook?: string
  social_instagram?: string
  social_tiktok?: string
}

export default function SiteFooter() {
  const [info, setInfo] = useState<FooterInfo>({})

  useEffect(() => {
    api<FooterInfo>('/site-info').then(setInfo).catch(() => {})
  }, [])

  const {
    workshop_phone: phone = '',
    workshop_address: address = '',
    workshop_name: siteName = APP_NAME,
    workshop_logo: siteLogo = '',
    social_facebook: fb,
    social_instagram: ig,
    social_tiktok: tiktok,
  } = info

  const summary = scheduleSummary(info)

  const scheduleRows: { day: string; hours: string; strong?: boolean }[] = []
  if (summary) {
    scheduleRows.push({ day: 'Lunes a viernes', hours: `${summary.weekday.open} - ${summary.weekday.close}`, strong: true })
    const hasOpenHolidays = (info.holidays ?? []).some(
      (h) => h.mode === 'saturday' || h.mode === 'custom' || h.open || h.close,
    )
    if (summary.saturday || hasOpenHolidays) {
      const satLabel = summary.saturday ? 'Sábados y festivos' : 'Festivos'
      const satHours = summary.saturday ? `${summary.saturday.open} - ${summary.saturday.close}` : 'Horario especial'
      scheduleRows.push({ day: satLabel, hours: satHours })
    } else if ((info.holidays ?? []).length > 0) {
      scheduleRows.push({ day: 'Festivos', hours: 'Cerrado' })
    }
  }

  const socials = [
    { href: fb, label: 'Facebook', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0022 12z" /></svg> },
    { href: ig, label: 'Instagram', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg> },
    { href: tiktok, label: 'TikTok', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" /></svg> },
  ].filter((s) => s.href)

  return (
    <footer className="relative border-t border-carbon-800 bg-carbon-950 text-carbon-300">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-flex">
              <Logo light image={siteLogo} name={siteName} />
            </Link>
            <p className="text-sm leading-relaxed text-carbon-400">
              Taller de motocicletas con hoja de vida digital, repuestos y servicio técnico especializado.
            </p>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Síguenos</h3>
              <div className="mt-3 flex gap-3">
                {socials.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} className="flex h-9 w-9 items-center justify-center rounded-lg bg-carbon-800 text-carbon-300 ring-1 ring-carbon-700 transition hover:bg-brand-600 hover:text-white hover:ring-brand-600">
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Navegación */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Navegación</h3>
            <ul className="mt-4 space-y-2.5">
              {quickLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-carbon-400 transition hover:text-brand-500">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Utilidades */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Utilidades</h3>
            <ul className="mt-4 space-y-2.5">
              {usefulLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-carbon-400 transition hover:text-brand-500">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto + horario */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Contacto</h3>
            <ul className="mt-4 space-y-3 text-sm text-carbon-400">
              {address && (
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  <span>{address}</span>
                </li>
              )}
              {phone && (
                <li className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></svg>
                  <a href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-brand-500">{phone}</a>
                </li>
              )}
              {scheduleRows.length > 0 && (
                <li>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-carbon-500">
                    <svg className="h-4 w-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                    Horario
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {scheduleRows.map((r) => (
                      <div key={r.day} className="flex items-center justify-between gap-3">
                        <span className="text-carbon-400">{r.day}</span>
                        <span className={r.strong ? 'font-semibold text-white' : 'text-carbon-300'}>{r.hours}</span>
                      </div>
                    ))}
                  </div>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 border-t border-carbon-800 pt-6 text-center text-sm text-carbon-500">
          <p>&copy; {new Date().getFullYear()} {siteName} · Todos los derechos reservados</p>
          <div className="flex items-center justify-center gap-6">
            <Link to="/privacidad" className="transition hover:text-brand-500">Política de privacidad</Link>
            <Link to="/terminos" className="transition hover:text-brand-500">Términos y condiciones</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}