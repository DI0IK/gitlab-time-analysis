import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, Timer } from 'lucide-react'
import type { components } from '@/lib/api/schema'

type DeadlineRushMetric = components['schemas']['DeadlineRushMetric']

interface SprintDeadlineRushProps {
  deadlineRush?: DeadlineRushMetric
}

export function SprintDeadlineRushCard({ deadlineRush }: SprintDeadlineRushProps) {
  if (!deadlineRush || deadlineRush.sprints.length === 0) {
    return null
  }

  const { overall_rush_hours, overall_total_hours, rush_percentage, rating, explanation, sprints } =
    deadlineRush

  const isHighCrunch = rush_percentage > 40
  const isModerate = rush_percentage > 20 && rush_percentage <= 40

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">Sprint Deadline Rush Index</CardTitle>
              <Badge
                variant="outline"
                className={`text-xs font-mono ${
                  isHighCrunch
                    ? 'border-red-500/40 text-red-400'
                    : isModerate
                      ? 'border-amber-500/40 text-amber-400'
                      : 'border-emerald-500/40 text-emerald-400'
                }`}
              >
                {rating}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {explanation}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/30 border border-border/60">
              {isHighCrunch ? (
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span className="text-muted-foreground">Rush Ratio:</span>
              <span className="font-semibold text-foreground">{rush_percentage}%</span>
              <span className="text-muted-foreground">({overall_rush_hours}h / {overall_total_hours}h)</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-2">
          {sprints.map((s) => {
            const isSprintCrunch = s.rush_percentage > 40
            return (
              <div key={s.sprint_number} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Sprint {s.sprint_number}</span>
                  <span className="text-foreground">
                    {s.rush_hours}h in final 48h ({s.rush_percentage}% of {s.total_hours}h)
                  </span>
                </div>
                <div className="w-full bg-muted/40 h-2 rounded-xs overflow-hidden flex">
                  <div
                    className={`h-full rounded-xs transition-all ${
                      isSprintCrunch ? 'bg-red-500' : s.rush_percentage > 20 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(s.rush_percentage, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
