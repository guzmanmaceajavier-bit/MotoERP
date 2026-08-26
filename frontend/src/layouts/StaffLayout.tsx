import { useEffect, useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useStaffAuth } from '../auth/StaffAuthContext'
import { apiStaff } from '../lib/api'
import { isStaffRole, roleLabel } from '../lib/roles'
import ThemeToggle from '../components/ThemeToggle'
import HeaderClock from '../components/HeaderClock'
import OpenStatusChip from '../components/OpenStatusChip'
import PageBreadcrumb from '../components/PageBreadcrumb'
import CookieConsent from '../components/CookieConsent'
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  Package,
  Users,
  CalendarClock,
  UserCog,
  Receipt,
  BarChart3,
  Wallet,
  ShoppingCart,
  Settings,
  Globe,
  Bell,
  User,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Menu,
  Tags,
  ShieldCheck,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles: string[]
  section: string | null
  end?: boolean
  activeOn?: string[]
}

function isActiveNav(n: NavItem, pathname: string) {
  if (n.activeOn?.includes(pathname)) return true
  if (n.end) return pathname === n.to
  return pathname === n.to || (n.to !== '/admin/dashboard' && pathname.startsWith(n.to))
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'], section: null, end: true },
  { to: '/admin/ordenes', label: 'Órdenes', icon: ClipboardList, roles: ['admin', 'receptionist', 'mechanic'], section: 'Operación' },
  { to: '/admin/agenda', label: 'Agenda', icon: CalendarDays, roles: ['admin'], section: 'Operación' },
  { to: '/admin/inventario', label: 'Inventario', icon: Package, roles: ['admin'], section: 'Operación' },
  {
    to: '/admin/catalogo',
    label: 'Catálogo',
    icon: Tags,
    roles: ['admin'],
    section: 'Operación',
    activeOn: ['/admin/categorias', '/admin/marcas', '/admin/servicios'],
  },
  { to: '/admin/clientes', label: 'Clientes', icon: Users, roles: ['admin', 'receptionist'], section: 'Clientes' },
  { to: '/admin/citas', label: 'Citas', icon: CalendarClock, roles: ['admin', 'receptionist'], section: 'Clientes' },
  { to: '/admin/ventas', label: 'Ventas', icon: Receipt, roles: ['admin'], section: 'Comercial' },
  { to: '/admin/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin'], section: 'Comercial' },
  { to: '/admin/caja', label: 'Caja', icon: Wallet, roles: ['admin', 'receptionist'], section: 'Comercial' },
  { to: '/admin/compras', label: 'Compras', icon: ShoppingCart, roles: ['admin'], section: 'Comercial' },
  { to: '/admin/garantias', label: 'Garantías', icon: ShieldCheck, roles: ['admin', 'receptionist'], section: 'Comercial' },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings, roles: ['admin'], section: 'Sistema' },
  { to: '/admin/equipo', label: 'Equipo', icon: UserCog, roles: ['admin'], section: 'Sistema' },
  { to: '/admin/auditoria', label: 'Auditoría', icon: ScrollText, roles: ['admin'], section: 'Sistema' },
  { to: '/admin/notificaciones', label: 'Notificaciones', icon: Bell, roles: ['admin', 'receptionist'], section: 'Sistema' },
]

