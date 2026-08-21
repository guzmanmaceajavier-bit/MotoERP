import { useEffect, useState } from 'react'

const SUN = 'M12 3v1.5M12 19.5V21M4.2 4.2l1.1 1.1M18.7 18.7l1.1 1.1M2.5 12H4M20 12h1.5M4.2 19.8l1.1-1.1M18.7 5.3l1.1-1.1M12 17.5a5.5 5.5 0 100-11 5.5 5.5 0 000 11z'
const CLOUD = 'M17.5 19H9a7 7 0 117.7-11.5A5.5 5.5 0 0117.5 19zM12 3v1M18 4l.7.7M21 9h-1M3.5 9H3M7 3l-.7.7'
const MOON = 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z'

const greeting = (d: Date) => {
  const h = d.getHours()
  if (h >= 5 && h < 12) return 'Buenos días'
  if (h >= 12 && h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

const dayIcon = (d: Date) => {
  const h = d.getHours()
  if (h >= 5 && h < 12) return SUN
  if (h >= 12 && h < 20) return CLOUD
  return MOON
}

const clock12 = (d: Date) =>
  d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })

export default function HeaderClock({
  name,
  align = 'start',
}: {
  name?: string
  align?: 'start' | 'end'
}) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const first = name?.trim().split(/\s+/)[0]

  return (
    <div className={`flex min-w-0 flex-col ${align === 'end' ? 'items-end text-right' : ''}`}>
      <span className="truncate bg-gradient-to-r from-brand-600 via-orange-500 to-amber-500 bg-clip-text text-lg font-extrabold leading-tight tracking-tight text-transparent">
        {greeting(now)}
        {first ? `, ${first}` : ''}
      </span>
      <span className={`mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-carbon-500 ${align === 'end' ? 'flex-row-reverse' : ''}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={dayIcon(now)} />
        </svg>
        {clock12(now)}
      </span>
    </div>
  )
}