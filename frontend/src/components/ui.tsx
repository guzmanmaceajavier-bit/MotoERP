import type { ReactNode } from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

export function Card({
  children,
  className = '',
  hover = false,
}: {
  children: ReactNode
  className?: string
  hover?: boolean
}) {
  return (
    <div className={`card ${hover ? 'hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg' : ''} ${className}`}>
      {children}
    </div>
  )
}
export function StatCard({
  label,
  value,
  icon,
  tone = 'brand',
  delta,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: 'brand' | 'dark' | 'green' | 'amber' | 'blue' | 'red'
  delta?: { value: number; direction: 'up' | 'down'; label?: string }
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    dark: 'bg-carbon-900 text-brand-400',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-brand-100 text-brand-700',
    red: 'bg-red-50 text-red-600',
  }
  return (
    <Card className="flex items-center gap-4 p-5">
      {icon && <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-carbon-500">{label}</div>
        <div className="truncate text-2xl font-bold text-carbon-900">{value}</div>
        {delta && (
          <div className="mt-1 flex items-center gap-1 text-xs font-semibold">
            <span className={delta.direction === 'up' ? 'flex items-center gap-0.5 text-emerald-600' : 'flex items-center gap-0.5 text-red-600'}>
              {delta.direction === 'up' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {delta.value}%
            </span>
            {delta.label && <span className="font-normal text-carbon-400">{delta.label}</span>}
          </div>
        )}
      </div>
    </Card>
  )
}

const badgeTones: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-brand-100 text-brand-700',
  brand: 'bg-brand-100 text-brand-700',
  gray: 'bg-carbon-100 text-carbon-600',
  dark: 'bg-carbon-900 text-white',
}

export function Badge({ children, tone = 'gray', className = '' }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={`chip ${badgeTones[tone] ?? badgeTones.gray} ${className}`}>{children}</span>
}

export function SectionHeader({
  title,
  subtitle,
  action,
  variant = 'default',
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  variant?: 'default' | 'brand'
}) {
  const brand = variant === 'brand'
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1
          className={`text-2xl font-bold tracking-tight ${brand ? 'border-l-4 border-brand-500 pl-3 text-carbon-950' : 'text-carbon-900'}`}
        >
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-carbon-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-carbon-300 bg-carbon-50/50 px-6 py-14 text-center">
      {icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-carbon-100 text-carbon-400">{icon}</div>}
      <p className="font-semibold text-carbon-700">{title}</p>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-carbon-400">{subtitle}</p>}
    </div>
  )
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'dark' | 'green' | 'amber' }) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-500',
    dark: 'bg-carbon-800',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
  }
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-carbon-100">
      <div className={`h-full rounded-full ${colors[tone]} transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function Timeline({ items }: { items: { title: string; subtitle?: string; time?: string; tone?: string; dot?: string }[] }) {
  return (
    <ol className="relative ml-2 border-l-2 border-carbon-200">
      {items.map((it, i) => (
        <li key={i} className="mb-6 ml-6">
          <span
            className="absolute -left-[9px] mt-1 h-4 w-4 rounded-full border-2 border-white bg-brand-500"
            style={{ left: -9 }}
          />
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="font-semibold text-carbon-800">{it.title}</p>
            {it.time && <span className="text-xs text-carbon-400">{it.time}</span>}
          </div>
          {it.subtitle && <p className="mt-0.5 text-sm text-carbon-500">{it.subtitle}</p>}
        </li>
      ))}
    </ol>
  )
}
