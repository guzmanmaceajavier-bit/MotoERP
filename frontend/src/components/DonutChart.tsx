interface DonutSlice {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  data: DonutSlice[]
  size?: number
  thickness?: number
  formatValue?: (v: number) => string
}

export default function DonutChart({ data, size = 180, thickness = 26, formatValue }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const cx = size / 2
  const cy = size / 2
  const r = (size - thickness) / 2

  if (total <= 0) {
    return (
      <div className="flex items-center justify-center text-sm text-carbon-400" style={{ width: size, height: size }}>
        Sin datos
      </div>
    )
  }

  const strokeDasharray = 2 * Math.PI * r
  let offset = 0

  const segments = data.filter((d) => d.value > 0).map((d) => {
    const frac = d.value / total
    const seg = {
      ...d,
      percent: frac,
      dash: frac * strokeDasharray,
      offset,
    }
    offset += frac * strokeDasharray
    return seg
  })

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }} role="img" aria-label="Gráfico de torta">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={thickness} />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${Math.max(0, s.dash - 1.5)} ${strokeDasharray}`}
            strokeDashoffset={-s.offset - (i > 0 ? 0.75 : 0)}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="800" fill="#1c1917">
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fontWeight="600" fill="#9ca3af">
          total
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate text-carbon-700">{s.label}</span>
            </span>
            <span className="shrink-0 font-bold text-carbon-900">
              {formatValue ? formatValue(s.value) : s.value}
              <span className="ml-1 text-xs font-medium text-carbon-400">{Math.round(s.percent * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}