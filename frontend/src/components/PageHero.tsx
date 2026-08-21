import type { ReactNode } from 'react'
import { HeroBg } from './HeroBg'

interface PageHeroProps {
  title: ReactNode
  subtitle?: ReactNode
  images?: string[]
  imageAlt?: string
  badge?: ReactNode
  children?: ReactNode
}

/**
 * Hero para las páginas públicas (web).
 * Muestra la imagen de fondo con object-cover (encaja sin deformar)
 * y un degradado sutil para legibilidad del texto.
 */
export default function PageHero({ title, subtitle, images, children }: PageHeroProps) {
  return (
    <section className="relative flex h-[340px] items-center overflow-hidden bg-carbon-950 md:h-[420px]">
      {images && images.length > 0 && <HeroBg images={images} />}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
      <div className="relative mx-auto flex w-full max-w-6xl items-center px-4 py-8">
        <div className="max-w-lg">
          <h1
            className="text-4xl font-black leading-tight tracking-tight text-white md:text-5xl"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)' }}
          >
            {title}
          </h1>
          <div className="mt-3 h-1 w-16 rounded-full bg-brand-500" />
          {subtitle && (
            <p
              className="mt-5 max-w-md text-lg leading-relaxed text-white"
              style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.4)' }}
            >
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  )
}