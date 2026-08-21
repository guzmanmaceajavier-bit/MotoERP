import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

const KEY = 'motohub-theme'

export function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

function storedMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(KEY)
  return stored === 'dark' ? 'dark' : 'light'
}

// Aplica el tema en cuanto se carga el módulo (sin parpadeo).
if (typeof window !== 'undefined') {
  applyTheme(storedMode())
}

export function useTheme(): { mode: ThemeMode; theme: ThemeMode; setMode: (m: ThemeMode) => void; toggle: () => void } {
  const [mode, setModeState] = useState<ThemeMode>(storedMode)

  useEffect(() => {
    localStorage.setItem(KEY, mode)
    applyTheme(mode)
  }, [mode])

  const setMode = (m: ThemeMode) => setModeState(m)

  return { mode, theme: mode, setMode, toggle: () => setModeState((m) => (m === 'dark' ? 'light' : 'dark')) }
}