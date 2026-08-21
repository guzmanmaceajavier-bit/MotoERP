import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const baseField =
  'w-full rounded-xl border-2 border-brand-300 bg-white px-3.5 py-2.5 text-carbon-900 placeholder:text-carbon-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 transition dark:bg-carbon-100 dark:border-brand-500/50 dark:text-carbon-700 dark:placeholder:text-carbon-400'

const baseFieldBrand =
  'w-full rounded-xl border-2 border-brand-500 bg-white px-3.5 py-2.5 text-carbon-950 placeholder:text-carbon-400 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-500/20 transition dark:border-brand-500/70 dark:text-carbon-900'

type FieldVariant = 'default' | 'brand'

export function Label({ htmlFor, children, hint, variant = 'default' }: { htmlFor?: string; children: ReactNode; hint?: string; variant?: FieldVariant }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`mb-1.5 block text-sm font-medium ${variant === 'brand' ? 'text-carbon-950' : 'text-carbon-700 dark:text-carbon-500'}`}
    >
      {children}
      {hint && <span className="ml-1 text-xs font-normal text-carbon-400">{hint}</span>}
    </label>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  variant = 'default',
}: {
  label?: string
  hint?: string
  error?: string
  children: ReactNode
  variant?: FieldVariant
}) {
  return (
    <div className="min-w-0">
      {label && <Label hint={hint} variant={variant}>{label}</Label>}
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { variant?: FieldVariant }
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { variant?: FieldVariant }
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { variant?: FieldVariant }

export function Input(props: InputProps) {
  const { className = '', variant = 'default', ...rest } = props
  return <input {...rest} className={`${variant === 'brand' ? baseFieldBrand : baseField} ${className}`} />
}

export function Select(props: SelectProps) {
  const { className = '', children, variant = 'default', ...rest } = props
  return (
    <select {...rest} className={`${variant === 'brand' ? baseFieldBrand : baseField} ${className}`}>
      {children}
    </select>
  )
}

export function Textarea(props: TextareaProps) {
  const { className = '', variant = 'default', ...rest } = props
  return <textarea {...rest} className={`${variant === 'brand' ? baseFieldBrand : baseField} ${className}`} />
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
        checked ? 'border-brand-600 bg-brand-600' : 'border-carbon-300 bg-carbon-200 dark:bg-carbon-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
      {label && <span className="ml-2">{label}</span>}
    </button>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar…',
  variant = 'default',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  variant?: FieldVariant
}) {
  const brand = variant === 'brand'
  return (
    <div className="relative w-full sm:max-w-xs">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-carbon-400">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </span>
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-carbon-400 hover:text-carbon-600"
          aria-label="Limpiar búsqueda"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-white py-2.5 pl-9 pr-8 text-sm text-carbon-950 placeholder:text-carbon-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20 transition dark:bg-carbon-100 dark:text-carbon-900 ${
          brand ? 'border-brand-300 dark:border-brand-500/50' : 'border-carbon-300 dark:border-carbon-300'
        }`}
      />
    </div>
  )
}

export function FormRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${className}`}>{children}</div>
}