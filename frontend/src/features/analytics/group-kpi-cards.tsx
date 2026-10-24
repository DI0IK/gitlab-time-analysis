import { Card, CardContent } from '@/components/ui/card'
import { Clock, Target, TrendingUp, Gauge } from 'lucide-react'

interface GroupKpiCardsProps {
  totalHours: number
  estimatedHours: number
  deltaHours: number
  accuracyRatio: number
}

export function GroupKpiCards({
  totalHours,
  estimatedHours,
  deltaHours,
  accuracyRatio,
}: GroupKpiCardsProps) {
  const isOver = deltaHours > 0
  const accuracyPct = Math.round(accuracyRatio * 100)

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Logged Effort</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
              {totalHours}
            </span>
            <span className="text-xs text-muted-foreground font-mono">hrs</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Actual tracked timelogs</p>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Estimated</span>
            <Target className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
              {estimatedHours}
            </span>
            <span className="text-xs text-muted-foreground font-mono">hrs</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Summed work item estimates</p>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Delta</span>
            <TrendingUp className={`h-4 w-4 ${isOver ? 'text-amber-500' : 'text-emerald-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
              {deltaHours > 0 ? `+${deltaHours}` : deltaHours}
            </span>
            <span className="text-xs text-muted-foreground font-mono">hrs</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isOver ? 'Over initial estimate' : 'Under initial estimate'}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Accuracy</span>
            <Gauge className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
              {accuracyPct}%
            </span>
            <span className="text-xs text-muted-foreground font-mono">ratio</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Logged vs Estimated ratio</p>
        </CardContent>
      </Card>
    </div>
  )
}
