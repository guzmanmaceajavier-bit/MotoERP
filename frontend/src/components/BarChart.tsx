interface BarChartProps {
  groups: { label: string; color: string; data: number[] }[]
  labels: string[]
  height?: number
  formatValue?: (v: number) => string
  stacked?: boolean
}

export default function BarChart({ groups, labels, height = 220, formatValue, stacked = false }: BarChartProps) {
  const W = 560
  const H = 220
  const padB = 24
  const padT = 10
  const padL = 4
  const padR = 8
  const chartH = H - padB - padT
  let max = 1
  if (stacked) {
    max = Math.max(1, ...labels.map((_, i) => groups.reduce((s, g) => s + (g.data[i] ?? 0), 0)))
  } else {
    max = Math.max(1, ...groups.flatMap((g) => g.data))
  }
  const niceMax = Math.ceil(max * 1.15 / 10) * 10

  const slotW = (W - padL - padR) / labels.length
  const innerPad = 4
  const barW = stacked
    ? Math.max(8, slotW - innerPad * 2)
    : Math.max(6, (slotW - innerPad) / (groups.length * 1.4))

  const yFor = (v: number) => padT + chartH - (v / niceMax) * chartH

  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => padT + chartH * f)

  const totalH = H

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${totalH}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img" aria-label="Gráfico de barras">
        {grid.map((y, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 3" />
            <text x={padL} y={y - 3} fontSize="9" fill="#9ca3af">{formatValue ? formatValue(niceMax * (1 - i * 0.25)) : niceMax * (1 - i * 0.25)}</text>
          </g>
        ))}
        {labels.map((label, idx) => {
          const cx = padL + idx * slotW + slotW / 2
          let stackBottom = padT + chartH
          return (
            <g key={idx}>
              {groups.map((g, gi) => {
                const v = g.data[idx] ?? 0
                const y = yFor(v)
                const x = stacked ? cx - barW / 2 : cx - (barW * groups.length) / 2 + gi * barW + (gi + 1) * 2
                if (stacked) {
                  const bottom = stackBottom
                  stackBottom = y
                  return (
                    <rect
                      key={gi}
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(0, bottom - y)}
                      rx="3"
                      fill={g.color}
                    />
                  )
                }
                return (
                  <rect key={gi} x={x} y={y} width={barW} height={Math.max(1, padT + chartH - y)} rx="3" fill={g.color} />
                )
              })}
              <text x={cx} y={H - 6} fontSize="9" fill="#9ca3af" textAnchor="middle">{label}</text>
            </g>
          )
        })}
      </svg>
      {groups.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          {groups.map((g) => (
            <span key={g.label} className="flex items-center gap-1.5 text-[11px] font-medium text-carbon-500">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: g.color }} />
              {g.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}