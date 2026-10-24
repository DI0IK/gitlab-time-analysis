import { Info } from 'lucide-react'
import type { WeekdayHeatmapCellData } from './types'

interface HeatmapLegendProps {
  hoveredCell: WeekdayHeatmapCellData | null
}

export function HeatmapLegend({ hoveredCell }: HeatmapLegendProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/40 text-xs text-muted-foreground">
      {/* Active Hover Inspection */}
      <div className="min-h-[22px] flex items-center gap-2">
        {hoveredCell ? (
          <span className="inline-flex items-center gap-2 font-mono text-foreground animate-in fade-in duration-150">
            <span className="font-semibold text-primary flex items-center gap-1.5">
              Sprint {hoveredCell.sprint_number} &bull; {hoveredCell.weekday_name}
              {hoveredCell.is_current_day && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-primary/20 text-primary border border-primary/40">
                  Today
                </span>
              )}
              :
            </span>
            <span className="font-bold">{hoveredCell.total_hours.toFixed(1)} hours</span>
            <span className="text-muted-foreground">({hoveredCell.timelog_count} logged entries)</span>
          </span>
        ) : (
          <span className="text-muted-foreground/70 italic flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Hover any cell to inspect logged time and entries.
          </span>
        )}
      </div>

      {/* Color Scale Legend & Today Marker */}
      <div className="flex items-center gap-3 font-mono text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-[2px] border border-primary outline outline-1 outline-primary/60 bg-muted/30" />
          <span className="text-foreground font-medium">Today</span>
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-border/60">
          <span className="text-muted-foreground">Less</span>
          <span className="h-3.5 w-3.5 rounded-xs bg-muted/30 border border-border/50" title="0 hours" />
          <span className="h-3.5 w-3.5 rounded-xs bg-emerald-500/20 border border-emerald-500/30" title="Low activity" />
          <span className="h-3.5 w-3.5 rounded-xs bg-emerald-500/40 border border-emerald-500/50" title="Moderate activity" />
          <span className="h-3.5 w-3.5 rounded-xs bg-emerald-500/70 border border-emerald-500" title="High activity" />
          <span className="h-3.5 w-3.5 rounded-xs bg-emerald-600 dark:bg-emerald-500 border border-emerald-400" title="Peak activity" />
          <span className="text-muted-foreground">More</span>
        </div>
      </div>
    </div>
  )
}
