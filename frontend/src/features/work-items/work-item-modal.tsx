import { Link } from '@tanstack/react-router'
import { Modal } from '@/components/ui/modal'
import { Badge, ScopedBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, ExternalLink, Calendar, Folder, FolderGit2, CheckCircle2, CircleDot, Code2 } from 'lucide-react'
import { getRelativePath, formatStatus } from '@/lib/format'
import { ItemDiscussionThread } from '@/features/notes/item-discussion-thread'
import { Markdown } from '@/components/ui/markdown'
import { useTenant } from '@/features/tenant/tenant-context'

export interface WorkItemModalData {
  id: string
  iid: number
  work_item_type: string
  title: string
  description?: string | null
  state: string
  time_estimate: number
  total_time_spent: number
  web_url: string
  labels_json: string
  created_at: string
  closed_at?: string | null
  project_path?: string | null
  parent_id?: string | null
}

export function WorkItemModal({
  item,
  slug,
  rootGroupPath,
  onClose,
}: {
  item: WorkItemModalData | null
  slug?: string
  rootGroupPath?: string
  onClose: () => void
}) {
  const { rootSlug, activeRoot } = useTenant()
  const effectiveRootPath = rootGroupPath || activeRoot?.gitlab_group_path
  if (!item) return null

  const isClosed = item.state.toLowerCase() === 'closed'
  const isEpic = item.work_item_type.toLowerCase() === 'epic'
  const isTask = item.work_item_type.toLowerCase() === 'task'
  const isGroup = isEpic || (item.project_path?.startsWith('groups/') ?? false)
  const typeBadgeVariant = isEpic ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' : isTask ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30' : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'

  const spentHours = (item.total_time_spent / 3600).toFixed(1)
  const estHours = (item.time_estimate / 3600).toFixed(1)
  const pctOfEst = item.time_estimate > 0 ? Math.min(Math.round((item.total_time_spent / item.time_estimate) * 100), 200) : 0

  let labels: Array<{ title: string; color?: string }> = []
  try { labels = JSON.parse(item.labels_json || '[]') } catch { labels = [] }

  return (
    <Modal
      isOpen={Boolean(item)}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-xs uppercase font-mono ${typeBadgeVariant}`}>{item.work_item_type}</Badge>
          <Badge variant="outline" className={isClosed ? 'bg-muted/50 text-muted-foreground' : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'}>
            {isClosed ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <CircleDot className="h-3 w-3 mr-1 inline" />}
            {formatStatus(item.state)}
          </Badge>
          <span className="text-sm font-mono text-muted-foreground font-semibold">#{item.iid}</span>
        </div>
      }
      description={<div className="text-base font-semibold text-foreground mt-1">{item.title}</div>}
    >
      <div className="space-y-4">
        {/* Project Path & Dates */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {item.project_path && (
            slug && !isGroup ? (
              <Link
                to="/$rootSlug/$groupSlug/repo"
                params={{ rootSlug, groupSlug: slug }}
                search={{ project: item.project_path }}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 font-mono bg-muted/40 hover:bg-muted/80 px-2 py-1 rounded-md border border-border/50 text-foreground hover:text-primary transition-colors cursor-pointer"
                title={`Browse code in ${item.project_path}`}
              >
                <FolderGit2 className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">Repo:</span>
                <span>{getRelativePath(item.project_path, slug, effectiveRootPath)}</span>
              </Link>
            ) : (
              <div
                className="inline-flex items-center gap-1.5 font-mono bg-muted/40 px-2 py-1 rounded-md border border-border/50"
                title={item.project_path}
              >
                <Folder className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-foreground font-medium">Group:</span>
                <span>{getRelativePath(item.project_path, slug, effectiveRootPath)}</span>
              </div>
            )
          )}
          <div className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>Created {new Date(item.created_at).toLocaleDateString()}</span>
          </div>
          {item.closed_at && (
            <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Closed {new Date(item.closed_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Time Tracking Progress */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Time Logged vs Estimate
            </span>
            <span className="font-semibold text-foreground">
              {spentHours}h spent {item.time_estimate > 0 ? `/ ${estHours}h est. (${pctOfEst}%)` : '(no estimate)'}
            </span>
          </div>
          {item.time_estimate > 0 && (
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all ${pctOfEst > 100 ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${Math.min(pctOfEst, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Labels</span>
              <span className="text-[10px] font-mono text-muted-foreground/80">{labels.length} total</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => (
                <ScopedBadge
                  key={l.title}
                  label={l.title}
                  color={l.color}
                  size="sm"
                />
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
          <div className="rounded-lg border border-border/50 bg-background/50 p-3 text-xs leading-relaxed max-h-56 overflow-y-auto font-sans text-foreground">
            {item.description ? <Markdown content={item.description} /> : <span className="italic text-muted-foreground">No description provided.</span>}
          </div>
        </div>

        {/* Discussions & Activity Notes */}
        <ItemDiscussionThread workItemId={item.id} />

        {/* Footer actions */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
          {item.project_path && slug && !isEpic ? (
            <Link
              to="/$rootSlug/$groupSlug/repo"
              params={{ rootSlug, groupSlug: slug }}
              search={{ project: item.project_path }}
              onClick={onClose}
            >
              <Button size="sm" variant="outline" className="gap-1.5 text-xs font-mono min-h-[36px]">
                <Code2 className="h-3.5 w-3.5 text-primary" />
                <span>Browse Code in Repo</span>
              </Button>
            </Link>
          ) : <div />}

          <a href={item.web_url} target="_blank" rel="noreferrer" className="w-full sm:w-auto">
            <Button size="sm" variant="ghost" className="w-full sm:w-auto gap-1.5 min-h-[44px] sm:min-h-[36px] text-xs text-muted-foreground hover:text-foreground">
              <span>Open in GitLab</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
        </div>
      </div>
    </Modal>
  )
}
