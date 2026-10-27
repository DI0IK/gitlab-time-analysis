import { Link } from '@tanstack/react-router'
import { ChevronRight, ChevronDown, Clock, ExternalLink, Folder, FolderGit2 } from 'lucide-react'
import { Badge, ScopedBadge } from '@/components/ui/badge'
import { getRelativePath, formatStatus } from '@/lib/format'
import { useTenant } from '@/features/tenant/tenant-context'
import type { WorkItemModalData } from './work-item-modal'

interface TreeNodeProps {
  item: WorkItemModalData
  childrenMap: Map<string, WorkItemModalData[]>
  depth: number
  expanded: Set<string>
  slug?: string
  onToggle: (id: string) => void
  onSelect: (item: WorkItemModalData) => void
}

export function WorkItemTreeNode({
  item,
  childrenMap,
  depth,
  expanded,
  slug,
  onToggle,
  onSelect,
}: TreeNodeProps) {
  const { rootSlug } = useTenant()
  const children = childrenMap.get(item.id) || []
  const hasChildren = children.length > 0
  const isExpanded = expanded.has(item.id)

  const isClosed = item.state.toLowerCase() === 'closed'
  const isEpic = item.work_item_type.toLowerCase() === 'epic'
  const isTask = item.work_item_type.toLowerCase() === 'task'
  const typeBadgeVariant = isEpic
    ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30'
    : isTask
      ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'

  const spentHours = (item.total_time_spent / 3600).toFixed(1)
  const estHours = (item.time_estimate / 3600).toFixed(1)

  let labels: Array<{ title: string; color?: string }> = []
  try {
    labels = JSON.parse(item.labels_json || '[]')
  } catch {
    labels = []
  }

  return (
    <div className="space-y-1">
      <div
        onClick={() => onSelect(item)}
        className="group p-2.5 sm:px-3 hover:bg-muted/40 rounded-lg transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer border border-transparent hover:border-border/60 min-h-[48px]"
        style={{ marginLeft: `${Math.min(depth * 14, 42)}px` }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggle(item.id)
              }}
              className="p-1 rounded-sm hover:bg-muted/80 text-muted-foreground hover:text-foreground shrink-0 min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-6 shrink-0" />
          )}

          <Badge variant="outline" className={`text-[10px] uppercase font-mono shrink-0 ${typeBadgeVariant}`}>
            {item.work_item_type}
          </Badge>

          <span className="text-xs font-mono text-muted-foreground shrink-0">#{item.iid}</span>

          {item.project_path && (
            slug && !isEpic ? (
              <Link
                to="/$rootSlug/$groupSlug/repo"
                params={{ rootSlug, groupSlug: slug }}
                search={{ project: item.project_path }}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 font-mono text-[10px] bg-muted/60 hover:bg-primary/20 text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded-sm border border-border/40 shrink-0 max-w-[130px] sm:max-w-[180px] transition-colors cursor-pointer"
                title={`Browse code in ${item.project_path}`}
              >
                <FolderGit2 className="h-3 w-3 text-primary shrink-0" />
                <span className="truncate">{getRelativePath(item.project_path, slug)}</span>
              </Link>
            ) : (
              <span
                className="inline-flex items-center gap-1 font-mono text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-sm border border-border/40 shrink-0 max-w-[130px] sm:max-w-[180px]"
                title={item.project_path}
              >
                <Folder className="h-3 w-3 text-purple-500 shrink-0" />
                <span className="truncate">{getRelativePath(item.project_path, slug)}</span>
              </span>
            )
          )}

          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
            {item.title}
          </span>

          {labels.length > 0 && (
            <div className="hidden md:flex items-center gap-1 shrink-0">
              {labels.slice(0, 2).map((l) => (
                <ScopedBadge key={l.title} label={l.title} color={l.color} size="xs" />
              ))}
              {labels.length > 2 && (
                <span className="text-[9px] font-mono text-muted-foreground/80">+{labels.length - 2}</span>
              )}
            </div>
          )}

          {hasChildren && (
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-full bg-muted/60 text-muted-foreground shrink-0">
              {children.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0 font-mono text-xs pl-8 sm:pl-0">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>{spentHours}h / {estHours}h est</span>
          </div>
          <Badge variant="outline" className={`text-[10px] uppercase font-mono ${isClosed ? 'bg-muted/50 text-muted-foreground' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
            {formatStatus(item.state)}
          </Badge>
          <a
            href={item.web_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 text-muted-foreground hover:text-foreground rounded-sm"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="pl-3 ml-2 border-l-2 border-border/40 space-y-1 animate-in fade-in duration-100">
          {children.map((child) => (
            <WorkItemTreeNode
              key={child.id}
              item={child}
              childrenMap={childrenMap}
              depth={depth + 1}
              expanded={expanded}
              slug={slug}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
