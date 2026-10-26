import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity, RefreshCw } from 'lucide-react'
import type { components } from '@/lib/api/schema'
import { filterActivityItems, groupActivityItems } from './activity-helpers'
import { ActivityToolbar } from './activity-toolbar'
import { ActivityItemCard } from './activity-item-card'
import { ActivityModals } from './activity-modals'

type GroupActivityItem = components['schemas']['GroupActivityItem']

export function GroupActivityView({ slug }: { slug: string }) {
  const [author, setAuthor] = React.useState('')
  const [sprint, setSprint] = React.useState('')
  const [activityType, setActivityType] = React.useState('all')
  const [search, setSearch] = React.useState('')
  const [offset, setOffset] = React.useState(0)
  const [selectedTarget, setSelectedTarget] = React.useState<GroupActivityItem | null>(null)
  const limit = 50

  const { data: members } = useQuery({
    queryKey: ['group-members', slug],
    queryFn: async () => {
      const { data } = await apiClient.GET('/api/groups/{slug}/members', { params: { path: { slug } } })
      return data || []
    },
  })

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['group-activity', slug, author, sprint, activityType, offset],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/groups/{slug}/activity', {
        params: {
          path: { slug },
          query: {
            author: author || undefined,
            sprint: sprint ? Number(sprint) : undefined,
            activity_type: activityType === 'all' ? undefined : activityType,
            limit,
            offset,
          },
        },
      })
      if (error || !data) throw new Error((error as unknown as { error?: string })?.error || 'Failed to load activity')
      return data
    },
  })

  const filteredItems = React.useMemo(() => filterActivityItems(data?.items || [], search), [data?.items, search])
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
              {data?.total_count || 0} events
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
        onActivityTypeChange={(t) => { setActivityType(t); setOffset(0); }}
        author={author}
        onAuthorChange={(a) => { setAuthor(a); setOffset(0); }}
        sprint={sprint}
        onSprintChange={(s) => { setSprint(s); setOffset(0); }}
        search={search}
        onSearchChange={setSearch}
        members={members || []}
        onReset={() => { setAuthor(''); setSprint(''); setActivityType('all'); setSearch(''); setOffset(0); }}
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
        <div className="space-y-8">
          {groupedItems.map((group) => (
            <div key={group.header} className="space-y-3">
              <div className="flex items-center gap-2 sticky top-28 z-20 bg-background/90 backdrop-blur-xs py-1">
                <span className="text-xs font-bold tracking-wide uppercase text-muted-foreground font-mono">{group.header}</span>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-border/50">
                {group.items.map((item) => (
                  <ActivityItemCard key={item.id} item={item} onSelectTarget={setSelectedTarget} />
                ))}
              </div>
            </div>
          ))}

          {data?.has_more && (
            <div className="text-center pt-4">
              <Button variant="outline" size="sm" onClick={() => setOffset((p) => p + limit)} disabled={isFetching} className="gap-2 text-xs font-mono">
                {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
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
