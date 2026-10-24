import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ListTodo, Search, RefreshCw, FolderTree, List, FolderGit2 } from 'lucide-react'
import { WorkItemModal, type WorkItemModalData } from './work-item-modal'
import { WorkItemTreeNode } from './work-item-tree-node'

export function WorkItemsExplorer({ slug }: { slug: string }) {
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<string>('all')
  const [stateFilter, setStateFilter] = React.useState<string>('all')
  const [repoFilter, setRepoFilter] = React.useState<string>('all')
  const [viewMode, setViewMode] = React.useState<'tree' | 'flat'>('tree')
  const [selectedItem, setSelectedItem] = React.useState<WorkItemModalData | null>(null)
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['work-items', slug],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/groups/{slug}/work-items', {
        params: { path: { slug } },
      })
      if (error || !data) throw new Error('Failed to load work items')
      return data as WorkItemModalData[]
    },
  })

  const availableRepos = React.useMemo(() => {
    const repos = new Set<string>()
    for (const item of data || []) {
      if (item.project_path) {
        repos.add(item.project_path)
      }
    }
    return Array.from(repos).sort()
  }, [data])

  const filtered = React.useMemo(() => {
    return (data || []).filter((item) => {
      const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || String(item.iid).includes(search)
      const matchesType = typeFilter === 'all' || item.work_item_type.toLowerCase() === typeFilter.toLowerCase()
      const matchesRepo = repoFilter === 'all' || item.project_path === repoFilter
      const itemState = item.state.toLowerCase()
      const matchesState =
        stateFilter === 'all' ||
        ((stateFilter === 'open' || stateFilter === 'opened') && (itemState === 'open' || itemState === 'opened')) ||
        itemState === stateFilter.toLowerCase()
      return matchesSearch && matchesType && matchesRepo && matchesState
    })
  }, [data, search, typeFilter, repoFilter, stateFilter])

  const { rootItems, childrenMap } = React.useMemo(() => {
    const map = new Map<string, WorkItemModalData[]>()
    const idSet = new Set(filtered.map((item) => item.id))

    for (const item of filtered) {
      if (item.parent_id && idSet.has(item.parent_id)) {
        const list = map.get(item.parent_id) || []
        list.push(item)
        map.set(item.parent_id, list)
      }
    }

    return { rootItems: filtered.filter((i) => !i.parent_id || !idSet.has(i.parent_id)), childrenMap: map }
  }, [filtered])

  const handleToggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const expandAll = () => setExpanded(new Set(filtered.map((i) => i.id)))
  const collapseAll = () => setExpanded(new Set())

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight font-display">Work Items Explorer</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Hierarchical tree view of GitLab Epics, Issues, and Tasks for {slug}.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
            <button onClick={() => setViewMode('tree')} className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 min-h-[36px] ${viewMode === 'tree' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground'}`}><FolderTree className="h-3.5 w-3.5" /> Tree</button>
            <button onClick={() => setViewMode('flat')} className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 min-h-[36px] ${viewMode === 'flat' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground'}`}><List className="h-3.5 w-3.5" /> Flat</button>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="min-h-[44px] sm:min-h-[36px]">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search work items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[44px]"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
            {['all', 'epic', 'issue', 'task'].map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`px-2.5 py-1 text-xs font-medium rounded-md uppercase min-h-[36px] ${typeFilter === t ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>{t}</button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
            {['all', 'open', 'closed'].map((s) => (
              <button key={s} onClick={() => setStateFilter(s)} className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize min-h-[36px] ${stateFilter === s ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>{s}</button>
            ))}
          </div>

          {availableRepos.length > 0 && (
            <div className="relative inline-flex items-center">
              <FolderGit2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={repoFilter}
                onChange={(e) => setRepoFilter(e.target.value)}
                className="rounded-lg border border-border bg-muted/40 pl-8 pr-3 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[36px]"
              >
                <option value="all">All Repositories</option>
                {availableRepos.map((repo) => (
                  <option key={repo} value={repo}>
                    {repo.split('/').pop() || repo}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
      ) : error ? (
        <div className="p-8 text-center rounded-lg border border-border text-muted-foreground">Failed to load work items.</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-lg border border-dashed border-border/60 text-muted-foreground text-sm">No work items match criteria.</div>
      ) : (
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Showing {filtered.length} work items {viewMode === 'tree' ? `(${rootItems.length} top-level)` : ''}</CardTitle>
              {viewMode === 'tree' && (
                <div className="flex items-center gap-2">
                  <button onClick={expandAll} className="text-xs text-primary hover:underline cursor-pointer">Expand All</button>
                  <span className="text-muted-foreground text-xs">•</span>
                  <button onClick={collapseAll} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Collapse All</button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 space-y-1">
            {(viewMode === 'tree' ? rootItems : filtered).map((item) => (
              <WorkItemTreeNode
                key={item.id}
                item={item}
                childrenMap={viewMode === 'tree' ? childrenMap : new Map()}
                depth={0}
                expanded={expanded}
                slug={slug}
                onToggle={handleToggle}
                onSelect={setSelectedItem}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <WorkItemModal item={selectedItem} slug={slug} onClose={() => setSelectedItem(null)} />
    </div>
  )
}
