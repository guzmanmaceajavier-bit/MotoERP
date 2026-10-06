import type { MouseEvent, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { HeroBg } from './HeroBg'

interface Point { icon: LucideIcon; title: string; desc?: string }

// cabecera clara para las paginas, mismo idioma que servicios
// si hay foto del CMS se muestra al lado, si no queda centrada
export default function PageHero({ eyebrow, title, subtitle, points = [], below, images, visual }: {
  eyebrow?: string
  title: ReactNode
  subtitle?: string
  points?: Point[]
  below?: ReactNode
  images?: string[]
  visual?: ReactNode
}) {
  function onMove(e: MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  const side = visual ?? (images && images.length > 0 ? (
    <div className="relative">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-2 rounded-[2rem] bg-orange-500/90 shadow-xl shadow-orange-500/20" />
      <div className="relative h-[280px] overflow-hidden rounded-[2rem] border-4 border-white bg-gray-100 shadow-2xl sm:h-[320px] dark:border-white/10">
        <HeroBg images={images} />
      </div>
    </div>
  ) : undefined)
  const centered = !side

  return (
    <section onMouseMove={onMove} className="relative isolate overflow-hidden bg-orange-50 dark:bg-gray-950">
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: 'radial-gradient(#fdba74 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(180deg,#000 35%,transparent)',
          WebkitMaskImage: 'linear-gradient(180deg,#000 35%,transparent)',
        }}
      />
      <div className="anim-glow absolute -right-20 -top-20 -z-10 h-80 w-80 rounded-full bg-orange-300/50 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 hidden md:block"
        style={{ background: 'radial-gradient(420px circle at var(--mx,50%) var(--my,30%), rgba(249,115,22,.12), transparent 60%)' }}
      />

      <div className="mx-auto max-w-6xl px-4 pb-10 pt-14 md:pt-20">
        <div className={centered ? 'mx-auto max-w-4xl text-center' : 'flex flex-col items-center gap-10 lg:flex-row lg:justify-between'}>
          <div className={centered ? '' : 'w-full max-w-xl text-center lg:text-left'}>
            {eyebrow && (
              <p className="anim-rise inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-widest text-orange-600 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                </span>
                {eyebrow}
              </p>
            )}

            <h1 className="anim-rise mt-4 text-4xl font-black leading-[1.05] tracking-tight text-gray-900 dark:text-white md:text-6xl" style={{ animationDelay: '120ms' }}>
              {title}
            </h1>

            {subtitle && (
              <p className={`anim-rise mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg ${centered ? 'mx-auto max-w-2xl' : 'max-w-md'}`} style={{ animationDelay: '260ms' }}>
                {subtitle}
              </p>
            )}

            {below && <div className="anim-rise mt-8" style={{ animationDelay: '400ms' }}>{below}</div>}

            {points.length > 0 && (
              <ul className={`mt-10 grid grid-cols-2 gap-3 text-left ${centered ? 'md:grid-cols-4' : 'sm:grid-cols-2'}`}>
                {points.map((p, i) => (
                  <li
                    key={p.title}
                    className="anim-rise group flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md dark:border-white/10 dark:bg-white/5"
                    style={{ animationDelay: `${550 + i * 90}ms` }}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 transition group-hover:bg-orange-100 dark:bg-orange-500/15">
                      <p.icon className="h-5 w-5 text-orange-500" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold leading-tight text-gray-900 dark:text-white">{p.title}</span>
                      {p.desc && <span className="block text-xs text-gray-500">{p.desc}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {side && <div className="w-full max-w-xl shrink-0 lg:w-[500px]">{side}</div>}
        </div>
      </div>
    </section>
  )
}
