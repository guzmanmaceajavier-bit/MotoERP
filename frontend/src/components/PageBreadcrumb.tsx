import { Link } from 'react-router-dom'

const zones = {
  web: { label: 'Inicio', tone: 'from-brand-500 to-brand-700', home: '/' },
  cliente: { label: 'Portal Cliente', tone: 'from-brand-500 to-brand-700', home: '/panel' },
  admin: { label: 'Portal Admin', tone: 'from-carbon-700 to-slate-900', home: '/admin/dashboard' },
} as const

export interface BreadcrumbItem {
  label: string
  to?: string
}

/**
 * Indicador de ubicación para todo el sistema: muestra el inicio / área
 * (Portal Cliente / Portal Admin) y la ruta de página actual.
 */
export default function PageBreadcrumb({ zone, crumbs }: { zone: keyof typeof zones; crumbs: BreadcrumbItem[] }) {
  const z = zones[zone]

  return (
    <nav className="mx-auto flex w-full max-w-6xl items-center gap-2 overflow-x-auto whitespace-nowrap px-4 pb-1 pt-3 text-xs text-carbon-500 dark:text-carbon-400">
      <Link
        to={z.home}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r ${z.tone} px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:opacity-90`}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        {z.label}
      </Link>
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={i} className="flex shrink-0 items-center gap-2">
            <span className="text-carbon-300 dark:text-carbon-600">›</span>
            {c.to && !isLast ? (
              <Link to={c.to} className="font-medium transition hover:text-brand-600">
                {c.label}
              </Link>
            ) : (
              <span className={`font-semibold ${isLast ? 'text-brand-600' : 'text-carbon-800 dark:text-carbon-600'}`}>
                {c.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}