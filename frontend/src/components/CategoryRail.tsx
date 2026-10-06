import { useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react'

// carrusel de categorias con flechas, se usa en tienda y servicios
export interface RailItem {
  key: string
  label: string
  sub?: string
  icon?: ReactNode
}

export default function CategoryRail({ items, active, onPick, tone = 'light' }: {
  items: RailItem[]
  active: string
  onPick: (key: string) => void
  tone?: 'light' | 'dark'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (d: -1 | 1) => ref.current?.scrollBy({ left: d * 360, behavior: 'smooth' })
  const dark = tone === 'dark'

  return (
    <div className="group/rail relative">
      <button onClick={() => scroll(-1)} aria-label="Anterior" className={`absolute -left-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-md transition md:flex ${dark ? 'border-white/10 bg-gray-900 text-gray-300 hover:border-orange-400/60 hover:text-orange-300' : 'border-gray-200 bg-white text-gray-500 hover:border-orange-300 hover:text-orange-600'}`}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button onClick={() => scroll(1)} aria-label="Siguiente" className={`absolute -right-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-md transition md:flex ${dark ? 'border-white/10 bg-gray-900 text-gray-300 hover:border-orange-400/60 hover:text-orange-300' : 'border-gray-200 bg-white text-gray-500 hover:border-orange-300 hover:text-orange-600'}`}>
        <ChevronRight className="h-4 w-4" />
      </button>

      <div ref={ref} className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((t) => {
          const on = active === t.key
          return (
            <button
              key={t.key || 'todos'}
              onClick={() => onPick(t.key)}
              aria-pressed={on}
              className={`group snap-start flex w-[118px] shrink-0 flex-col items-center gap-2 rounded-2xl border p-3.5 transition duration-300 ${
                on
                  ? '-translate-y-1 border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                  : dark
                    ? 'border-white/10 bg-white/5 text-gray-300 hover:-translate-y-1 hover:border-orange-400/60 hover:shadow-md'
                    : 'border-gray-200 bg-white text-gray-700 hover:-translate-y-1 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl transition ${on ? 'bg-white/20' : 'bg-orange-50 group-hover:bg-orange-100'}`}>
                {t.key === '' ? <LayoutGrid className={`h-6 w-6 ${on ? 'text-white' : 'text-orange-500'}`} /> : <span className={on ? 'text-white' : 'text-orange-500'}>{t.icon}</span>}
              </span>
              <span className="text-xs font-bold leading-tight">{t.label}</span>
              {t.sub ? (
                <span className={`text-[11px] font-medium ${on ? 'text-white/80' : 'text-gray-400'}`}>{t.sub}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
