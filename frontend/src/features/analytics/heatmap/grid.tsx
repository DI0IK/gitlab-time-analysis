import * as React from 'react'
import { getOrderedWeekdays, type WeekdayHeatmapCellData } from './types'
import { HeatmapCell } from './cell'

interface HeatmapGridProps {
  sprintNumbers: number[]
  cellMap: Map<string, WeekdayHeatmapCellData>
  maxHours: number
  sprintStartWeekday?: string
  onHoverCell: (cell: WeekdayHeatmapCellData | null) => void
}

export function HeatmapGrid({
  sprintNumbers,
  cellMap,
  maxHours,
  sprintStartWeekday,
  onHoverCell,
}: HeatmapGridProps) {
  const totalSprints = sprintNumbers.length

  const orderedWeekdays = React.useMemo(() => {
    return getOrderedWeekdays(sprintStartWeekday)
  }, [sprintStartWeekday])

  // Determine sprint label step interval based on total number of sprints
  const labelInterval = React.useMemo(() => {
    if (totalSprints <= 12) return 1
    if (totalSprints <= 24) return 2
    if (totalSprints <= 50) return 5
    return 10
  }, [totalSprints])

  return (
    <div className="overflow-x-auto pb-2 scrollbar-thin">
      <div className="inline-flex items-start select-none py-1">
        {/* Weekday Row Labels (Starting from configured sprint start weekday) */}
        <div className="flex flex-col gap-[3px] text-[9px] font-mono text-muted-foreground/70 text-right pr-2 shrink-0">
          {/* Header spacer */}
          <div className="h-[14px] mb-[2px]" />
          {orderedWeekdays.map((w) => (
            <div
              key={w.num}
              className="h-[11px] sm:h-[12px] flex items-center justify-end leading-none"
            >
              {w.showLabel ? w.short : ''}
            </div>
          ))}
        </div>

        {/* Sprint Columns Grid (GitHub-style) */}
        <div className="flex items-start gap-[3px]">
          {sprintNumbers.map((sNum) => {
            const isFirst = sNum === 1
            const isLabeled = isFirst || sNum % labelInterval === 0

            return (
              <div key={sNum} className="flex flex-col gap-[3px] shrink-0">
                {/* Sprint Header Marker */}
                <div className="h-[14px] mb-[2px] text-[9px] font-mono text-muted-foreground/80 leading-none flex items-center">
                  {isLabeled ? (
                    <span className="whitespace-nowrap -ml-0.5" title={`Sprint ${sNum}`}>
                      {totalSprints <= 15 ? `S${sNum}` : isFirst || sNum % 10 === 0 ? `S${sNum}` : `${sNum}`}
                    </span>
                  ) : null}
                </div>

                {/* 7 Days of the Week starting on configured sprint start day */}
                {orderedWeekdays.map((w) => {
                  const cell = cellMap.get(`${sNum}-${w.num}`)

                  return (
                    <HeatmapCell
                      key={w.num}
                      sprintNumber={sNum}
                      weekday={w.num}
                      weekdayName={w.full}
                      cell={cell}
                      maxHours={maxHours}
                      onHover={onHoverCell}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
