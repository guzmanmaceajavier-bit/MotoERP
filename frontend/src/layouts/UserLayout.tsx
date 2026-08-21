import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api, getToken } from '../lib/api'
import { useCart } from '../lib/cart'
import ThemeToggle from '../components/ThemeToggle'
import HeaderClock from '../components/HeaderClock'
import OpenStatusChip from '../components/OpenStatusChip'
import PageBreadcrumb from '../components/PageBreadcrumb'
import { CookieConsent } from '../components/CookieConsent'

const links = [
  { to: '/panel', label: 'Dashboard', section: null, icon: 'M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m14 0H8m14 0a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 012-2m14 0V9H8v4' },
  { to: '/panel/garaje', label: 'Mi Garaje', section: 'Mis vehículos', icon: 'M5 16l3.5-6.5a2 2 0 011.8-1H16l2 4.5H20a1 1 0 011 1V16H5z' },
  { to: '/panel/servicios', label: 'Mis Servicios', section: 'Mis vehículos', icon: 'M3 13l2-1 2 1m0 0l2-2 2 2m-4 0V6m0 4l2-1m-2 1V6m6 4l2-1m-2 1v4m0 0l2-1m-2 1v2' },
  { to: '/panel/historial', label: 'Historial', section: 'Mis vehículos', icon: 'M4 6h16M4 12h16M4 18h16' },
  { to: '/panel/tienda', label: 'Tienda', section: 'Compras', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17' },
  { to: '/panel/pedidos', label: 'Mis Pedidos', section: 'Compras', icon: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0' },
  { to: '/panel/favoritos', label: 'Favoritos', section: 'Compras', icon: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' },
  { to: '/panel/mi-cuenta', label: 'Mis Finanzas', section: 'Mi cuenta', icon: 'M4 6h16M4 12h16M4 18h16' },
  { to: '/panel/chat', label: 'Chat con el taller', section: 'Mi cuenta', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  { to: '/panel/configuracion', label: 'Configuración', section: 'Mi cuenta', icon: 'M10.3 4.3a1 1 0 011.4 0l.7.7a1 1 0 001.4 0l.7-.7a1 1 0 011.4 0l1.2 1.2a1 1 0 010 1.4l-.7.7a1 1 0 000 1.4l.7.7a1 1 0 010 1.4l-1.2 1.2a1 1 0 01-1.4 0l-.7-.7a1 1 0 00-1.4 0l-.7.7a1 1 0 01-1.4 0l-1.2-1.2a1 1 0 010-1.4l.7-.7a1 1 0 000-1.4l-.7-.7a1 1 0 010-1.4zM9 12a3 3 0 106 0 3 3 0 00-6 0z' },
]

const sections = [
  { key: 'vehiculos', label: 'Mis vehículos', paths: ['/panel/garaje', '/panel/servicios', '/panel/historial'] },
  { key: 'compras', label: 'Compras', paths: ['/panel/tienda', '/panel/pedidos', '/panel/favoritos'] },
  { key: 'cuenta', label: 'Mi cuenta', paths: ['/panel/configuracion', '/panel/mi-cuenta', '/panel/chat'] },
]

const EXTRA_PAGE_LABELS: Record<string, string> = {
  '/panel/carrito': 'Carrito',
  '/panel/notificaciones': 'Notificaciones',
}

const icon = (d: string) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

export default function UserLayout() {
  const { user, logout } = useAuth()
  const { count } = useCart()
  const [unread, setUnread] = useState(0)
  const [chatUnread, setChatUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const loggingOutRef = useRef(false)
    const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setOpen(false)
    setProfileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const label = links.find((l) => l.to !== '/panel' && location.pathname.startsWith(l.to))?.label
    document.title = label ? `${label} · Portal Cliente` : 'Portal Cliente'
  }, [location.pathname])

  useEffect(() => {
    let alive = true
    const tick = async () => {
      if (document.visibilityState !== 'visible' || !getToken() || loggingOutRef.current) return
      try {
        const r = await api<{ count: number }>('/notifications/unread-count')
        if (alive) setUnread(r.count)
      } catch {
        /* ignore */
      }
    }
    const tickChat = async () => {
      if (document.visibilityState !== 'visible' || !getToken() || loggingOutRef.current) return
      try {
        const r = await api<{ count: number }>('/chat/unread-count')
        if (alive) setChatUnread(r.count)
      } catch {
        /* ignore */
      }
    }
    ;(async () => { await tickChat() })()
    tick()
    const id = setInterval(() => { tick(); tickChat() }, 15000)
    function onVisible() {
      if (document.visibilityState === 'visible') { tick(); tickChat() }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const isActive = (to: string) =>
    to === '/panel' ? location.pathname === '/panel' : location.pathname.startsWith(to)

  const linkCls = ({ isActive: active }: { isActive: boolean }) =>
    `relative flex items-center gap-3 rounded-lg text-sm font-bold transition-colors duration-150 ${
      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
    } ${
      active
        ? 'bg-brand-500/10 font-extrabold text-brand-600'
        : 'text-carbon-700 hover:bg-carbon-50 hover:text-brand-600'
    } ${active && !collapsed ? 'pl-2' : ''}`

  const dashboard = links.find((l) => l.to === '/panel')!
  const grouped = sections.map((s) => ({
    ...s,
    items: links.filter((l) => s.paths.includes(l.to)),
  }))

  const activeLink = links.find((l) => isActive(l.to))
  const crumbs: { label: string; to?: string }[] = (activeLink?.section
    ? [{ label: activeLink.section }, { label: activeLink.label }]
    : [{ label: activeLink?.label ?? EXTRA_PAGE_LABELS[location.pathname] ?? 'Panel' }]).filter((c) => c.label)

  const confirmLogout = async () => {
    loggingOutRef.current = true
    setLoggingOut(true)
    try {
      await logout()
      navigate('/', { replace: true })
    } finally {
      setLoggingOut(false)
      setLogoutOpen(false)
    }
  }

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/panel')
  }

  const sidebar = (
    <div className="flex h-full flex-col border-r border-carbon-200 bg-white">
      <div className={`flex items-center justify-between pb-5 pt-6 ${collapsed ? 'flex-col gap-3 px-2' : 'px-5'}`}>
        <NavLink to="/panel" className="flex items-center gap-2.5 whitespace-nowrap" title="Portal Cliente">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-600/20">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 16l3.5-6.5a2 2 0 011.8-1H16l2 4.5H20a1 1 0 011 1V16H5z" />
              <circle cx="8.5" cy="16" r="1.5" />
              <circle cx="16.5" cy="16" r="1.5" />
            </svg>
          </span>
          {!collapsed && (
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-extrabold tracking-tight text-carbon-900">Portal</span>
              <span className="text-sm font-extrabold tracking-tight text-brand-600">Cliente</span>
            </span>
          )}
        </NavLink>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="rounded-lg p-1.5 text-carbon-500 transition hover:bg-carbon-100 hover:text-carbon-800 lg:block"
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-label="Alternar menú lateral"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <path d="M13 17l5-5-5-5M6 17l5-5-5-5" /> : <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />}
          </svg>
        </button>
      </div>
      <nav className={`flex-1 overflow-y-auto px-3 pb-4 ${collapsed ? 'space-y-2' : 'space-y-6'}`}>
        <div className={collapsed ? '' : 'space-y-1'}>
          <NavLink to={dashboard.to} end onClick={() => setOpen(false)} title={collapsed ? dashboard.label : undefined} className={linkCls}>
            <span className={isActive(dashboard.to) ? 'text-brand-600' : 'text-carbon-500'}>{icon(dashboard.icon)}</span>
            {!collapsed && dashboard.label}
          </NavLink>
        </div>
        {grouped.map((g) => (
          <div key={g.key} className={collapsed ? '' : 'space-y-1'}>
            <p className={`pb-1.5 text-xs font-semibold tracking-wider text-carbon-400 ${collapsed ? 'pt-1 text-center text-[10px]' : 'px-0.5'}`}>
              {collapsed ? g.label.charAt(0).toUpperCase() : g.label.toUpperCase()}
            </p>
            {g.items.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} title={collapsed ? l.label : undefined} className={linkCls}>
                <span className={isActive(l.to) ? 'text-brand-600' : 'text-carbon-500'}>{icon(l.icon)}</span>
                {!collapsed && l.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-carbon-200 p-3">
        <div className={`relative rounded-xl border border-carbon-200 bg-carbon-50/70 ${collapsed ? 'flex justify-center p-1.5' : 'flex items-center gap-3 p-2'}`}>
          {profileOpen && !collapsed && (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-carbon-200 bg-white shadow-xl">
              <button onClick={() => { setProfileOpen(false); setLogoutOpen(true) }} className="flex w-full items-center gap-2.5 px-3 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500">
                  {icon('M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9')}
                </span>
                <span className="flex-1 text-left">
                  <span className="block">Cerrar sesión</span>
                </span>
              </button>
            </div>
          )}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
            {user?.photo ? (
              <img src={user.photo} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              (user?.name || 'U')[0]
            )}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-carbon-900">{user?.name}</p>
                <p className="truncate text-xs text-carbon-500">Portal del cliente</p>
              </div>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="rounded-lg p-1.5 text-carbon-500 transition hover:bg-carbon-100 hover:text-carbon-800"
                aria-label="Menú de cuenta"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${profileOpen ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-carbon-50">
      <aside className={`relative z-20 hidden shrink-0 lg:block ${collapsed ? 'w-[76px]' : 'w-64'} transition-[width] duration-200`}>
        <div className="sticky top-0 z-20 h-screen">{sidebar}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-carbon-200 bg-white px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg border border-carbon-300 p-2 text-carbon-700 hover:bg-carbon-100 lg:hidden"
              aria-label="Abrir menú"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
            <button
              onClick={goBack}
              title="Volver atrás"
              aria-label="Volver atrás"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-carbon-300 px-2 text-xs font-semibold text-carbon-600 transition hover:bg-carbon-100 hover:text-brand-600"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              <span className="hidden sm:inline">Volver</span>
            </button>
            <HeaderClock name={user?.name} />
            <OpenStatusChip compact />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NavLink to="/panel/carrito" className="relative p-2 text-carbon-600 hover:text-brand-600" title="Carrito">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{count}</span>
              )}
            </NavLink>
            <NavLink to="/panel/notificaciones" className="relative p-2 text-carbon-600 hover:text-brand-600" title="Notificaciones">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread}</span>
              )}
            </NavLink>
            <NavLink to="/panel/chat" className="relative p-2 text-carbon-600 hover:text-brand-600" title="Chat con el taller">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              {chatUnread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{chatUnread}</span>
              )}
            </NavLink>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <PageBreadcrumb zone="cliente" crumbs={crumbs} />
          <Outlet />
        </main>
      </div>

      <CookieConsent />

      {logoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { if (!loggingOut) setLogoutOpen(false) }} />
          <div className="anim-pop relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-carbon-900">¿Seguro que quieres cerrar sesión?</h3>
              </div>
            </div>
            <div className="mt-6 flex gap-2.5">
              <button
                onClick={() => setLogoutOpen(false)}
                disabled={loggingOut}
                className="flex-1 rounded-xl border border-carbon-300 bg-white px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-carbon-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmLogout}
                disabled={loggingOut}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}