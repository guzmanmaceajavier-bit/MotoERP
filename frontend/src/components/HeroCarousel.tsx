import { useEffect, useState } from 'react'

type Slide = { image: string; pos?: string; scale?: number }

export function HeroCarousel({ slides, interval = 4000, overlay = 'dark' }: { slides: Slide[]; interval?: number; overlay?: 'dark' | 'none' }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), interval)
    return () => clearInterval(t)
  }, [slides.length, interval])

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="relative h-full w-full">
        {slides.map((s, i) => (
          <div
            key={i}
            style={{
              backgroundImage: `url(${s.image})`,
              backgroundPosition: s.pos || 'center',
              transform: s.scale ? `scale(${s.scale})` : undefined,
              transition: 'opacity 1s ease',
            }}
            className={`absolute inset-0 bg-cover transition-opacity duration-[1200ms] ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className={`absolute inset-0 ${overlay === 'dark' ? 'bg-carbon-950/75' : 'bg-gradient-to-t from-brand-600/15 via-transparent to-brand-500/10'}`} />
            {overlay === 'dark' && (
              <div className="absolute inset-0 [background-image:radial-gradient(circle_at_20%_20%,rgba(229,57,53,0.35)_0,transparent_45%),radial-gradient(circle_at_85%_80%,rgba(229,57,53,0.22)_0,transparent_40%)]" />
            )}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Imagen ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-brand-500' : 'w-2 bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}