import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { GroupKpiCards } from './group-kpi-cards'
import { GroupFairnessCard } from './group-fairness-card'
import { GroupCategoriesCard } from './group-categories-card'
import { GroupMembersTable } from './group-members-table'
import { GroupSprintChart } from './group-sprint-chart'
import { GroupWeekdayHeatmap } from './group-weekday-heatmap'
import { SprintMatrixTable } from './sprint-matrix'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, ExternalLink } from 'lucide-react'

import { useTenant } from '@/features/tenant/tenant-context'
import { apiKeys } from '@/lib/api/keys'

export function GroupAnalyticsView({
  rootSlug: propRootSlug,
  groupSlug: propGroupSlug,
  slug,
}: {
  rootSlug?: string
  groupSlug?: string
  slug?: string
}) {
  const tenant = useTenant()
  const effectiveRootSlug = propRootSlug || tenant.rootSlug
  const effectiveGroupSlug = propGroupSlug || slug || tenant.groupSlug || ''

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: apiKeys.rootDashboard(effectiveRootSlug, effectiveGroupSlug),
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/{root_slug}/groups/{group_slug}/dashboard',
        {
          params: {
            path: {
              root_slug: effectiveRootSlug,
              group_slug: effectiveGroupSlug,
            },
          },
        }
      )
      if (error || !data) {
        throw new Error(
          (error as unknown as { error?: string })?.error ||
            'Failed to load group dashboard'
        )
      }
      return data
    },
    enabled: Boolean(effectiveRootSlug && effectiveGroupSlug),
  })

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-muted/60 rounded-md" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted/40 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-muted/40 rounded-lg" />
          <div className="h-64 bg-muted/40 rounded-lg" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center rounded-lg border border-border/60 bg-card/60">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
        <h3 className="text-base font-semibold">Unable to Load Group Analytics</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  const { group, total_hours, estimated_hours, delta_hours, accuracy_ratio, fairness, categories, sprints, members } = data

  return (
    <div className="space-y-6">
      {/* Header with Title and GitLab Link */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight font-display text-foreground">
              {group.name}
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              Level {group.level}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 font-mono">
            {group.full_path}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 min-h-[44px] sm:min-h-[36px]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <a
            href={group.web_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground min-h-[44px] sm:min-h-[36px] gap-1.5 transition-colors"
          >
            <span>GitLab</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <GroupKpiCards
        totalHours={total_hours}
        estimatedHours={estimated_hours}
        deltaHours={delta_hours}
        accuracyRatio={accuracy_ratio}
      />

      {/* Fairness & Activity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GroupFairnessCard fairness={fairness} />
        <GroupCategoriesCard categories={categories} />
      </div>

      {/* Sprint Cadence Chart */}
      <GroupSprintChart sprints={sprints} />

      {/* Weekday x Sprint Activity Heatmap */}
      <GroupWeekdayHeatmap heatmap={data.heatmap} />

      {/* Historical Progress: User x Category Matrix Table */}
      <SprintMatrixTable
        matrix={data.matrix || []}
        sprints={sprints}
        currentSprint={data.current_sprint}
        defaultSprint={data.default_sprint}
      />

      {/* Team Member Effort Multipliers */}
      <GroupMembersTable members={members} />
    </div>
  )
}
