import type { ReactNode } from 'react'
import { SearchInput } from './form'

export function Toolbar({
  searchValue,
  onSearch,
  searchPlaceholder,
  searchVariant = 'default',
  children,
}: {
  searchValue?: string
  onSearch?: (v: string) => void
  searchPlaceholder?: string
  searchVariant?: 'default' | 'brand'
  children?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {searchValue !== undefined && onSearch && (
          <SearchInput value={searchValue} onChange={onSearch} placeholder={searchPlaceholder} variant={searchVariant} />
        )}
        {children}
      </div>
    </div>
  )
}

export function FilterPill({
  active,
  onClick,
  children,
  variant = 'default',
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  variant?: 'default' | 'brand'
}) {
  const brand = variant === 'brand'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : brand
            ? 'border-brand-300 bg-white text-carbon-900 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 dark:border-brand-500/50'
            : 'border-carbon-300 bg-white text-carbon-600 hover:border-brand-400 hover:text-brand-600 dark:bg-carbon-100 dark:text-carbon-500'
      }`}
    >
      {children}
    </button>
  )
}

export function IconButton({
  onClick,
  title,
  children,
  danger = false,
  disabled = false,
}: {
  onClick: () => void
  title: string
  children: ReactNode
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-40 ${
        danger
          ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10'
          : 'border-carbon-200 text-carbon-600 hover:bg-carbon-50 hover:text-brand-600 dark:border-carbon-300 dark:hover:bg-carbon-200'
      }`}
    >
      {children}
    </button>
  )
}