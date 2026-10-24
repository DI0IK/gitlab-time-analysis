import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CalendarDays, Flame, Clock } from 'lucide-react'
import {
  WEEKDAYS,
  type GroupWeekdayHeatmapProps,
  type WeekdayHeatmapCellData,
} from './types'
import { HeatmapGrid } from './grid'
import { HeatmapLegend } from './legend'

export function GroupWeekdayHeatmap({ heatmap }: GroupWeekdayHeatmapProps) {
  const [hoveredCell, setHoveredCell] = React.useState<WeekdayHeatmapCellData | null>(null)

  const { cells = [], max_hours = 0, sprint_numbers = [], total_hours = 0 } = heatmap || {}

  // Index cells by `${sprint_number}-${weekday}` for instant O(1) lookup
  const cellMap = React.useMemo(() => {
    const map = new Map<string, WeekdayHeatmapCellData>()
    for (const c of cells) {
      map.set(`${c.sprint_number}-${c.weekday}`, c)
    }
    return map
  }, [cells])

  // Compute weekday totals across all sprints
  const weekdayTotals = React.useMemo(() => {
    const totals: Record<number, { hours: number; count: number }> = {}
    for (const w of WEEKDAYS) totals[w.num] = { hours: 0, count: 0 }
    for (const c of cells) {
      if (totals[c.weekday]) {
        totals[c.weekday].hours += c.total_hours
        totals[c.weekday].count += c.timelog_count
      }
    }
    return totals
  }, [cells])



  // Summary statistics for header badges
  const stats = React.useMemo(() => {
    let peakDayNum = 1
    let peakDayHours = -1
    let weekendHours = 0

    for (const w of WEEKDAYS) {
      const h = weekdayTotals[w.num]?.hours || 0
      if (h > peakDayHours) {
        peakDayHours = h
        peakDayNum = w.num
      }
      if (w.num >= 6) {
        weekendHours += h
      }
    }

    const peakDay = WEEKDAYS.find((w) => w.num === peakDayNum)?.full || 'None'
    const weekendPct = total_hours > 0 ? Math.round((weekendHours / total_hours) * 100) : 0

    return {
      peakDay,
      peakDayHours: peakDayHours > 0 ? peakDayHours.toFixed(1) : '0',
      weekendPct,
    }
  }, [weekdayTotals, total_hours])

  if (!heatmap || sprint_numbers.length === 0) {
    return (
      <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Timelog Activity Heatmap: Weekday &times; Sprint
          </CardTitle>
          <CardDescription>No timelogs recorded for this cohort yet.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Activity Rhythm: Weekday &times; Sprint Heatmap
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Distribution of logged hours by day of the week across all sprint cycles.
            </CardDescription>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-border/60">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-muted-foreground">Peak Rhythm:</span>
              <span className="font-semibold text-foreground">
                {stats.peakDay} ({stats.peakDayHours}h)
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-border/60">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Weekend Ratio:</span>
              <span className="font-semibold text-foreground">{stats.weekendPct}%</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Heatmap Grid */}
        <HeatmapGrid
          sprintNumbers={sprint_numbers}
          cellMap={cellMap}
          maxHours={max_hours}
          sprintStartWeekday={heatmap?.sprint_start_weekday}
          onHoverCell={setHoveredCell}
        />

        {/* Dynamic Tooltip & Legend Bar */}
        <HeatmapLegend hoveredCell={hoveredCell} />
      </CardContent>
    </Card>
  )
}

export * from './types'
export { HeatmapCell } from './cell'
export { HeatmapGrid } from './grid'
export { HeatmapLegend } from './legend'
