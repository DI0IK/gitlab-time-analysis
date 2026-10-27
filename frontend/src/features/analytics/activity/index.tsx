import * as React from 'react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity, RefreshCw } from 'lucide-react'
import type { components } from '@/lib/api/schema'
import { filterActivityItems, groupActivityItems } from './activity-helpers'
import { ActivityToolbar } from './activity-toolbar'
import { ActivityGroupList } from './activity-list'
import { ActivityModals } from './activity-modals'

type GroupActivityItem = components['schemas']['GroupActivityItem']

import { useTenant } from '@/features/tenant/tenant-context'
import { apiKeys } from '@/lib/api/keys'

export function GroupActivityView({
  slug,
  rootSlug: propRootSlug,
  groupSlug: propGroupSlug,
}: {
  slug?: string
  rootSlug?: string
  groupSlug?: string
}) {
  const tenant = useTenant()
  const effectiveRootSlug = propRootSlug || tenant.rootSlug
  const effectiveGroupSlug = propGroupSlug || slug || tenant.groupSlug || ''

  const [author, setAuthor] = React.useState('')
  const [sprint, setSprint] = React.useState('')
  const [activityType, setActivityType] = React.useState('all')
  const [search, setSearch] = React.useState('')
  const [selectedTarget, setSelectedTarget] = React.useState<GroupActivityItem | null>(null)
  const limit = 50

  const { data: members } = useQuery({
    queryKey: apiKeys.rootGroupMembers(effectiveRootSlug, effectiveGroupSlug),
    queryFn: async () => {
      const { data } = await apiClient.GET('/api/{root_slug}/groups/{group_slug}/members', {
        params: { path: { root_slug: effectiveRootSlug, group_slug: effectiveGroupSlug } },
      })
      return data || []
    },
    enabled: Boolean(effectiveRootSlug && effectiveGroupSlug),
  })

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: apiKeys.rootActivity(effectiveRootSlug, effectiveGroupSlug, {
      author,
      sprint,
      activityType,
    }),
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await apiClient.GET('/api/{root_slug}/groups/{group_slug}/activity', {
        params: {
          path: { root_slug: effectiveRootSlug, group_slug: effectiveGroupSlug },
          query: {
            author: author || undefined,
            sprint: sprint ? Number(sprint) : undefined,
            activity_type: activityType === 'all' ? undefined : (activityType as any),
            limit,
            offset: pageParam,
          },
        },
      })
      if (error || !data) throw new Error((error as unknown as { error?: string })?.error || 'Failed to load activity')
      return data
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined
      return allPages.length * limit
    },
  })

  const allItems = React.useMemo(() => data?.pages.flatMap((p) => p.items) || [], [data?.pages])
  const totalCount = data?.pages[0]?.total_count || 0
  const filteredItems = React.useMemo(() => filterActivityItems(allItems, search), [allItems, search])
  const groupedItems = React.useMemo(() => groupActivityItems(filteredItems), [filteredItems])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Group Activity
            </h1>
            <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/30">
              {totalCount} events
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time unified activity stream across issues, work items, merge requests, comments, and timelogs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="text-xs gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      <ActivityToolbar
        activityType={activityType}
        onActivityTypeChange={setActivityType}
        author={author}
        onAuthorChange={setAuthor}
        sprint={sprint}
        onSprintChange={setSprint}
        search={search}
        onSearchChange={setSearch}
        members={members || []}
        onReset={() => { setAuthor(''); setSprint(''); setActivityType('all'); setSearch(''); }}
      />

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-6 w-32 bg-muted/60 rounded" />
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-muted/30 rounded-lg border border-border/40" />)}
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-lg border border-border/60 bg-card/60">
          <Activity className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h3 className="text-base font-semibold">Unable to Load Group Activity</h3>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/60 rounded-xl bg-card/30">
          <Activity className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No Activity Events Found</h3>
        </div>
      ) : (
        <div className="space-y-6">
          <ActivityGroupList groups={groupedItems} onSelectTarget={setSelectedTarget} />
          {hasNextPage && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="gap-2 text-xs font-mono"
              >
                {isFetchingNextPage && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Load More Activities
              </Button>
            </div>
          )}
        </div>
      )}

      <ActivityModals selectedTarget={selectedTarget} slug={slug} onClose={() => setSelectedTarget(null)} />
    </div>
  )
}
