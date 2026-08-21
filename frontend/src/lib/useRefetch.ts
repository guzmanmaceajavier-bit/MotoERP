import { useEffect, useRef } from 'react'

/**
 * Ejecuta `refetch` cuando la pestaña vuelve a ser visible.
 * Permite que cambios hechos desde otra pantalla (panel admin ↔ portal cliente)
 * se reflejen automáticamente al volver a la pestaña.
 */
export function useRefetchOnFocus(refetch: () => void) {
  const ref = useRef(refetch)
  ref.current = refetch

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        ref.current()
      }
    }
    function onFocus() {
      ref.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [])
}

/**
 * Intervalo de sondeo que solo corre cuando la pestaña está visible.
 */
export function usePolling(refetch: () => void, intervalMs: number) {
  const ref = useRef(refetch)
  ref.current = refetch

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        ref.current()
      }
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
}
