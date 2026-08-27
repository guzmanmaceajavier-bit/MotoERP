import { APP_NAME } from '../lib/config'

export function Logo({
  size = 28,
  light = false,
  name = '',
  image = '',
}: {
  size?: number
  light?: boolean
  name?: string
  image?: string
}) {
  const label = name.trim() || APP_NAME
  const [first, ...rest] = label.split(/\s+/)
  return (
    <span className={`group flex items-center gap-3 ${light ? 'text-white' : 'text-carbon-900'}`}>
      {image ? (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-md ring-2 ring-brand-500/40">
          <img src={image} alt={label} className="h-full w-full object-cover" />
        </span>
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30 ring-2 ring-white/20 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 16l3.5-6.5a2 2 0 011.8-1H16l2 4.5H20a1 1 0 011 1V16H5z" fill="currentColor" stroke="none" />
            <circle cx="8.5" cy="16" r="1.5" />
            <circle cx="16.5" cy="16" r="1.5" />
            <path d="M8 4h3" />
          </svg>
        </span>
      )}
      <span className="whitespace-nowrap text-xl font-extrabold tracking-tight">
        {first}
        {rest.length > 0 && <span className="gradient-text"> {rest.join(' ')}</span>}
      </span>
    </span>
  )
}