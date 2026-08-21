import { Field, Textarea } from '../ui/form'

export function BulkToggle({ bulk, onChange }: { bulk: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex gap-1 rounded-xl border border-carbon-200 bg-carbon-50 p-1">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          !bulk ? 'bg-brand-600 text-white' : 'text-carbon-600 hover:text-brand-700'
        }`}
      >
        1 a la vez
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          bulk ? 'bg-brand-600 text-white' : 'text-carbon-600 hover:text-brand-700'
        }`}
      >
        Varias a la vez
      </button>
    </div>
  )
}

export function BulkNamesField({
  value,
  onChange,
  entity,
}: {
  value: string
  onChange: (v: string) => void
  entity: string
}) {
  return (
    <Field
      label="Nombres (uno por línea) *"
      hint={`Escribe cada ${entity} en una línea. Todas se crean con los datos de arriba.`}
    >
      <Textarea
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        variant="brand"
        placeholder={'Bajaj\nYamaha\nHonda'}
      />
    </Field>
  )
}

export function parseBulkNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}