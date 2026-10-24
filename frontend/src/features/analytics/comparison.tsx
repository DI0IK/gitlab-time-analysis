import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { BarChart3, Clock, ShieldCheck, ArrowRight, Award } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'

export function ComparisonView() {
  const { data: meta } = useQuery({
    queryKey: apiKeys.meta,
    queryFn: async () => {
      const res = await apiClient.GET('/api/meta')
      return res.data
    },
  })

  const { data: groups } = useQuery({
    queryKey: apiKeys.groups,
    queryFn: async () => (await apiClient.GET('/api/groups')).data,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            Group Comparison & Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-group sprint progression, effort distribution, and fairness metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            Backend Sync Active
          </Badge>
        </div>
      </div>

      {/* Live System Metadata Cards from /api/meta */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Sprint Cadence</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{meta?.sprint_duration_weeks ?? 1} Week</div>
            <p className="text-xs text-muted-foreground mt-1">Starts on {meta?.sprint_start_weekday ?? 'Monday'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Work Taxonomy</CardTitle>
            <BarChart3 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{meta?.categories.length ?? 5} Categories</div>
            <p className="text-xs text-muted-foreground mt-1">PM, RE, Impl, Arch & Other</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Gamification Catalog</CardTitle>
            <Award className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{meta?.badges.length ?? 31} Badges</div>
            <p className="text-xs text-muted-foreground mt-1">4 Tiers across 7 tracks</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cohort Groups</CardTitle>
          <CardDescription>
            Discovered {groups?.length ?? 0} active cohort groups from GitLab
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/50 divide-y divide-border/40">
            {groups && groups.length > 0 ? (
              groups.map((g) => {
                const slug = g.full_path.replace(/\//g, '-')
                return (
                  <div key={g.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-muted/30 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{g.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {g.level === 0 ? 'Root Cohort' : `Level ${g.level}`}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{g.full_path}</p>
                    </div>
                    <Link to="/groups/$slug" params={{ slug }}>
                      <Button size="sm" variant="glass" className="gap-1.5 text-xs w-full sm:w-auto">
                        Inspect Analytics
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                )
              })
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No cohort groups synced yet. Run sync from background scheduler or trigger manually.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
