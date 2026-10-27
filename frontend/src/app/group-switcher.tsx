import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import {
  ChevronsUpDown,
  Check,
  Building2,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import { buildGroupTree, type GroupTreeNode } from '@/lib/groups-tree'
import { useTenant } from '@/features/tenant/tenant-context'

export function GroupSwitcher() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const { roots, activeRoot, rootSlug, groupSlug } = useTenant()

  const [collapsedRoots, setCollapsedRoots] = useState<Set<string>>(new Set())
  const [manuallyExpandedRoots, setManuallyExpandedRoots] = useState<Set<string>>(new Set())
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set())

  // Fetch groups for all accessible root groups concurrently
  const groupQueries = useQueries({
    queries: roots.map((root) => ({
      queryKey: apiKeys.rootGroups(root.slug),
      queryFn: async () => {
        const res = await apiClient.GET('/api/{root_slug}/groups', {
          params: { path: { root_slug: root.slug } },
        })
        return Array.isArray(res.data) ? res.data : []
      },
      staleTime: 60 * 1000,
    })),
  })

  // Map each root group to its hierarchy tree of subgroups
  const tenantTrees = useMemo(() => {
    return roots.map((root, index) => {
      const queryResult = groupQueries[index]?.data
      const rawGroups = Array.isArray(queryResult) ? queryResult : []
      const tree = buildGroupTree(rawGroups)

      // Find if there is a root node matching this tenant's path
      const rootNode = tree.find(
        (n) => n.group.level === 0 || n.group.full_path === root.gitlab_group_path
      )
      // The child subgroups are either the children of the level 0 node, or the tree nodes themselves
      const subgroupNodes: GroupTreeNode[] =
        rootNode && rootNode.children.length > 0
          ? rootNode.children
          : tree.filter((n) => n.group.full_path !== root.gitlab_group_path)

      return {
        root,
        rootNode,
        subgroupNodes,
        allGroups: rawGroups,
      }
    })
  }, [roots, groupQueries])

  // Determine active group and root
  const currentTenantData = useMemo(() => {
    return tenantTrees.find((t) => t.root.slug === rootSlug)
  }, [tenantTrees, rootSlug])

  const activeGroupRecord = useMemo(() => {
    if (!groupSlug || !currentTenantData) return null
    return currentTenantData.allGroups.find(
      (g) => g.full_path.replace(/\//g, '-') === groupSlug || g.full_path === groupSlug
    )
  }, [currentTenantData, groupSlug])

  const isRootLevel = !groupSlug || groupSlug === rootSlug || activeGroupRecord?.level === 0

  // Close on outside click or Escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  // Navigation handlers
  const handleSelectRoot = (targetRootSlug: string) => {
    setOpen(false)
    setSearch('')
    navigate({ to: `/${targetRootSlug}` })
  }

  const handleSelectSubgroup = (targetRootSlug: string, targetGroupSlug: string) => {
    setOpen(false)
    setSearch('')
    // Keep sub-path if possible (e.g. /activity, /work-items)
    const subMatch = pathname.match(new RegExp(`^/[^/]+(?:/[^/]+)?(/.*)?$`))
    const currentSub = subMatch?.[1] || ''
    navigate({ to: `/${targetRootSlug}/${targetGroupSlug}${currentSub}` })
  }

  const toggleRootExpand = (slug: string, isCurrentlyExpanded: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isCurrentlyExpanded) {
      if (slug === rootSlug) {
        setCollapsedRoots((prev) => new Set(prev).add(slug))
      } else {
        setManuallyExpandedRoots((prev) => {
          const next = new Set(prev)
          next.delete(slug)
          return next
        })
      }
    } else {
      if (slug === rootSlug) {
        setCollapsedRoots((prev) => {
          const next = new Set(prev)
          next.delete(slug)
          return next
        })
      } else {
        setManuallyExpandedRoots((prev) => new Set(prev).add(slug))
      }
    }
  }

  const toggleSubgroupExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedSubgroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const q = search.trim().toLowerCase()

  return (
    <div className="relative" ref={menuRef}>
      {/* Navbar Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-muted/70 hover:border-border focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Switch workspace or team"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary shrink-0">
          {isRootLevel ? <Building2 className="h-3 w-3" /> : <Users className="h-3 w-3" />}
        </div>
        <div className="flex flex-col text-left min-w-0">
          <span className="max-w-[120px] sm:max-w-[160px] truncate font-semibold leading-tight">
            {isRootLevel ? activeRoot?.name ?? 'Root Group' : activeGroupRecord?.name ?? groupSlug}
          </span>
          <span className="text-[10px] text-muted-foreground leading-none truncate max-w-[120px] sm:max-w-[160px]">
            {isRootLevel ? 'Root Group' : activeRoot?.name}
          </span>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5 opacity-60 shrink-0" />
      </button>

      {/* Tree Dropdown Menu */}
      {open && (
        <div className="glass-dropdown absolute left-0 mt-2 w-88 max-h-[520px] flex flex-col rounded-xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Search Bar */}
          <div className="relative mb-2 px-1 shrink-0">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search workspaces or teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border/50 bg-background/50 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Tree Structure */}
          <div className="overflow-y-auto space-y-1 flex-1 pr-1">
            {tenantTrees.map(({ root, subgroupNodes }) => {
              // Filtering logic
              const rootMatches =
                !q ||
                root.name.toLowerCase().includes(q) ||
                root.gitlab_group_path.toLowerCase().includes(q) ||
                root.slug.toLowerCase().includes(q)

              function filterNodes(nodes: GroupTreeNode[]): GroupTreeNode[] {
                return nodes
                  .map((n) => {
                    const selfMatch =
                      n.group.name.toLowerCase().includes(q) ||
                      n.group.full_path.toLowerCase().includes(q)
                    const filteredChildren = filterNodes(n.children)
                    if (selfMatch || filteredChildren.length > 0) {
                      return { ...n, children: filteredChildren }
                    }
                    return null
                  })
                  .filter((n): n is GroupTreeNode => n !== null)
              }

              const visibleSubgroups = q ? filterNodes(subgroupNodes) : subgroupNodes
              const hasVisibleChildren = visibleSubgroups.length > 0

              if (!rootMatches && !hasVisibleChildren) {
                return null
              }

              // If searching, always expand. Otherwise default selected tenant to expanded, unless collapsed
              const isRootExpanded = q
                ? true
                : root.slug === rootSlug
                  ? !collapsedRoots.has(root.slug)
                  : manuallyExpandedRoots.has(root.slug)
              const isRootSelected =
                rootSlug === root.slug &&
                (!groupSlug || groupSlug === root.slug || activeGroupRecord?.level === 0)

              return (
                <div key={root.slug} className="space-y-0.5">
                  {/* Layer 1: Root Group (Tenant) */}
                  <div
                    onClick={() => handleSelectRoot(root.slug)}
                    className={`group/root flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition cursor-pointer ${
                      isRootSelected
                        ? 'bg-primary/15 text-primary font-semibold border border-primary/30'
                        : 'text-foreground hover:bg-accent/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {hasVisibleChildren ? (
                        <button
                          type="button"
                          onClick={(e) => toggleRootExpand(root.slug, isRootExpanded, e)}
                          className="p-1 -ml-1 text-muted-foreground hover:text-foreground rounded transition"
                          title={isRootExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isRootExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}

                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <div className="text-left min-w-0">
                        <p className="font-semibold truncate">{root.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {root.gitlab_group_path}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] font-mono uppercase bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded border border-border/40">
                        Root Group
                      </span>
                      {isRootSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </div>

                  {/* Layer 2+: Nested Subgroups */}
                  {isRootExpanded && hasVisibleChildren && (
                    <div className="ml-3 pl-2 border-l border-border/50 space-y-0.5">
                      {visibleSubgroups.map((node) => (
                        <SubgroupTreeItem
                          key={node.group.id}
                          node={node}
                          level={1}
                          rootSlug={root.slug}
                          currentGroupSlug={groupSlug}
                          searchQuery={q}
                          expandedSubgroups={expandedSubgroups}
                          onToggleExpand={toggleSubgroupExpand}
                          onSelect={handleSelectSubgroup}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {q &&
              !tenantTrees.some(
                (t) =>
                  t.root.name.toLowerCase().includes(q) ||
                  t.allGroups.some((g) => g.name.toLowerCase().includes(q))
              ) && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No matching workspaces or teams found.
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}

function hasSelectedDescendant(node: GroupTreeNode, currentGroupSlug: string | null): boolean {
  if (!currentGroupSlug) return false
  return node.children.some(
    (child) => child.slug === currentGroupSlug || hasSelectedDescendant(child, currentGroupSlug)
  )
}

function SubgroupTreeItem({
  node,
  level,
  rootSlug,
  currentGroupSlug,
  searchQuery,
  expandedSubgroups,
  onToggleExpand,
  onSelect,
}: {
  node: GroupTreeNode
  level: number
  rootSlug: string
  currentGroupSlug: string | null
  searchQuery: string
  expandedSubgroups: Set<string>
  onToggleExpand: (id: string, e: React.MouseEvent) => void
  onSelect: (rootSlug: string, groupSlug: string) => void
}) {
  const hasChildren = node.children.length > 0
  const isExpanded =
    searchQuery
      ? true
      : expandedSubgroups.has(node.group.id) || hasSelectedDescendant(node, currentGroupSlug)
  const isSelected = currentGroupSlug === node.slug

  return (
    <div className="space-y-0.5">
      <div
        onClick={() => onSelect(rootSlug, node.slug)}
        className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-xs transition cursor-pointer ${
          isSelected
            ? 'bg-primary/10 text-primary font-semibold'
            : 'text-foreground hover:bg-accent/50'
        }`}
        style={{ paddingLeft: `${Math.max(6, (level - 1) * 12 + 6)}px` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => onToggleExpand(node.group.id, e)}
              className="p-0.5 text-muted-foreground hover:text-foreground rounded transition"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}

          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{node.group.name}</span>
        </div>

        {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-3 pl-2 border-l border-border/40 space-y-0.5">
          {node.children.map((child) => (
            <SubgroupTreeItem
              key={child.group.id}
              node={child}
              level={level + 1}
              rootSlug={rootSlug}
              currentGroupSlug={currentGroupSlug}
              searchQuery={searchQuery}
              expandedSubgroups={expandedSubgroups}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
