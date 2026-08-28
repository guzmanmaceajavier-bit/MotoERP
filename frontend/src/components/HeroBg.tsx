import { useEffect, useState } from 'react'

export function HeroBg({ images }: { images?: string[] }) {
  const list = (images ?? []).filter((u) => u)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (list.length <= 1) return
    const t = setInterval(() => setIdx((i) => (i + 1) % list.length), 4500)
    return () => clearInterval(t)
  }, [list.length])

  if (list.length === 0) return null

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-50 to-white p-3 sm:p-4">
      {list.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          loading={i === 0 ? 'eager' : 'lazy'}
          className="absolute max-h-full max-w-full object-contain object-center transition-opacity duration-1000"
          style={{ opacity: i === idx ? 1 : 0 }}
        />
      ))}
    </div>
  )
}