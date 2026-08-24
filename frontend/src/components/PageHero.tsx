import type { ReactNode } from 'react'

interface PageHeroProps {
  title: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
}

export default function PageHero({ title, subtitle, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-white pb-6 pt-14 md:pb-8 md:pt-20">
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-10 h-40 w-40 rounded-full bg-orange-300/15 blur-2xl" />
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-orange-400 via-orange-500 to-orange-300" />
      <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-orange-300 via-orange-500 to-orange-400" />

      <div className="relative mx-auto max-w-6xl px-4 text-center">
        <h1 className="text-3xl font-black leading-[1.1] tracking-tight text-gray-900 md:text-4xl lg:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-500 md:text-lg">
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </section>
  )
}
