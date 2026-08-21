import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/theme'

export default function ThemeToggle() {
  const { mode, setMode } = useTheme()
  const next = mode === 'dark' ? 'light' : 'dark'
  const label = next === 'light' ? 'Modo claro' : 'Modo oscuro'
  return (
    <button
      onClick={() => setMode(next)}
      title={mode === 'dark' ? 'Modo oscuro (toca para cambiar)' : 'Modo claro (toca para cambiar)'}
      aria-label={`Cambiar tema (${label})`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-carbon-200 text-carbon-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-carbon-300 dark:text-carbon-500"
    >
      {mode === 'dark' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
    </button>
  )
}