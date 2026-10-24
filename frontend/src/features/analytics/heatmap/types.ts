export interface WeekdayHeatmapCellData {
  sprint_number: number
  weekday: number // 1 = Mon, ..., 7 = Sun
  weekday_name: string
  total_seconds: number
  total_hours: number
  timelog_count: number
  is_current_day?: boolean
}

export interface WeekdaySprintHeatmapData {
  cells: WeekdayHeatmapCellData[]
  max_hours: number
  total_hours: number
  sprint_numbers: number[]
  sprint_start_weekday?: string
}

export interface GroupWeekdayHeatmapProps {
  heatmap?: WeekdaySprintHeatmapData | null
}

export interface WeekdayInfo {
  num: number
  short: string
  full: string
  showLabel: boolean
}

export const ALL_WEEKDAYS: Array<{ num: number; short: string; full: string }> = [
  { num: 1, short: 'Mon', full: 'Monday' },
  { num: 2, short: 'Tue', full: 'Tuesday' },
  { num: 3, short: 'Wed', full: 'Wednesday' },
  { num: 4, short: 'Thu', full: 'Thursday' },
  { num: 5, short: 'Fri', full: 'Friday' },
  { num: 6, short: 'Sat', full: 'Saturday' },
  { num: 7, short: 'Sun', full: 'Sunday' },
]

export function getOrderedWeekdays(startWeekdayName?: string): WeekdayInfo[] {
  const name = (startWeekdayName || 'Monday').trim().toLowerCase()
  const numParsed = parseInt(name, 10)
  let offset = 0
  if (!isNaN(numParsed) && numParsed >= 1 && numParsed <= 7) {
    offset = numParsed - 1
  } else {
    const startIndex = ALL_WEEKDAYS.findIndex(
      (w) => w.full.toLowerCase() === name || w.short.toLowerCase() === name
    )
    offset = startIndex >= 0 ? startIndex : 0
  }

  return Array.from({ length: 7 }, (_, i) => {
    const w = ALL_WEEKDAYS[(offset + i) % 7]
    // Show alternating day labels starting from sprint day 1: Day 1 (index 0), Day 3 (index 2), Day 5 (index 4)
    const showLabel = i === 0 || i === 2 || i === 4
    return {
      ...w,
      showLabel,
    }
  })
}

export const WEEKDAYS: WeekdayInfo[] = getOrderedWeekdays('Monday')

export function getHeatClass(hours: number, maxHours: number): string {
  if (!hours || hours <= 0) {
    return 'bg-muted/40 dark:bg-muted/20 border-border/40 hover:border-foreground/50'
  }
  if (maxHours <= 0) return 'bg-emerald-500/25 border-emerald-500/35 hover:ring-1 hover:ring-emerald-400'

  const ratio = hours / maxHours
  if (ratio < 0.25) {
    return 'bg-emerald-500/25 border-emerald-500/35 hover:ring-1 hover:ring-emerald-400'
  }
  if (ratio < 0.5) {
    return 'bg-emerald-500/50 border-emerald-500/55 hover:ring-1 hover:ring-emerald-400'
  }
  if (ratio < 0.75) {
    return 'bg-emerald-500/75 border-emerald-500/80 hover:ring-1 hover:ring-emerald-300'
  }
  return 'bg-emerald-500 dark:bg-emerald-400 border-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.4)] hover:ring-1 hover:ring-white'
}
