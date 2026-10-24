import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Scale, Info } from 'lucide-react'

interface FairnessMetricProps {
  fairness: {
    mean_hours: number
    std_dev: number
    coefficient_of_variation: number
    rating: string
    explanation: string
  }
}

export function GroupFairnessCard({ fairness }: FairnessMetricProps) {
  const isBalanced = fairness.rating === 'Balanced'
  const isSlight = fairness.rating === 'Slight Disparity'

  const badgeVariant = isBalanced
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    : isSlight
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20'

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Effort Balance & Fairness
          </CardTitle>
          <Badge variant="outline" className={`font-mono text-xs px-2 py-0.5 ${badgeVariant}`}>
            {fairness.rating}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Statistical distribution across active teammates (Coefficient of Variation).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-md bg-muted/30 border border-border/40 text-center">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">CV Score</div>
            <div className="text-lg font-bold font-mono text-foreground">
              {fairness.coefficient_of_variation.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Mean Effort</div>
            <div className="text-lg font-bold font-mono text-foreground">
              {fairness.mean_hours.toFixed(1)}h
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Std Dev</div>
            <div className="text-lg font-bold font-mono text-foreground">
              ±{fairness.std_dev.toFixed(1)}h
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-accent/30 p-2.5 rounded-md border border-border/30">
          <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <span>{fairness.explanation}</span>
        </div>
      </CardContent>
    </Card>
  )
}
