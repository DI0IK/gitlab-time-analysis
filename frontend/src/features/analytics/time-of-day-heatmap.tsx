import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Clock, Flame, Moon, Sun, Sunrise, Sunset } from 'lucide-react'
import type { components } from '@/lib/api/schema'

type TimeOfDayHeatmapData = components['schemas']['TimeOfDayHeatmap']
type TimeOfDayCell = components['schemas']['TimeOfDayCell']

interface TimeOfDayHeatmapProps {
  timeOfDay?: TimeOfDayHeatmapData
}

const WEEKDAYS = [
  { num: 1, short: 'Mon' },
  { num: 2, short: 'Tue' },
  { num: 3, short: 'Wed' },
  { num: 4, short: 'Thu' },
  { num: 5, short: 'Fri' },
  { num: 6, short: 'Sat' },
  { num: 7, short: 'Sun' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function TimeOfDayHeatmap({ timeOfDay }: TimeOfDayHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<TimeOfDayCell | null>(null)

  const {
    cells = [],
    max_hours = 0,
    total_hours = 0,
    peak_hour = 14,
    peak_hour_hours = 0,
    core_hours_pct = 0,
    night_owl_pct = 0,
    time_blocks = [],
    hourly_totals = [],
    excluded_date_only_count = 0,
  } = timeOfDay || {}

  const cellMap = useMemo(() => {
    const map = new Map<string, TimeOfDayCell>()
    for (const c of cells) {
      map.set(`${c.weekday}-${c.hour}`, c)
    }
    return map
  }, [cells])

  const maxHourlyTotal = Math.max(...hourly_totals, 1)

  if (!timeOfDay || cells.length === 0 || total_hours === 0) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Time of Day Activity Heatmap
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {excluded_date_only_count > 0
              ? `No timestamped timelogs recorded yet (${excluded_date_only_count} entries were logged with date-only defaults at exact hh:00:00).`
              : 'No timelogs recorded with timestamp data yet.'}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const formatHour = (h: number) => `${h.toString().padStart(2, '0')}:00`

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Time of Day Activity Heatmap
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Distribution of logged engineering time by day of week &times; hour of day (24-hour cycle)
              {excluded_date_only_count > 0
                ? ` • Excluded ${excluded_date_only_count} date-only ${excluded_date_only_count === 1 ? 'entry' : 'entries'} at exact hh:00:00`
                : ''}
              .
            </CardDescription>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted/30 border border-border/60">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-muted-foreground">Peak Hour:</span>
              <span className="font-semibold text-foreground">
                {formatHour(peak_hour)} ({peak_hour_hours}h)
              </span>
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted/30 border border-border/60">
              <Sun className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-muted-foreground">Core Hours (9-18):</span>
              <span className="font-semibold text-foreground">{core_hours_pct}%</span>
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted/30 border border-border/60">
              <Moon className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-muted-foreground">Night Owl (22-06):</span>
              <span className="font-semibold text-foreground">{night_owl_pct}%</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Time Blocks Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {time_blocks.map((block, idx) => {
            const Icon =
              idx === 0 ? Sunrise : idx === 1 ? Sun : idx === 2 ? Sunset : Moon
            return (
              <div
                key={block.name}
                className="p-2 rounded-md border border-border/40 bg-muted/20 text-xs"
              >
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="truncate text-[11px] font-medium">{block.name}</span>
                  <Icon className="h-3 w-3 shrink-0 opacity-70" />
                </div>
                <div className="mt-1 flex items-baseline justify-between font-mono">
                  <span className="text-sm font-semibold text-foreground">{block.hours}h</span>
                  <span className="text-[11px] text-muted-foreground">{block.percentage}%</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto no-scrollbar pt-1">
          <div className="min-w-[700px]">
            {/* Hour Scale Header */}
            <div className="grid grid-cols-[48px_repeat(24,1fr)] gap-1 text-[10px] font-mono text-muted-foreground mb-1 text-center">
              <div />
              {HOURS.map((h) => (
                <div key={h} className="truncate">
                  {h % 2 === 0 ? h.toString().padStart(2, '0') : ''}
                </div>
              ))}
            </div>

            {/* Weekday Rows */}
            <div className="space-y-1">
              {WEEKDAYS.map((w) => (
                <div
                  key={w.num}
                  className="grid grid-cols-[48px_repeat(24,1fr)] gap-1 items-center"
                >
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {w.short}
                  </span>
                  {HOURS.map((h) => {
                    const cell = cellMap.get(`${w.num}-${h}`)
                    const hours = cell?.total_hours || 0
                    const count = cell?.timelog_count || 0

                    let bgClass = 'bg-muted/30'
                    if (hours > 0 && max_hours > 0) {
                      const ratio = hours / max_hours
                      if (ratio > 0.75) bgClass = 'bg-primary text-primary-foreground font-semibold'
                      else if (ratio > 0.5) bgClass = 'bg-primary/80'
                      else if (ratio > 0.25) bgClass = 'bg-primary/50'
                      else bgClass = 'bg-primary/25'
                    }

                    return (
                      <div
                        key={h}
                        onMouseEnter={() => cell && cell.total_hours > 0 && setHoveredCell(cell)}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`h-6 rounded-xs flex items-center justify-center text-[10px] cursor-pointer transition-all hover:ring-1 hover:ring-foreground/40 ${bgClass}`}
                        title={`${w.short} ${formatHour(h)}: ${hours}h (${count} logs)`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Hourly Distribution Spark Bar */}
            <div className="mt-3 pt-2 border-t border-border/40">
              <div className="grid grid-cols-[48px_repeat(24,1fr)] gap-1 items-end h-8">
                <span className="text-[10px] font-mono text-muted-foreground self-center">
                  Total
                </span>
                {HOURS.map((h) => {
                  const hrs = hourly_totals[h] || 0
                  const heightPct = Math.round((hrs / maxHourlyTotal) * 100)
                  return (
                    <div
                      key={h}
                      className="h-full flex items-end justify-center"
                      title={`Hour ${formatHour(h)}: ${hrs}h aggregate`}
                    >
                      <div
                        className="w-full bg-primary/40 hover:bg-primary rounded-xs transition-colors"
                        style={{ height: `${Math.max(heightPct, hrs > 0 ? 12 : 2)}%` }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Hover Details Footer */}
        <div className="h-6 text-xs text-muted-foreground flex items-center justify-between font-mono pt-1">
          {hoveredCell ? (
            <div className="flex items-center gap-2 text-foreground">
              <span className="font-semibold">
                {hoveredCell.weekday_name} at {formatHour(hoveredCell.hour)} - {formatHour(hoveredCell.hour + 1)}:
              </span>
              <span>{hoveredCell.total_hours}h</span>
              <span className="text-muted-foreground">
                ({hoveredCell.timelog_count} {hoveredCell.timelog_count === 1 ? 'entry' : 'entries'})
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Hover over any slot in the 24h &times; 7d matrix for detailed hours.
            </span>
          )}

          <div className="flex items-center gap-1 text-[11px]">
            <span>Less</span>
            <div className="w-2.5 h-2.5 rounded-xs bg-muted/40" />
            <div className="w-2.5 h-2.5 rounded-xs bg-primary/25" />
            <div className="w-2.5 h-2.5 rounded-xs bg-primary/50" />
            <div className="w-2.5 h-2.5 rounded-xs bg-primary/80" />
            <div className="w-2.5 h-2.5 rounded-xs bg-primary" />
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
