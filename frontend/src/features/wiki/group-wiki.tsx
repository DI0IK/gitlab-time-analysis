import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Folder, Layers } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import { WikiPane } from './wiki-pane'

interface WikiTargetItem {
  path: string
  name: string
  target_type: string
  has_wiki: boolean
  page_count: number
}

export function GroupWikiView({ slug }: { slug: string }) {
  const [selectedPath, setSelectedPath] = React.useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('target')
    }
    return null
  })

  // Fetch wiki targets for this group
  const { data: allTargets = [], isLoading } = useQuery({
    queryKey: apiKeys.wikiTargets(slug),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/groups/{slug}/wiki/targets', {
        params: { path: { slug } },
      })
      if (error || !data) throw new Error('Failed to load wiki targets')
      return data as WikiTargetItem[]
    },
  })

  // Filter only group & subgroup targets (projects belong in the code browser)
  const groupTargets = React.useMemo(() => {
    return allTargets.filter((t) => t.target_type === 'group' || t.target_type === 'subgroup')
  }, [allTargets])

  // Derive active target path
  const activePath = React.useMemo(() => {
    if (selectedPath && groupTargets.some((t) => t.path === selectedPath)) {
      return selectedPath
    }
    const withWiki = groupTargets.find((t) => t.has_wiki)
    return withWiki ? withWiki.path : (groupTargets[0]?.path || '')
  }, [groupTargets, selectedPath])

  // Sync selected target to URL search params
  React.useEffect(() => {
    if (typeof window === 'undefined' || !activePath) return
    const params = new URLSearchParams(window.location.search)
    params.set('target', activePath)
    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState({}, '', newUrl)
  }, [activePath])

  const activeTargetItem = groupTargets.find((t) => t.path === activePath)

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-muted/40 rounded w-1/3" />
        <div className="h-96 bg-muted/20 rounded w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Group & Subgroup Pills Selector (if more than 1 target) */}
      {groupTargets.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {groupTargets.map((t) => {
            const isSelected = t.path === activePath
            return (
              <button
                key={t.path}
                onClick={() => setSelectedPath(t.path)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
                  isSelected
                    ? 'bg-primary/15 text-primary border-primary/40 shadow-xs'
                    : 'bg-card/60 text-muted-foreground hover:text-foreground border-border/50 hover:bg-card'
                }`}
              >
                {t.target_type === 'group' ? (
                  <Folder className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Layers className="h-3.5 w-3.5 text-blue-400" />
                )}
                <span>{t.name}</span>
                {t.has_wiki && t.page_count > 0 && (
                  <span className="text-[10px] bg-background/80 px-1.5 py-0.2 rounded font-mono opacity-80">
                    {t.page_count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Render WikiPane for the active group/subgroup */}
      {activePath ? (
        <WikiPane
          targetPath={activePath}
          title={activeTargetItem?.name || slug}
          gitlabDomain="https://gitlab.com"
        />
      ) : (
        <div className="text-center py-16 text-muted-foreground border border-border/60 rounded-lg bg-card/40">
          <BookOpen className="h-10 w-10 mx-auto opacity-30 mb-2" />
          <p className="font-semibold text-sm">No group wikis available</p>
        </div>
      )}
    </div>
  )
}
