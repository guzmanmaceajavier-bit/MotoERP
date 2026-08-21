interface MiniChartProps {
  data: number[]
  labels?: string[]
  height?: number
  color?: string
  formatValue?: (v: number) => string
}

export default function MiniChart({ data, labels, height = 140, color = '#ea580c', formatValue }: MiniChartProps) {
  const max = Math.max(1, ...data)
  const W = 320
  const H = 100
  const pad = 6
  const stepX = data.length > 1 ? (W - pad * 2) / (data.length - 1) : 0
  const points = data.map((v, i) => {
    const x = data.length > 1 ? pad + i * stepX : W / 2
    const y = H - pad - (v / max) * (H - pad * 2)
    return { x, y, v }
  })
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${points[points.length - 1]?.x ?? pad},${H - pad} L${points[0]?.x ?? pad},${H - pad} Z`
  const best = data.indexOf(Math.max(...data))

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img" aria-label="Gráfico de tendencia">
        <defs>
          <linearGradient id="mc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={H * f} y2={H * f} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 3" />
        ))}
        <path d={area} fill="url(#mc-area)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === best ? 4 : 2.5} fill="#fff" stroke={color} strokeWidth={i === best ? 2.5 : 2} />
        ))}
        {points[best] && (
          <g>
            <rect
              x={Math.max(pad, Math.min(W - pad - 52, points[best].x - 26))}
              y={Math.max(4, points[best].y - 24)}
              width="52"
              height="18"
              rx="6"
              fill="#1c1917"
              opacity="0.85"
            />
            <text
              x={Math.max(pad, Math.min(W - pad - 52, points[best].x - 26)) + 26}
              y={Math.max(4, points[best].y - 24) + 13}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="#fff"
            >
              {formatValue ? formatValue(points[best].v) : points[best].v}
            </text>
          </g>
        )}
      </svg>
      {labels && labels.length > 0 && (
        <div className="mt-1 flex justify-between text-[10px] font-medium text-carbon-400">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}