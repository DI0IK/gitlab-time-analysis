import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { BookOpen, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import { Button } from '@/components/ui/button'
import { WikiPane } from './wiki-pane'
import { WikiTargetTreeDropdown, type WikiTargetItem } from './wiki-target-dropdown'

export function GroupWikiView({ slug }: { slug: string }) {
  const search = useSearch({ from: '/groups/$slug/wiki' })
  const navigate = useNavigate({ from: '/groups/$slug/wiki' })

  // Fetch all wiki targets (group, subgroups, and project repos)
  const {
    data: allTargets = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: apiKeys.wikiTargets(slug),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/groups/{slug}/wiki/targets', {
        params: { path: { slug } },
      })
      if (error || !data) throw new Error('Failed to load wiki targets')
      return data as WikiTargetItem[]
    },
  })

  // Sort targets: with wikis first, then by group -> subgroup -> project
  const sortedTargets = React.useMemo(() => {
    return [...allTargets].sort((a, b) => {
      if (a.has_wiki && !b.has_wiki) return -1
      if (!a.has_wiki && b.has_wiki) return 1
      const order: Record<string, number> = { group: 0, subgroup: 1, project: 2 }
      const ordA = order[a.target_type] ?? 3
      const ordB = order[b.target_type] ?? 3
      if (ordA !== ordB) return ordA - ordB
      return a.name.localeCompare(b.name)
    })
  }, [allTargets])

  // Derive active target path
  const activePath = React.useMemo(() => {
    if (search.target && allTargets.some((t) => t.path === search.target)) {
      return search.target
    }
    const withWiki = sortedTargets.find((t) => t.has_wiki)
    return withWiki ? withWiki.path : sortedTargets[0]?.path || ''
  }, [allTargets, sortedTargets, search.target])

  // Sync default target into router search if not set
  React.useEffect(() => {
    if (!search.target && activePath) {
      navigate({
        search: (prev) => ({ ...prev, target: activePath }),
        replace: true,
      })
    }
  }, [search.target, activePath, navigate])

  const activeTargetItem = allTargets.find((t) => t.path === activePath)

  const handleSelectTarget = (path: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        target: path,
        page: undefined,
        rev: undefined,
      }),
    })
  }

  const handlePageChange = (newPage: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        page: newPage,
        rev: undefined,
      }),
    })
  }

  const handleRevisionChange = (newRev: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        rev: newRev || undefined,
      }),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-muted/40 rounded-xl w-1/3" />
        <div className="h-96 bg-muted/20 rounded-xl w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top Bar with Tree Dropdown and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/40">
        <div className="flex items-center gap-3">
          <WikiTargetTreeDropdown
            targets={sortedTargets}
            selectedPath={activePath}
            onSelect={handleSelectTarget}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="self-end sm:self-auto gap-1.5 text-xs h-9 px-3"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Render WikiPane for the active wiki target */}
      {activePath ? (
        <WikiPane
          key={activePath}
          targetPath={activePath}
          title={activeTargetItem?.name || slug}
          gitlabDomain="https://gitlab.com"
          page={search.page}
          rev={search.rev}
          onPageChange={handlePageChange}
          onRevisionChange={handleRevisionChange}
        />
      ) : (
        <div className="text-center py-16 text-muted-foreground border border-border/60 rounded-xl bg-card/40">
          <BookOpen className="h-10 w-10 mx-auto opacity-30 mb-2" />
          <p className="font-semibold text-sm">No documentation wikis available</p>
        </div>
      )}
    </div>
  )
}
