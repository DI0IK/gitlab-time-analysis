import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Activity } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

interface SprintItem {
  sprint_number: number
  total_seconds: number
  total_hours: number
  cumulative_hours: number
  active_members: number
}

interface GroupSprintChartProps {
  sprints: SprintItem[]
}

export function GroupSprintChart({ sprints }: GroupSprintChartProps) {
  const chartData = sprints.map((s) => ({
    name: `Sprint ${s.sprint_number}`,
    hours: s.total_hours,
    cumulative: s.cumulative_hours,
    active: s.active_members,
  }))

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Sprint Cadence & Velocity
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {sprints.length} sprints recorded
          </span>
        </div>
        <CardDescription className="text-xs">
          Tracked effort hours dedicated across course milestones and sprints.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sprints.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No sprint milestone logs available yet.
          </div>
        ) : (
          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="#888888"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="#888888"
                  unit="h"
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="rounded-md border border-border bg-popover p-2 shadow-md text-xs">
                          <p className="font-semibold text-foreground">{data.name}</p>
                          <p className="text-muted-foreground font-mono">
                            Sprint Effort: <span className="text-primary font-bold">{data.hours}h</span>
                          </p>
                          <p className="text-muted-foreground font-mono text-[11px]">
                            Cumulative: {data.cumulative}h ({data.active} active members)
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="hours" fill="var(--color-primary, #6366f1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
