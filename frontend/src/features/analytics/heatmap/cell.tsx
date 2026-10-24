import { type WeekdayHeatmapCellData, getHeatClass } from './types'

interface HeatmapCellProps {
  sprintNumber: number
  weekday: number
  weekdayName: string
  cell?: WeekdayHeatmapCellData
  maxHours: number
  onHover: (cell: WeekdayHeatmapCellData | null) => void
}

export function HeatmapCell({
  sprintNumber,
  weekday,
  weekdayName,
  cell,
  maxHours,
  onHover,
}: HeatmapCellProps) {
  const hours = cell?.total_hours || 0
  const count = cell?.timelog_count || 0
  const isCurrentDay = !!cell?.is_current_day

  const handleMouseEnter = () => {
    onHover({
      sprint_number: sprintNumber,
      weekday,
      weekday_name: weekdayName,
      total_seconds: cell?.total_seconds || 0,
      total_hours: hours,
      timelog_count: count,
      is_current_day: isCurrentDay,
    })
  }

  const handleMouseLeave = () => {
    onHover(null)
  }

  const tooltipText = `${
    hours > 0
      ? `${hours.toFixed(1)}h logged on ${weekdayName}, Sprint ${sprintNumber} (${count} ${count === 1 ? 'timelog' : 'timelogs'})`
      : `No logged time on ${weekdayName}, Sprint ${sprintNumber}`
  }${isCurrentDay ? ' • Today (Current Day)' : ''}`

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={tooltipText}
      className={`w-[11px] h-[11px] sm:w-[12px] sm:h-[12px] rounded-[2px] border cursor-pointer transition-all duration-100 ${getHeatClass(hours, maxHours)} ${
        isCurrentDay
          ? '!border-primary outline outline-1 outline-primary/60 z-10'
          : ''
      }`}
    />
  )
}
