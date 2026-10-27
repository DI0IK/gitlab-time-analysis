import * as React from 'react'
import {
  Folder,
  Layers,
  FolderGit2,
  ChevronDown,
  ChevronRight,
  Check,
  Search,
  BookOpen,
} from 'lucide-react'

export interface WikiTargetItem {
  path: string
  name: string
  target_type: string
  has_wiki: boolean
  page_count: number
}

interface WikiTargetTreeDropdownProps {
  targets: WikiTargetItem[]
  selectedPath: string
  onSelect: (path: string) => void
}

interface WikiTreeNode {
  id: string
  name: string
  path: string
  target: WikiTargetItem
  children: WikiTreeNode[]
}

function getTargetIcon(targetType: string) {
  if (targetType === 'group') {
    return <Folder className="h-4 w-4 text-primary shrink-0" />
  }
  if (targetType === 'subgroup') {
    return <Layers className="h-4 w-4 text-blue-400 shrink-0" />
  }
  return <FolderGit2 className="h-4 w-4 text-purple-400 shrink-0" />
}

function buildTargetTree(targets: WikiTargetItem[]): WikiTreeNode[] {
  if (!targets.length) return []

  const nodeMap = new Map<string, WikiTreeNode>()
  const sorted = [...targets].sort((a, b) => a.path.localeCompare(b.path))
  const roots: WikiTreeNode[] = []

  for (const t of sorted) {
    const node: WikiTreeNode = {
      id: t.path,
      name: t.name,
      path: t.path,
      target: t,
      children: [],
    }
    nodeMap.set(t.path, node)

    // Find nearest ancestor in nodeMap
    let parentNode: WikiTreeNode | null = null
    let longestPrefixLen = 0

    for (const [p, existing] of nodeMap.entries()) {
      if (p !== t.path && t.path.startsWith(`${p}/`) && p.length > longestPrefixLen) {
        parentNode = existing
        longestPrefixLen = p.length
      }
    }

    if (parentNode) {
      parentNode.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function filterTree(nodes: WikiTreeNode[], query: string): WikiTreeNode[] {
  if (!query.trim()) return nodes
  const q = query.toLowerCase()

  const result: WikiTreeNode[] = []
  for (const node of nodes) {
    const matchesSelf =
      node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)
    const matchingChildren = filterTree(node.children, query)

    if (matchesSelf || matchingChildren.length > 0) {
      result.push({
        ...node,
        children: matchingChildren,
      })
    }
  }
  return result
}

export function WikiTargetTreeDropdown({
  targets,
  selectedPath,
  onSelect,
}: WikiTargetTreeDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [filter, setFilter] = React.useState('')
  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>({})
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const activeItem = targets.find((t) => t.path === selectedPath) || targets[0]

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Build tree structure
  const rootNodes = React.useMemo(() => buildTargetTree(targets), [targets])

  // Filter tree when searching
  const displayedTree = React.useMemo(() => {
    return filterTree(rootNodes, filter)
  }, [rootNodes, filter])

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true),
    }))
  }

  const handleSelectItem = (path: string) => {
    onSelect(path)
    setOpen(false)
    setFilter('')
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-primary/50 text-foreground transition-all shadow-xs cursor-pointer select-none"
        aria-expanded={open}
        aria-haspopup="tree"
      >
        {activeItem && getTargetIcon(activeItem.target_type)}
        <div className="text-left">
          <div className="text-xs font-semibold tracking-tight flex items-center gap-1.5">
            <span>{activeItem ? activeItem.name : 'Select Documentation'}</span>
            {activeItem && activeItem.page_count > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-mono font-medium">
                {activeItem.page_count} {activeItem.page_count === 1 ? 'page' : 'pages'}
              </span>
            )}
          </div>
          {activeItem && (
            <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px] sm:max-w-[280px]">
              {activeItem.path}
            </p>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground ml-1 transition-transform duration-150 ${
            open ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>

      {/* Tree Dropdown Menu */}
      {open && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Filter Input */}
          <div className="p-1 mb-2 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter wikis by name or path..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                autoFocus
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border/60 bg-background/60 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Tree Scroll View */}
          <div className="max-h-[380px] overflow-y-auto space-y-0.5 p-1 select-none">
            {displayedTree.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs space-y-1">
                <BookOpen className="h-5 w-5 mx-auto opacity-40 mb-1" />
                <p>No wikis match "{filter}"</p>
              </div>
            ) : (
              displayedTree.map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedPath={selectedPath}
                  expandedNodes={expandedNodes}
                  onToggleExpand={toggleExpand}
                  onSelect={handleSelectItem}
                  isSearching={Boolean(filter.trim())}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TreeNodeItem({
  node,
  depth,
  selectedPath,
  expandedNodes,
  onToggleExpand,
  onSelect,
  isSearching,
}: {
  node: WikiTreeNode
  depth: number
  selectedPath: string
  expandedNodes: Record<string, boolean>
  onToggleExpand: (id: string, e: React.MouseEvent) => void
  onSelect: (path: string) => void
  isSearching: boolean
}) {
  const hasChildren = node.children.length > 0
  // When searching, auto-expand; otherwise default to true unless explicitly collapsed
  const isExpanded = isSearching ? true : (expandedNodes[node.id] ?? true)
  const isSelected = node.path === selectedPath

  return (
    <div className="space-y-0.5">
      <div
        onClick={() => onSelect(node.path)}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        className={`group flex items-center justify-between gap-1.5 py-1.5 pr-2 rounded-lg text-xs cursor-pointer transition-colors ${
          isSelected
            ? 'bg-primary/15 text-primary font-medium'
            : 'text-foreground/85 hover:bg-accent/50 hover:text-foreground'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => onToggleExpand(node.id, e)}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/80" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/80" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {getTargetIcon(node.target.target_type)}

          <div className="min-w-0 truncate">
            <span className="truncate font-medium">{node.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {node.target.has_wiki && node.target.page_count > 0 ? (
            <span className="text-[10px] bg-background/80 px-1.5 py-0.2 rounded font-mono text-muted-foreground">
              {node.target.page_count}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/50 font-mono">
              0
            </span>
          )}
          {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
        </div>
      </div>

      {/* Render children if expanded */}
      {hasChildren && isExpanded && (
        <div className="space-y-0.5 border-l border-border/30 ml-3">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              isSearching={isSearching}
            />
          ))}
        </div>
      )}
    </div>
  )
}
