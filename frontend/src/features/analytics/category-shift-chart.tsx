import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import type { components } from '@/lib/api/schema'

type CategorySprintShift = components['schemas']['CategorySprintShift']

interface CategoryShiftChartProps {
  shifts?: CategorySprintShift[]
}

const CATEGORY_COLORS = [
  { key: 'pm_hours', label: 'PM', color: '#c084fc', bgClass: 'bg-purple-500' },
  { key: 're_hours', label: 'Req Eng', color: '#60a5fa', bgClass: 'bg-blue-500' },
  { key: 'impl_hours', label: 'Impl', color: '#34d399', bgClass: 'bg-emerald-500' },
  { key: 'arch_hours', label: 'Arch', color: '#fbbf24', bgClass: 'bg-amber-500' },
  { key: 'other_hours', label: 'Other', color: '#94a3b8', bgClass: 'bg-slate-400' },
] as const

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
            {CATEGORY_COLORS.map((c) => (
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
                      style={{ width: `${pmPct}%`, backgroundColor: '#c084fc' }}
                      title={`PM: ${s.pm_hours}h (${pmPct.toFixed(0)}%)`}
                    />
                  )}
                  {s.re_hours > 0 && (
                    <div
                      style={{ width: `${rePct}%`, backgroundColor: '#60a5fa' }}
                      title={`RE: ${s.re_hours}h (${rePct.toFixed(0)}%)`}
                    />
                  )}
                  {s.impl_hours > 0 && (
                    <div
                      style={{ width: `${implPct}%`, backgroundColor: '#34d399' }}
                      title={`Impl: ${s.impl_hours}h (${implPct.toFixed(0)}%)`}
                    />
                  )}
                  {s.arch_hours > 0 && (
                    <div
                      style={{ width: `${archPct}%`, backgroundColor: '#fbbf24' }}
                      title={`Arch: ${s.arch_hours}h (${archPct.toFixed(0)}%)`}
                    />
                  )}
                  {s.other_hours > 0 && (
                    <div
                      style={{ width: `${otherPct}%`, backgroundColor: '#94a3b8' }}
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
