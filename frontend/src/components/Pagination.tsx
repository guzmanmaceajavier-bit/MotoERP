interface PaginationProps {
  page: number
  lastPage: number
  total: number
  onChange: (page: number) => void
}

function pageNumbers(current: number, last: number): (number | '…')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const pages = new Set<number>([1, 2, current - 1, current, current + 1, last - 1, last])
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

export default function Pagination({ page, lastPage, total, onChange }: PaginationProps) {
  if (lastPage <= 1) return null

  const btn = (n: number, label: string, active = false, disabled = false) => (
    <button
      key={`pb-${n}`}
      disabled={disabled}
      onClick={() => onChange(n)}
      className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition disabled:opacity-40 ${
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-carbon-300 bg-white text-carbon-700 hover:bg-carbon-100 dark:border-carbon-300 dark:bg-carbon-100 dark:text-carbon-500 dark:hover:bg-carbon-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <nav className="flex flex-wrap items-center justify-center gap-1.5">
        {btn(page - 1, '‹', false, page <= 1)}
        {pageNumbers(page, lastPage).map((p, i) =>
          p === '…' ? (
            <span key={`e-${i}`} className="px-1 text-carbon-400">
              …
            </span>
          ) : (
            btn(p, String(p), p === page)
          ),
        )}
        {btn(page + 1, '›', false, page >= lastPage)}
      </nav>
      <span className="text-xs text-carbon-400">
        Página {page} de {lastPage} · {total} resultado{total === 1 ? '' : 's'}
      </span>
    </div>
  )
}