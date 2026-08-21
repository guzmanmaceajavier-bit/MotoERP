import { useEffect, useState } from 'react'

const STORAGE_KEY = 'moto_cookies_consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  function decide(value: 'accepted' | 'declined') {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* noop */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="anim-fade-up fixed inset-x-0 bottom-0 z-[60] px-4 pb-4">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 rounded-2xl border border-carbon-200 bg-white p-5 shadow-2xl shadow-carbon-900/10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z" /><path d="M6 6a4 4 0 00-4 4c0 1.1.9 2 2 2a2 2 0 002-2 2 2 0 012-2 2 2 0 002 2 2 2 0 002-2 2 2 0 012-2 2 2 0 002-2 2 2 0 00-2-2" /></svg>
          </span>
          <div>
            <p className="font-bold text-carbon-900">Aviso de cookies</p>
            <p className="mt-0.5 text-sm leading-relaxed text-carbon-500">
              Usamos cookies para recordar tu carrito, preferencias y mejorar tu experiencia de navegación.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => decide('declined')} className="rounded-xl border border-carbon-300 px-4 py-2.5 text-sm font-semibold text-carbon-600 transition hover:border-brand-500 hover:text-brand-600">
            Rechazar
          </button>
          <button type="button" onClick={() => decide('accepted')} className="btn-primary btn-shine">
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}