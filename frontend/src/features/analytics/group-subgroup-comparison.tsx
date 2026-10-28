import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Layers,
  Users,
  ArrowRight,
  Search,
  Scale,
  ArrowUpDown,
} from 'lucide-react'
import type { components } from '@/lib/api/schema'
import { useTenant } from '@/features/tenant/tenant-context'

type GroupComparisonSummary = components['schemas']['GroupComparisonSummary']

interface GroupSubgroupComparisonProps {
  subgroups?: GroupComparisonSummary[]
  peers?: GroupComparisonSummary[]
  currentGroupId?: string
  currentGroupName?: string
}

type SortField = 'hours' | 'accuracy' | 'members' | 'name'

const DEFAULT_CATEGORY_COLORS: Record<string, { label: string; color: string }> = {
  'project-management': { label: 'PM', color: '#c084fc' },
  'requirements-engineering': { label: 'RE', color: '#60a5fa' },
  implementation: { label: 'Impl', color: '#34d399' },
  architecture: { label: 'Arch', color: '#fbbf24' },
  other: { label: 'Other', color: '#94a3b8' },
}

export function GroupSubgroupComparison({
  subgroups = [],
  peers = [],
  currentGroupId,
  currentGroupName,
}: GroupSubgroupComparisonProps) {
  const { rootSlug } = useTenant()
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('hours')
  const [sortAsc, setSortAsc] = useState(false)

  const isShowingPeers = subgroups.length === 0 && peers.length > 0
  const activeList = isShowingPeers ? peers : subgroups

  const filteredAndSorted = useMemo(() => {
    let list = [...activeList]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (g) => g.name.toLowerCase().includes(q) || g.slug.toLowerCase().includes(q)
      )
    }

    list.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'hours':
          cmp = a.total_hours - b.total_hours
          break
        case 'accuracy':
          cmp = a.accuracy_ratio - b.accuracy_ratio
          break
        case 'members':
          cmp = a.member_count - b.member_count
          break
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
      }
      return sortAsc ? cmp : -cmp
    })

    return list
  }, [activeList, search, sortField, sortAsc])

  if (activeList.length === 0) {
    return null
  }

  const maxHours = Math.max(...activeList.map((g) => g.total_hours), 1)

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                {isShowingPeers ? 'Peer Teams Comparison' : 'Subgroup Comparison'}
              </CardTitle>
              <Badge variant="outline" className="text-xs font-mono">
                {activeList.length} {activeList.length === 1 ? 'team' : 'teams'}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {isShowingPeers
                ? `Benchmark of sibling teams within the cohort. Your active team (${currentGroupName || 'current'}) is highlighted.`
                : 'Direct comparison of tracked hours, work distribution, estimate accuracy, team size, and workload fairness across subgroups.'}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Category Color Legend */}
            <div className="hidden lg:flex items-center gap-2.5 text-[11px] font-mono">
              {Object.entries(DEFAULT_CATEGORY_COLORS).map(([id, cat]) => (
                <div key={id} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: cat.color }} />
                  <span className="text-muted-foreground">{cat.label}</span>
                </div>
              ))}
            </div>

            <div className="relative w-44 sm:w-56">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter teams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-border/60 bg-muted/20 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-1">
        {/* Quick Table Header */}
        <div className="rounded-md border border-border/60 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/30 text-[11px] font-medium text-muted-foreground border-b border-border/60 items-center">
            <div className="col-span-5 sm:col-span-4 cursor-pointer flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('name')}>
              <span>Team &amp; Work Types</span>
              <ArrowUpDown className="h-3 w-3 opacity-60" />
            </div>
            <div className="col-span-3 sm:col-span-2 text-right cursor-pointer flex items-center justify-end gap-1 hover:text-foreground" onClick={() => toggleSort('hours')}>
              <span>Tracked / Est</span>
              <ArrowUpDown className="h-3 w-3 opacity-60" />
            </div>
            <div className="hidden sm:block sm:col-span-2 text-right cursor-pointer hover:text-foreground" onClick={() => toggleSort('accuracy')}>
              <span>Accuracy</span>
            </div>
            <div className="hidden sm:block sm:col-span-2 cursor-pointer hover:text-foreground" onClick={() => toggleSort('members')}>
              <span>Fairness & Size</span>
            </div>
            <div className="col-span-4 sm:col-span-2 text-right">
              <span>Action</span>
            </div>
          </div>

          <div className="divide-y divide-border/40">
            {filteredAndSorted.map((item) => {
              const isCurrent = currentGroupId && item.group_id === currentGroupId
              const pctOfMax = Math.round((item.total_hours / maxHours) * 100)

              return (
                <div
                  key={item.group_id}
                  className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center text-xs transition-colors hover:bg-muted/20 ${
                    isCurrent ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                  }`}
                >
                  {/* Name and Multi-colored Segmented Relative Bar */}
                  <div className="col-span-5 sm:col-span-4 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate text-foreground">
                        {item.name}
                      </span>
                      {isCurrent && (
                        <Badge variant="default" className="text-[10px] px-1 py-0 h-4">
                          Current
                        </Badge>
                      )}
                    </div>
                    {/* Relative Multi-Colored Category Bar */}
                    <div className="w-full bg-muted/40 h-2 rounded-xs overflow-hidden mt-1.5 flex">
                      <div
                        className="h-full rounded-xs flex overflow-hidden transition-all"
                        style={{ width: `${Math.max(pctOfMax, 3)}%` }}
                      >
                        {item.categories && item.categories.length > 0 && item.total_hours > 0 ? (
                          item.categories.map((cat) => {
                            if (cat.percentage <= 0) return null
                            const col =
                              cat.color ||
                              DEFAULT_CATEGORY_COLORS[cat.category_id]?.color ||
                              '#94a3b8'
                            return (
                              <div
                                key={cat.category_id}
                                style={{ width: `${cat.percentage}%`, backgroundColor: col }}
                                className="h-full hover:opacity-80 transition-opacity"
                                title={`${cat.label}: ${cat.total_hours}h (${cat.percentage}%)`}
                              />
                            )
                          })
                        ) : (
                          <div className="bg-primary/80 h-full w-full" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="col-span-3 sm:col-span-2 text-right font-mono">
                    <div className="font-semibold text-foreground">
                      {item.total_hours}h
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      est. {item.estimated_hours}h
                    </div>
                  </div>

                  {/* Accuracy */}
                  <div className="hidden sm:block sm:col-span-2 text-right font-mono">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${
                        item.accuracy_ratio >= 0.8 && item.accuracy_ratio <= 1.25
                          ? 'border-emerald-500/40 text-emerald-500'
                          : item.accuracy_ratio > 1.25
                            ? 'border-amber-500/40 text-amber-500'
                            : 'border-blue-500/40 text-blue-500'
                      }`}
                    >
                      {(item.accuracy_ratio * 100).toFixed(0)}%
                    </Badge>
                  </div>

                  {/* Fairness & Members */}
                  <div className="hidden sm:block sm:col-span-2">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{item.member_count} members</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground mt-0.5">
                      <Scale className="h-2.5 w-2.5" />
                      <span>{item.fairness?.rating || 'Balanced'}</span>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className="col-span-5 sm:col-span-2 text-right">
                    {isCurrent ? (
                      <span className="text-[11px] text-muted-foreground italic">
                        Viewing
                      </span>
                    ) : (
                      <Link
                        to="/$rootSlug/$groupSlug"
                        params={{ rootSlug, groupSlug: item.slug }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2 gap-1"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
