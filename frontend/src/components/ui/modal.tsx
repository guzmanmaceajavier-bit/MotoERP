import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  variant = 'default',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'brand'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizes: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  }
  const brand = variant === 'brand'

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 flex max-h-[90vh] w-full ${sizes[size]} anim-fade-up flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-carbon-100 ${
          brand ? 'border-brand-300 shadow-[0_25px_60px_-15px_rgba(194,65,12,0.35)]' : 'border-carbon-200 dark:border-carbon-200'
        }`}
      >
        <div
          className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${
            brand ? 'border-brand-200 bg-brand-50/60 dark:bg-brand-500/10' : 'border-carbon-100 dark:border-carbon-200'
          }`}
        >
          <div>
            <h3 className={`text-lg font-bold ${brand ? 'text-carbon-950' : 'text-carbon-900 dark:text-carbon-700'}`}>{title}</h3>
            {subtitle && <p className={`mt-0.5 text-sm ${brand ? 'text-carbon-700' : 'text-carbon-500 dark:text-carbon-400'}`}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className={`rounded-lg p-1.5 transition ${
              brand
                ? 'text-carbon-500 hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-500/20'
                : 'text-carbon-400 hover:bg-carbon-100 hover:text-carbon-700 dark:hover:bg-carbon-200'
            }`}
            aria-label="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div
            className={`flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3.5 ${
              brand ? 'border-brand-200 bg-brand-50/60 dark:bg-brand-500/10' : 'border-carbon-100 bg-carbon-50/60 dark:border-carbon-200 dark:bg-carbon-50/40'
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Eliminar',
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost !text-sm">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? 'Procesando…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-carbon-600 dark:text-carbon-400">{message}</p>
    </Modal>
  )
}