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
    <div className="absolute inset-0">
      {list.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          loading={i === 0 ? 'eager' : 'lazy'}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
          style={{ opacity: i === idx ? 1 : 0 }}
        />
      ))}
    </div>
  )
}