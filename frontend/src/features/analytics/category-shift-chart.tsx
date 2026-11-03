import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import type { components } from '@/lib/api/schema'
import { CATEGORY_SHIFT_CONFIG, CATEGORY_COLORS } from '@/lib/categories'

type CategorySprintShift = components['schemas']['CategorySprintShift']

interface CategoryShiftChartProps {
  shifts?: CategorySprintShift[]
}

export function CategoryShiftChart({ shifts = [] }: CategoryShiftChartProps) {
  if (shifts.length === 0) {
    return null
  }

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">Category Shift Over Time</CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Evolution of effort composition across sprint cycles (transition from PM &amp; Architecture to Implementation).
            </CardDescription>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            {CATEGORY_SHIFT_CONFIG.map((c) => (
              <div key={c.key} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: c.color }} />
                <span className="text-muted-foreground">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-2">
          {shifts.map((s) => {
            const tot = s.total_hours > 0 ? s.total_hours : 1
            const pmPct = (s.pm_hours / tot) * 100
            const rePct = (s.re_hours / tot) * 100
            const implPct = (s.impl_hours / tot) * 100
            const archPct = (s.arch_hours / tot) * 100
            const otherPct = (s.other_hours / tot) * 100

            return (
              <div key={s.sprint_number} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-foreground font-medium">Sprint {s.sprint_number}</span>
                  <span className="text-muted-foreground">
                    {s.total_hours}h total • PM: {s.pm_hours}h, RE: {s.re_hours}h, Impl: {s.impl_hours}h, Arch: {s.arch_hours}h
                  </span>
                </div>
                <div className="w-full bg-muted/40 h-3 rounded-xs overflow-hidden flex">
                  {s.pm_hours > 0 && (
                    <div
                      style={{ width: `${pmPct}%`, backgroundColor: CATEGORY_COLORS.pm }}
                      title={`PM: ${s.pm_hours}h (${pmPct.toFixed(0)}%)`}
                    />
                  )}
                  {s.re_hours > 0 && (
                    <div
                      style={{ width: `${rePct}%`, backgroundColor: CATEGORY_COLORS.re }}
                      title={`RE: ${s.re_hours}h (${rePct.toFixed(0)}%)`}
                    />
                  )}
                  {s.impl_hours > 0 && (
                    <div
                      style={{ width: `${implPct}%`, backgroundColor: CATEGORY_COLORS.impl }}
                      title={`Impl: ${s.impl_hours}h (${implPct.toFixed(0)}%)`}
                    />
                  )}
                  {s.arch_hours > 0 && (
                    <div
                      style={{ width: `${archPct}%`, backgroundColor: CATEGORY_COLORS.arch }}
                      title={`Arch: ${s.arch_hours}h (${archPct.toFixed(0)}%)`}
                    />
                  )}
                  {s.other_hours > 0 && (
                    <div
                      style={{ width: `${otherPct}%`, backgroundColor: CATEGORY_COLORS.other }}
                      title={`Other: ${s.other_hours}h (${otherPct.toFixed(0)}%)`}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
