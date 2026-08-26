import { useState, useEffect } from 'react'

const COOKIE_KEY = 'motohub_cookie_consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY)
    if (!consent) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(COOKIE_KEY, 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center px-4 pb-4">
      <div className="w-full max-w-2xl rounded-2xl border border-carbon-200 bg-white p-5 shadow-2xl dark:bg-carbon-900 dark:border-carbon-700 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1010 10 4 4 0 01-5-5 4 4 0 01-5-5" />
              <path d="M8.5 8.5v.01" />
              <path d="M16 15.5v.01" />
              <path d="M12 12v.01" />
              <path d="M11 17v.01" />
              <path d="M7 14v.01" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-carbon-900 dark:text-carbon-100">
              Usamos cookies
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-carbon-500 dark:text-carbon-400">
              Utilizamos cookies para recordar tu carrito, preferencias y mejorar tu experiencia de navegación. 
              Al continuar navegando, aceptas el uso de cookies. Consulta nuestra{' '}
              <a href="/privacidad" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
                política de privacidad
              </a>{' '}
              para más información.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 sm:justify-end">
          <button
            onClick={accept}
            className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-brand-700 hover:shadow-lg active:scale-[0.97]"
          >
            Aceptar todas
          </button>
          <a
            href="/terminos"
            className="rounded-xl border border-carbon-200 px-4 py-2 text-xs font-semibold text-carbon-600 transition hover:bg-carbon-50 dark:border-carbon-600 dark:text-carbon-400 dark:hover:bg-carbon-800"
          >
            Configurar
          </a>
        </div>
      </div>
    </div>
  )
}
