import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

// cabecera pareja para las paginas publicas, con o sin foto al lado
export default function PageHero({ eyebrow, title, subtitle, actions, points, visual, below }: {
  eyebrow: string
  title: ReactNode
  subtitle?: string
  actions?: ReactNode
  points?: { icon: LucideIcon; title: string; desc: string }[]
  visual?: ReactNode
  below?: ReactNode
}) {
  const centered = !visual
  return (
    <section className="relative overflow-hidden bg-white pb-10 pt-14 md:pt-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(40rem_18rem_at_50%_-5rem,#ffedd5,transparent)]" />
      <div className="relative mx-auto max-w-6xl px-4">
        <div className={centered ? 'mx-auto max-w-3xl text-center' : 'flex flex-col items-center gap-10 md:flex-row md:justify-between'}>
          <div className={centered ? '' : 'w-full max-w-xl text-center md:text-left'}>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black leading-[1.08] tracking-tight text-gray-900 md:text-4xl lg:text-5xl">{title}</h1>
            {subtitle && <p className={`mt-4 text-base leading-relaxed text-gray-500 ${centered ? 'mx-auto max-w-xl' : 'max-w-md'}`}>{subtitle}</p>}
            {actions && <div className={`mt-7 flex flex-wrap items-center gap-3 ${centered ? 'justify-center' : 'justify-center md:justify-start'}`}>{actions}</div>}
            {points && (
              <div className={`mt-7 flex flex-wrap gap-x-6 gap-y-4 ${centered ? 'justify-center' : 'justify-center md:justify-start'}`}>
                {points.map((p) => (
                  <div key={p.title} className="flex items-center gap-2.5 text-left">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500"><p.icon className="h-4 w-4" /></span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{p.title}</p>
                      <p className="text-xs text-gray-400">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {visual && <div className="w-full shrink-0 md:w-[440px]">{visual}</div>}
        </div>
        {below && <div className="mt-8">{below}</div>}
      </div>
    </section>
  )
}
