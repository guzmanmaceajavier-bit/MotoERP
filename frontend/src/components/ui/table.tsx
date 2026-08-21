import type { ReactNode } from 'react'
import Pagination from '../Pagination'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  headerClass?: string
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  page,
  lastPage,
  total,
  onPage,
  emptyText = 'Sin resultados.',
  minWidth = 'min-w-[640px]',
  headerClassName,
  rowClassName,
  rowKey,
  variant = 'default',
}: {
  columns: Column<T>[]
  rows: T[]
  page?: number
  lastPage?: number
  total?: number
  onPage?: (p: number) => void
  emptyText?: string
  minWidth?: string
  headerClassName?: string
  rowClassName?: (row: T) => string
  rowKey?: (row: T, index: number) => string | number
  variant?: 'default' | 'brand'
}) {
  const alignCls = { left: 'text-left', right: 'text-right', center: 'text-center' }
  const align = (a: 'left' | 'right' | 'center' = 'left') => alignCls[a]
  const brand = variant === 'brand'

  return (
    <>
      <div
        className={`overflow-x-auto rounded-2xl border bg-white dark:bg-carbon-100 ${
          brand ? 'border-brand-300 shadow-[0_1px_0_0_rgba(239,68,68,0.15)]' : 'border-carbon-200 dark:border-carbon-200'
        }`}
      >
        <table className={`w-full text-sm ${minWidth}`}>
          <thead
            className={`border-b-2 text-left text-[11px] uppercase tracking-widest ${
              brand
                ? 'border-brand-400 bg-brand-50 font-extrabold text-carbon-950'
                : 'bg-carbon-50 font-semibold tracking-wide text-carbon-500 dark:bg-carbon-50/60 dark:text-carbon-400'
            } ${headerClassName ?? ''}`}
          >
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3.5 ${align(c.align)} ${c.headerClass ?? ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-carbon-400">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={rowKey ? rowKey(row, idx) : ((row as { id?: number }).id ?? idx)}
                  className={`border-t transition ${
                    brand
                      ? 'border-brand-100 hover:bg-brand-50/40'
                      : 'border-carbon-100 hover:bg-carbon-50/70 dark:border-carbon-200 dark:hover:bg-carbon-50/30'
                  } ${rowClassName ? rowClassName(row) : ''}`}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3 ${align(c.align)} ${c.className ?? ''}`}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {page !== undefined && lastPage !== undefined && onPage && lastPage > 1 && (
        <Pagination page={page} lastPage={lastPage} total={total ?? 0} onChange={onPage} />
      )}
    </>
  )
}