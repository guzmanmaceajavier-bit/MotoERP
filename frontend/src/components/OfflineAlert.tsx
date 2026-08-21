import { useEffect, useState } from 'react'

export default function OfflineAlert() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.36 6.64a9 9 0 01.57 12.93M21 3L3 21M12 12a5 5 0 01.73 9.94M9.6 14.1a3 3 0 014.24 0" />
      </svg>
      Sin conexión a Internet. Reintenta cuando vuelvas a estar en línea.
    </div>
  )
}