export interface DayHour {
  day: number
  open: string
  close: string
}

export interface Holiday {
  date: string
  mode?: 'closed' | 'saturday' | 'custom'
  open?: string
  close?: string
}

export interface ScheduleInfo {
  schedule_open?: string
  schedule_close?: string
  closed_days?: number[]
  day_hours?: DayHour[]
  holidays?: Holiday[]
}

export interface Hours {
  open: string
  close: string
}

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Horas del sábado según configuración (null = cerrado). */
export function saturdayHours(site: ScheduleInfo | null): Hours | null {
  if (!site) return null
  const dayHours = (site.day_hours ?? []).find((x) => x.day === 6)
  if ((site.closed_days ?? []).includes(6)) return null
  if (dayHours) return { open: dayHours.open, close: dayHours.close }
  return { open: site.schedule_open || '09:00', close: site.schedule_close || '18:00' }
}

/** Horas de un festivo según su modo (null = cerrado). */
function holidayHours(site: ScheduleInfo, h: Holiday): Hours | null {
  const mode = h.mode ?? (h.open || h.close ? 'custom' : 'closed')
  if (mode === 'saturday') return saturdayHours(site)
  if (mode === 'custom') {
    if (!h.open && !h.close) return null
    return { open: h.open || '09:00', close: h.close || '18:00' }
  }
  return null
}

/** Horas de atención de una fecha concreta (null = cerrado). */
export function resolveHours(site: ScheduleInfo | null, date: Date): Hours | null {
  if (!site) return null
  const dateStr = toDateStr(date)

  const holiday = (site.holidays ?? []).find((h) => h.date === dateStr)
  if (holiday) return holidayHours(site, holiday)

  const dow = date.getDay()
  const dayHours = (site.day_hours ?? []).find((x) => x.day === dow)

  // Domingo: cerrado salvo que exista un horario explícito para ese día.
  if (dow === 0 && !dayHours) return null
  if ((site.closed_days ?? []).includes(dow)) return null
  if (dayHours) return { open: dayHours.open, close: dayHours.close }

  return { open: site.schedule_open || '09:00', close: site.schedule_close || '18:00' }
}

/** Estado abierto/cerrado en el momento actual. */
export function statusNow(site: ScheduleInfo | null, now = new Date()): { open: boolean; label: string } {
  const hours = resolveHours(site, now)
  if (!hours) return { open: false, label: 'Cerrado ahora' }

  const [oh, om] = hours.open.split(':').map(Number)
  const [ch, cm] = hours.close.split(':').map(Number)
  const mins = now.getHours() * 60 + now.getMinutes()
  const openMins = oh * 60 + om
  const closeMins = ch * 60 + cm

  return mins >= openMins && mins < closeMins
    ? { open: true, label: `Abierto ahora · hasta las ${hours.close}` }
    : { open: false, label: `Cerrado ahora · abre a las ${hours.open}` }
}

export interface ScheduleSummary {
  weekday: Hours
  saturday: Hours | null
  sunday: null
  holidays: Holiday[]
}

/** Resumen simplificado para mostrar: Lun-Vie, Sábado, Domingo y festivos. */
export function scheduleSummary(site: ScheduleInfo | null): ScheduleSummary | null {
  if (!site) return null
  return {
    weekday: { open: site.schedule_open || '09:00', close: site.schedule_close || '18:00' },
    saturday: saturdayHours(site),
    sunday: null,
    holidays: site.holidays ?? [],
  }
}