export default function StaffLayout() {
  const { user, logout } = useStaffAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const location = useLocation()

  const confirmLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/admin/login', { replace: true })
    } finally {
      setLoggingOut(false)
      setLogoutOpen(false)
    }
  }

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/admin/dashboard')
  }

  useEffect(() => {
    setOpen(false)
    setProfileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const match = NAV_ITEMS.find((n) => isActiveNav(n, location.pathname))
    document.title = match ? `${match.label} · Portal Admin` : 'Portal Admin'
  }, [location.pathname])

  useEffect(() => {
    let alive = true
    async function loadUnread() {
      try {
        const res = await apiStaff<{ count: number }>('/notifications/unread-count')
        if (alive) setUnread(res.count)
      } catch {
        /* silencioso: el badge simplemente no se actualiza */
      }
    }
    loadUnread()
    const t = setInterval(loadUnread, 45000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [location.pathname])

  if (!user || !isStaffRole(user.role)) {
    return <Navigate to="/admin/login" replace />
  }

  const items = NAV_ITEMS.filter((n) => n.roles.includes(user.role))
  const sectionOrder = ['Operación', 'Clientes', 'Comercial', 'Sistema']
  const groupBySection: [string, typeof items][] = sectionOrder
    .map((s) => [s, items.filter((i) => i.section === s)] as [string, typeof items])
    .filter(([, arr]) => arr.length > 0)

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-3 rounded-lg text-sm font-bold transition-colors duration-150 ${
      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
    } ${
      isActive
        ? 'bg-brand-500/10 text-brand-600'
        : 'text-carbon-600 hover:bg-carbon-50 hover:text-brand-600'
    } ${isActive && !collapsed ? 'pl-2' : ''}`

  const activeIcon = (n: NavItem) => isActiveNav(n, location.pathname)
  const currentItem = items.find((n) => isActiveNav(n, location.pathname))

  const sidebar = (
    <div className="flex h-full flex-col border-r border-carbon-200 bg-white">
      <div className={`flex items-center justify-between pb-5 pt-6 ${collapsed ? 'flex-col gap-3 px-2' : 'px-5'}`}>
        <NavLink to="/admin/dashboard" onClick={() => setOpen(false)} className="whitespace-nowrap text-xl font-extrabold text-carbon-900">
          {collapsed ? <span className="text-brand-600">PA</span> : <>Portal<span className="text-brand-600">Admin</span></>}
        </NavLink>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="rounded-lg p-1.5 text-carbon-500 transition hover:bg-carbon-100 hover:text-carbon-800 lg:block"
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-label="Alternar menú lateral"
        >
          {collapsed ? <ChevronsRight className="h-[19px] w-[19px]" /> : <ChevronsLeft className="h-[19px] w-[19px]" />}
        </button>
      </div>
      <nav className={`flex-1 overflow-y-auto px-3 pb-4 ${collapsed ? 'space-y-2' : 'space-y-6'}`}>
        <div className={collapsed ? '' : 'space-y-1'}>
          {items
            .filter((n) => n.section === null)
            .map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => {
                  setOpen(false)
                  setProfileOpen(false)
                }}
                title={collapsed ? n.label : undefined}
                className={linkCls}
              >
                <span className={activeIcon(n) ? 'text-brand-600' : 'text-carbon-500'}><n.icon className="h-[19px] w-[19px]" /></span>
                {!collapsed && n.label}
              </NavLink>
            ))}
        </div>
        {groupBySection.map(([sectionName, sectionItems]) => (
          <div key={sectionName} className={collapsed ? '' : 'space-y-1'}>
            <p className={`pb-1.5 text-xs font-semibold tracking-wider text-carbon-400 ${collapsed ? 'pt-1 text-center text-[10px]' : 'px-0.5'}`}>
              {collapsed ? sectionName.charAt(0).toUpperCase() : sectionName.toUpperCase()}
            </p>
            {sectionItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => {
                  setOpen(false)
                  setProfileOpen(false)
                }}
                title={collapsed ? n.label : undefined}
                className={linkCls}
              >
                <span className={activeIcon(n) ? 'text-brand-600' : 'text-carbon-500'}><n.icon className="h-[19px] w-[19px]" /></span>
                {!collapsed && n.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-carbon-200 p-3">
        <div className={`relative rounded-xl border border-carbon-200 bg-carbon-50/70 ${collapsed ? 'flex justify-center p-1.5' : 'flex items-center gap-3 p-2'}`}>
          {profileOpen && !collapsed && (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-carbon-200 bg-white shadow-xl">
              <NavLink to="/admin/cuenta" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-carbon-700 hover:bg-carbon-50">
                <span className="text-carbon-500"><User className="h-4 w-4" /></span>
                Mi cuenta
              </NavLink>
              <div className="mx-3 my-1 h-px bg-carbon-100" />
              <NavLink to="/" target="_blank" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-carbon-700 hover:bg-carbon-50">
                <span className="text-carbon-500"><Globe className="h-4 w-4" /></span>
                Ver tienda pública
              </NavLink>
              <div className="mx-3 my-px h-px bg-carbon-100" />
              <button onClick={() => { setProfileOpen(false); setLogoutOpen(true) }} className="flex w-full items-center gap-2.5 px-3 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                  <LogOut className="h-4 w-4" />
                </span>
                <span className="flex-1 text-left">
                  <span className="block">Cerrar sesión</span>
                </span>
              </button>
            </div>
          )}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
            {(user?.name || 'S')[0]}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-carbon-900">{user.name}</p>
                <p className="truncate text-xs text-carbon-500">{roleLabel(user.role)}</p>
              </div>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="rounded-lg p-1.5 text-carbon-500 transition hover:bg-carbon-100 hover:text-carbon-800"
                aria-label="Menú de cuenta"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
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
              <Menu className="h-5 w-5" />
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
            <HeaderClock name={user.name} />
            <OpenStatusChip compact />
          </div>
          <div className="flex items-center gap-3">
            <NavLink
              to="/admin/notificaciones"
              className="relative rounded-lg p-2 text-carbon-600 transition hover:bg-carbon-100 hover:text-brand-600"
              title="Notificaciones"
              aria-label="Notificaciones"
            >
              <Bell className="h-[19px] w-[19px]" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </NavLink>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <PageBreadcrumb
            zone="admin"
            crumbs={[
              ...(currentItem?.section ? [{ label: currentItem.section }] : []),
              { label: currentItem?.label ?? 'Panel' },
            ]}
          />
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
                <LogOut className="h-[18px] w-[18px]" />
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