import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import {
  BarChart3,
  Clock,
  ShieldCheck,
  ArrowRight,
  Award,
  ChevronDown,
  ChevronRight,
  Layers,
  Users,
  Search,
  FolderTree,
  Scale,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import { buildGroupTree, filterTree, getAllNodeIds, type GroupTreeNode } from '@/lib/groups-tree'
import type { components } from '@/lib/api/schema'

type GroupComparisonSummary = components['schemas']['GroupComparisonSummary']

import { useTenant } from '@/features/tenant/tenant-context'

export function ComparisonView({ rootSlug: propRootSlug }: { rootSlug?: string } = {}) {
  const tenant = useTenant()
  const effectiveRootSlug = propRootSlug || tenant.rootSlug

  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  const { data: meta } = useQuery({
    queryKey: apiKeys.meta,
    queryFn: async () => {
      const res = await apiClient.GET('/api/meta')
      return res.data
    },
  })

  const { data: groups } = useQuery({
    queryKey: apiKeys.rootGroups(effectiveRootSlug),
    queryFn: async () => {
      const res = await apiClient.GET('/api/{root_slug}/groups', {
        params: { path: { root_slug: effectiveRootSlug } },
      })
      return res.data
    },
    enabled: Boolean(effectiveRootSlug),
  })

  const { data: comparison } = useQuery({
    queryKey: apiKeys.rootComparison(effectiveRootSlug),
    queryFn: async () => {
      const res = await apiClient.GET('/api/{root_slug}/comparison', {
        params: { path: { root_slug: effectiveRootSlug } },
      })
      return res.data
    },
    enabled: Boolean(effectiveRootSlug),
  })

  const comparisonMap = useMemo(() => {
    const map = new Map<string, GroupComparisonSummary>()
    if (comparison?.groups) {
      for (const g of comparison.groups) {
        map.set(g.group_id, g)
      }
    }
    return map
  }, [comparison])

  const tree = useMemo(() => buildGroupTree(groups ?? []), [groups])
  const filteredTree = useMemo(() => filterTree(tree, search), [tree, search])

  const toggleExpand = (id: string, isCurrentlyExpanded: boolean) => {
    if (isCurrentlyExpanded) {
      setCollapsedIds((prev) => new Set(prev).add(id))
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } else {
      setCollapsedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setExpandedIds((prev) => new Set(prev).add(id))
    }
  }

  const expandAll = () => {
    setCollapsedIds(new Set())
    setExpandedIds(new Set(getAllNodeIds(tree)))
  }

  const collapseAll = () => {
    setCollapsedIds(new Set(getAllNodeIds(tree)))
    setExpandedIds(new Set())
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
            Group Comparison & Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-group sprint progression, effort distribution, and fairness metrics across cohorts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            Backend Sync Active
          </Badge>
        </div>
      </div>

      {/* Cohort Overview & System Metadata Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-card via-card to-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Cohort Tracked Time</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">
              {comparison?.total_cohort_hours ?? 0}h
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg {comparison?.average_group_hours ?? 0}h / team
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card via-card to-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Work Taxonomy</CardTitle>
            <BarChart3 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{meta?.categories.length ?? 5} Categories</div>
            <p className="text-xs text-muted-foreground mt-1">PM, RE, Impl, Arch & Other</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card via-card to-blue-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Cohort Fairness</CardTitle>
            <Scale className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">
              {comparison?.cohort_fairness?.rating ?? 'Balanced'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {comparison?.cohort_fairness
                ? `CV ${(comparison.cohort_fairness.coefficient_of_variation * 100).toFixed(0)}% • ${comparison.cohort_fairness.mean_hours}h mean`
                : 'Effort distribution'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card via-card to-purple-500/5">
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

      {/* Tree-Structured Cohort Groups Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Cohort Hierarchy & Groups</CardTitle>
              <CardDescription>
                {tree.length} root {tree.length === 1 ? 'cohort' : 'cohorts'} with {groups?.length ?? 0} total active groups and teams
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={expandAll}
                className="h-8 gap-1 text-xs"
                title="Expand all tree levels"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
                Expand All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAll}
                className="h-8 gap-1 text-xs"
                title="Collapse all tree levels"
              >
                <ChevronsDownUp className="h-3.5 w-3.5" />
                Collapse All
              </Button>
            </div>
          </div>

          <div className="relative mt-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search cohorts, teams, or full paths..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-muted/20 pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
            />
          </div>
        </CardHeader>

        <CardContent>
          {filteredTree.length > 0 ? (
            <div className="space-y-4">
              {filteredTree.map((rootNode) => (
                <TreeNodeItem
                  key={rootNode.group.id}
                  node={rootNode}
                  level={0}
                  isSearching={Boolean(search.trim())}
                  expandedIds={expandedIds}
                  collapsedIds={collapsedIds}
                  toggleExpand={toggleExpand}
                  comparisonMap={comparisonMap}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              {search.trim() ? (
                <>No groups match &quot;{search}&quot;. Clear the search input to view the full hierarchy.</>
              ) : (
                <>No cohort groups synced yet. Run sync from background scheduler or trigger manually.</>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface TreeNodeItemProps {
  node: GroupTreeNode
  level: number
  isSearching: boolean
  expandedIds: Set<string>
  collapsedIds: Set<string>
  toggleExpand: (id: string, isCurrentlyExpanded: boolean) => void
  comparisonMap: Map<string, GroupComparisonSummary>
}

function TreeNodeItem({
  node,
  level,
  isSearching,
  expandedIds,
  collapsedIds,
  toggleExpand,
  comparisonMap,
}: TreeNodeItemProps) {
  const { rootSlug } = useTenant()
  const hasChildren = node.children.length > 0
  const isRoot = level === 0
  const isExpanded = isSearching
    ? true
    : isRoot
      ? !collapsedIds.has(node.group.id)
      : expandedIds.has(node.group.id)
  const summary = comparisonMap.get(node.group.id)

  return (
    <div className={`transition-all ${isRoot ? 'rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4 shadow-xs' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 group/item">
        <div className="flex items-start gap-2.5 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(node.group.id, isExpanded)}
              className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition shrink-0"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            </div>
          )}

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded ${
                  isRoot
                    ? 'bg-primary/10 text-primary'
                    : level === 1
                      ? 'bg-blue-500/10 text-blue-500'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {isRoot ? (
                  <Layers className="h-3 w-3" />
                ) : level === 1 ? (
                  <FolderTree className="h-3 w-3" />
                ) : (
                  <Users className="h-3 w-3" />
                )}
              </div>

              <span className={`font-semibold truncate ${isRoot ? 'text-base' : 'text-sm'}`}>
                {node.group.name}
              </span>

              <Badge
                variant={isRoot ? 'default' : 'outline'}
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {isRoot ? 'Root Cohort' : `Level ${node.group.level}`}
              </Badge>

              {hasChildren && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
                  {node.children.length} {node.children.length === 1 ? 'subgroup' : 'subgroups'}
                  {node.totalDescendants > node.children.length ? ` (${node.totalDescendants} total)` : ''}
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground font-mono truncate max-w-lg">
              {node.group.full_path}
            </p>
          </div>
        </div>

        {/* Metrics and Action */}
        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
          {summary && (
            <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground mr-2">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                {summary.total_hours}h
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                {summary.member_count} {summary.member_count === 1 ? 'member' : 'members'}
              </span>
            </div>
          )}

          <Link to="/$rootSlug/$groupSlug" params={{ rootSlug, groupSlug: node.slug }}>
            <Button size="sm" variant={isRoot ? 'glass' : 'outline'} className="gap-1.5 text-xs h-8">
              Inspect Analytics
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Recursive Children Container */}
      {hasChildren && isExpanded && (
        <div className="mt-3 space-y-2 border-l-2 border-border/50 pl-3 sm:pl-4 ml-3 sm:ml-4">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.group.id}
              node={child}
              level={level + 1}
              isSearching={isSearching}
              expandedIds={expandedIds}
              collapsedIds={collapsedIds}
              toggleExpand={toggleExpand}
              comparisonMap={comparisonMap}
            />
          ))}
        </div>
      )}
    </div>
  )
}
