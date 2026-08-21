import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default function BackLink({
  to,
  children,
}: {
  to?: string
  children: ReactNode
}) {
  const cls =
    'inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition hover:text-brand-700'
  const arrow = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5m6-6l-6 6 6 6" />
    </svg>
  )
  return (
    <>
      {to ? (
        <Link to={to} className={cls}>
          {arrow}
          {children}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => window.history.back()}
          className={cls}
          aria-label="Volver"
        >
          {arrow}
          {children}
        </button>
      )}
    </>
  )
}