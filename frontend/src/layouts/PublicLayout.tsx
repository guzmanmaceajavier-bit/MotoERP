import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCart } from '../lib/cart'
import { isStaffRole } from '../lib/roles'
import { useTheme } from '../lib/theme'
import WhatsAppFloat from '../components/WhatsAppFloat'
import SiteFooter from '../components/SiteFooter'
import { BackToTop } from '../components/BackToTop'
import CookieConsent from '../components/CookieConsent'
import CartDrawer from '../components/CartDrawer'
import { publicBreadcrumbs } from '../lib/pageMeta'
import { useSiteInfo } from '../lib/useSiteImages'
import { APP_NAME } from '../lib/config'
import { Logo } from '../components/Logo'

const links = [
  { to: '/', label: 'Inicio' },
  { to: '/servicios', label: 'Servicios' },
  { to: '/tienda', label: 'Tienda' },
  { to: '/blog', label: 'Blog' },
  { to: '/nosotros', label: 'Nosotros' },
  { to: '/contacto', label: 'Contacto' },
]

export default function PublicLayout() {
  const { user, loading } = useAuth()
  const { count, setDrawerOpen } = useCart()
  const { mode, setMode } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { workshop_name: siteName, workshop_logo: siteLogo } = useSiteInfo()

  useEffect(() => {
    const name = siteName || APP_NAME
    const label = (publicBreadcrumbs(location.pathname).slice(-1)[0]?.label ?? 'Inicio').trim()
    document.title = location.pathname === '/' ? name : `${label} · ${name}`
  }, [location.pathname, siteName])

  const close = () => setOpen(false)
  useEffect(() => {
    close()
    setSearchOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    const term = query.trim()
    setSearchOpen(false)
    if (term) navigate(`/tienda?search=${encodeURIComponent(term)}`)
    else navigate('/tienda')
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-carbon-50">
      <header className={`sticky top-0 z-20 border-b transition-all duration-300 ${scrolled ? 'border-carbon-200 bg-white/95 shadow-sm backdrop-blur-xl' : 'border-transparent bg-white'}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" onClick={() => setOpen(false)} className="rounded-xl transition hover:opacity-90">
            <Logo image={siteLogo} name={siteName} />
          </NavLink>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-carbon-700 lg:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `relative py-1.5 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded-full after:bg-brand-500 after:transition-transform after:duration-300 ${
                    isActive
                      ? 'text-brand-600 after:scale-x-100'
                      : 'text-carbon-700 hover:text-brand-600 after:scale-x-0 hover:after:scale-x-100'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            <NavLink to="/agendar" className="btn-primary btn-shine !px-5 !py-2.5">
              Agendar cita
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
            </NavLink>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="rounded-xl border border-carbon-300 p-2 text-carbon-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600"
              aria-label="Buscar"
              title="Buscar"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={() => setDrawerOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-carbon-300 text-carbon-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600"
              title="Carrito"
              aria-label="Carrito"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </button>
            {loading ? null : user ? (
              isStaffRole(user.role) ? (
                <NavLink
                  to="/admin"
                  className="btn-dark"
                >
                  Panel Admin
                </NavLink>
              ) : (
                <NavLink
                  to="/panel"
                  className="btn-dark"
                >
                  Mi Garaje
                </NavLink>
              )
            ) : (
              <NavLink
                to="/login"
                state={{ from: location.pathname }}
                className={({ isActive }) =>
                  `flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                    isActive
                      ? 'border-brand-500 bg-brand-50 text-brand-600'
                      : 'border-carbon-300 text-carbon-700 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600'
                  }`
                }
                title="Iniciar sesión"
                aria-label="Iniciar sesión"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </NavLink>
            )}
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg border border-carbon-300 p-2 text-carbon-700 hover:bg-carbon-100 lg:hidden"
              aria-label="Abrir menú"
            >
              {open ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
              )}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-carbon-200 bg-white px-4 py-2 md:hidden">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={close}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'text-brand-600' : 'text-carbon-700 hover:bg-carbon-50'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/agendar" onClick={close} className="btn-primary btn-shine mt-1 w-full">
              Agendar cita
            </NavLink>
            {user ? (
              <NavLink
                to={isStaffRole(user.role) ? '/admin' : '/panel'}
                onClick={close}
                className="btn-dark mt-1 w-full"
              >
                {isStaffRole(user.role) ? 'Panel Admin' : 'Mi Garaje'}
              </NavLink>
            ) : (
              <NavLink
                to="/login"
                state={{ from: location.pathname }}
                onClick={close}
                className="mt-1 block rounded-xl border border-carbon-300 px-3 py-2.5 text-center text-sm font-semibold text-carbon-700"
              >
                Iniciar sesión
              </NavLink>
            )}
          </nav>
        )}
        {searchOpen && (
          <div className="anim-fade-up border-t border-carbon-200 bg-white px-4 py-3 shadow-sm">
            <form onSubmit={submitSearch} className="mx-auto flex max-w-2xl gap-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar repuestos, accesorios en la tienda..."
                className="w-full rounded-xl border border-carbon-300 px-4 py-2.5 text-sm text-carbon-900 placeholder:text-carbon-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
              />
              <button type="submit" className="btn-primary btn-shine shrink-0">Buscar</button>
            </form>
          </div>
        )}
      </header>
      <main>
        <Outlet />
      </main>
      <BackToTop />
      <WhatsAppFloat />
      <CookieConsent />
      <button
        type="button"
        onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
        className="theme-float"
        aria-label="Cambiar tema"
        title={mode === 'dark' ? 'Modo oscuro (toca para claro)' : 'Modo claro (toca para oscuro)'}
      >
        {mode === 'dark' ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="4" />
            <path strokeLinecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M16.4 6.4l1.4-1.4" />
          </svg>
        )}
      </button>
      <CartDrawer />
      <SiteFooter />
    </div>
  )
}
