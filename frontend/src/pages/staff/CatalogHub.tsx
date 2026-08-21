import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, Building2, Wrench, Package, ArrowRight, type LucideIcon } from 'lucide-react'
import { apiStaff } from '../../lib/api'

interface HubCard {
  to: string
  title: string
  description: string
  icon: LucideIcon
  hint: string
  endpoints: string[]
  accent: string
}

const CARDS: HubCard[] = [
  {
    to: '/admin/categorias',
    title: 'Categorías',
    description: 'Agrupa los productos y servicios de la tienda para mantener el catálogo ordenado.',
    icon: LayoutGrid,
    hint: 'categorías',
    endpoints: ['/staff/catalog/categories'],
    accent: 'from-brand-500 to-brand-700',
  },
  {
    to: '/admin/marcas',
    title: 'Marcas y Modelos',
    description: 'Fabricantes de motocicletas y sus modelos, necesarios en órdenes y detalle de productos.',
    icon: Building2,
    hint: 'registros',
    endpoints: ['/staff/catalog/brands', '/staff/catalog/models'],
    accent: 'from-indigo-500 to-indigo-700',
  },
  {
    to: '/admin/servicios',
    title: 'Servicios',
    description: 'El tarifario del taller: nombres, precios y tiempo de cada servicio para cotizar órdenes.',
    icon: Wrench,
    hint: 'servicios',
    endpoints: ['/staff/catalog/services'],
    accent: 'from-emerald-500 to-emerald-700',
  },
]

export default function CatalogHub() {
  const [counts, setCounts] = useState<Record<string, number | null>>({})

  useEffect(() => {
    let alive = true

    function loadCount(key: string, endpoints: string[]) {
      Promise.all(
        endpoints.map((ep) =>
          apiStaff<unknown[]>(ep)
            .then((d) => (Array.isArray(d) ? d.length : 0))
            .catch(() => 0),
        ),
      ).then((nums) => {
        if (alive) setCounts((m) => ({ ...m, [key]: nums.reduce((a, b) => a + b, 0) }))
      })
    }

    CARDS.forEach((c) => loadCount(c.title, c.endpoints))
    apiStaff<{ meta?: { counts?: { all?: number } } }>('/staff/inventory')
      .then((res) => {
        if (alive) setCounts((m) => ({ ...m, Productos: res?.meta?.counts?.all ?? 0 }))
      })
      .catch(() => {})

    return () => {
      alive = false
    }
  }, [])

  const kpis: { label: string; value: number | null; icon: LucideIcon; accent: string }[] = [
    { label: 'Categorías', value: counts['Categorías'] ?? null, icon: LayoutGrid, accent: 'from-brand-500 to-brand-700' },
    { label: 'Marcas y Modelos', value: counts['Marcas y Modelos'] ?? null, icon: Building2, accent: 'from-indigo-500 to-indigo-700' },
    { label: 'Servicios', value: counts['Servicios'] ?? null, icon: Wrench, accent: 'from-emerald-500 to-emerald-700' },
    { label: 'Productos', value: counts['Productos'] ?? null, icon: Package, accent: 'from-amber-500 to-orange-700' },
  ]

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-carbon-950">Catálogo</h1>
          <p className="text-sm text-carbon-500">Gestiona los datos de apoyo del negocio.</p>
        </div>
        <Link to="/admin/inventario" className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
          Ver inventario →
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-carbon-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-carbon-500">{k.label}</p>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${k.accent} text-white`}>
                <k.icon className="h-[18px] w-[18px]" />
              </span>
            </div>
            <p className="mt-2 text-3xl font-extrabold text-carbon-950">{k.value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 mb-3 flex items-center gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-carbon-500">Secciones</h2>
        <div className="h-px flex-1 bg-carbon-200" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.title}
            to={c.to}
            className="group relative overflow-hidden rounded-2xl border border-carbon-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-xl hover:shadow-brand-500/10"
          >
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${c.accent} text-white shadow-lg transition group-hover:scale-105`}>
              <c.icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-extrabold text-carbon-950">{c.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-carbon-500">{c.description}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                {counts[c.title] == null ? 'Cargando…' : `${counts[c.title]} ${c.hint}`}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-600 transition group-hover:text-brand-700">
                Gestionar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Package className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-carbon-950">¿Buscas productos, stock o precios?</p>
            <p className="text-sm text-carbon-500">Los productos y su inventario se gestionan desde su propia sección.</p>
          </div>
        </div>
        <Link to="/admin/inventario" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
          Ir a Inventario
        </Link>
      </div>
    </div>
  )
}