import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GitPullRequest, GitMerge, ExternalLink, RefreshCw, GitBranch, MessageSquare, FolderGit2 } from 'lucide-react'
import { getRelativePath, formatStatus } from '@/lib/format'
import { MergeRequestModal, type MergeRequestModalData } from './mr-modal'

import { useTenant } from '@/features/tenant/tenant-context'
import { apiKeys } from '@/lib/api/keys'

export function MergeRequestsView({
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

  const [stateFilter, setStateFilter] = React.useState<string>('all')
  const [search, setSearch] = React.useState('')
  const [selectedMr, setSelectedMr] = React.useState<MergeRequestModalData | null>(null)

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: apiKeys.rootMergeRequests(effectiveRootSlug, effectiveGroupSlug),
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/{root_slug}/groups/{group_slug}/merge-requests',
        {
          params: {
            path: {
              root_slug: effectiveRootSlug,
              group_slug: effectiveGroupSlug,
            },
          },
        }
      )
      if (error || !data) throw new Error('Failed to load merge requests')
      return data as MergeRequestModalData[]
    },
    enabled: Boolean(effectiveRootSlug && effectiveGroupSlug),
  })

  const filtered = (data || []).filter((mr) => {
    const matchesState = stateFilter === 'all' || mr.state.toLowerCase() === stateFilter.toLowerCase()
    return matchesState && (mr.title.toLowerCase().includes(search.toLowerCase()) || String(mr.iid).includes(search))
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight font-display">Merge Request Suite</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Review flow, diffs, repository origins, and discussion activity for {slug}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
            {['all', 'merged', 'opened', 'closed'].map((s) => (
              <button key={s} onClick={() => setStateFilter(s)} className={`px-3 py-1 text-xs font-medium rounded-md uppercase min-h-[44px] sm:min-h-[32px] ${stateFilter === s ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>
                {s}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="min-h-[44px] sm:min-h-[36px]">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <input type="text" placeholder="Filter by title, repository, or !IID..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[44px]" />

      {isLoading ? (
        <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
      ) : error ? (
        <div className="p-8 text-center rounded-lg border border-border bg-card/60 text-muted-foreground">Failed to load merge requests.</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-lg border border-dashed border-border/60 text-muted-foreground text-sm">No merge requests found matching criteria.</div>
      ) : (
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Showing {filtered.length} merge requests (click to view details)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {filtered.map((mr) => {
                const isMerged = mr.state === 'merged'
                const isClosed = mr.state === 'closed'
                const badgeVariant = isMerged ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20' : isClosed ? 'bg-muted/50 text-muted-foreground' : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20'
                const relRepo = getRelativePath(mr.project_path, slug)

                return (
                  <div
                    key={mr.id}
                    onClick={() => setSelectedMr(mr)}
                    className="p-3 sm:px-4 hover:bg-muted/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer min-h-[52px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] uppercase font-mono ${badgeVariant}`}>
                          {isMerged ? <GitMerge className="h-3 w-3 mr-1 inline" /> : null}
                          {formatStatus(mr.state)}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">!{mr.iid}</span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-xs border border-primary/20">
                          <FolderGit2 className="h-3 w-3 shrink-0" />
                          <span>{relRepo}</span>
                        </span>
                        <span className="text-sm font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1 truncate">
                          {mr.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap font-mono">
                        <span>@{mr.author_username}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-[11px] bg-muted/40 px-1.5 py-0.5 rounded-xs">
                          <GitBranch className="h-3 w-3" />
                          <span>{mr.source_branch} &rarr; {mr.target_branch}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-500 font-semibold">+{mr.additions}</span>
                        <span className="text-rose-500 font-semibold">-{mr.deletions}</span>
                      </div>
                      {mr.discussion_count > 0 && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{mr.discussion_count}</span>
                        </div>
                      )}
                      <a
                        href={mr.web_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded-sm text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <MergeRequestModal mr={selectedMr} slug={slug} onClose={() => setSelectedMr(null)} />
    </div>
  )
}
