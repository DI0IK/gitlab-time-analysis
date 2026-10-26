import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/ui/markdown'
import { getAvatarUrl } from '@/lib/avatar'
import { ExternalLink } from 'lucide-react'
import type { components } from '@/lib/api/schema'
import { formatTimeAgo, getActivityIcon } from './activity-helpers'

type GroupActivityItem = components['schemas']['GroupActivityItem']

export function ActivityItemCard({
  item,
  onSelectTarget,
}: {
  item: GroupActivityItem
  onSelectTarget?: (item: GroupActivityItem) => void
}) {
  const authorUsername = item.author_username
  const authorName = item.author_name || authorUsername || 'System'
  const isWi = item.target_type === 'work_item'
  const targetPrefix = isWi ? '#' : '!'
  const avatarSrc = getAvatarUrl(item.author_avatar_url)

  return (
    <div className="relative rounded-lg border border-border/60 bg-card/60 hover:bg-card/90 transition shadow-xs p-3.5 space-y-2 group">
      {/* Timeline node icon */}
      <div className="absolute -left-6 top-3.5 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-background border border-border/70 shadow-2xs">
        {getActivityIcon(item.activity_type, item.icon)}
      </div>

      {/* Item header */}
      <div className="flex items-start justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={authorName}
              className="h-5 w-5 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
              {authorName.slice(0, 2).toUpperCase()}
            </div>
          )}

          {authorUsername ? (
            <Link
              to="/users/$username"
              params={{ username: authorUsername }}
              className="font-semibold text-foreground hover:underline shrink-0"
            >
              {authorName}
            </Link>
          ) : (
            <span className="font-semibold text-foreground shrink-0">{authorName}</span>
          )}

          <div className="text-muted-foreground inline">
            <Markdown content={item.summary} inline />
          </div>

          <button
            type="button"
            onClick={() => onSelectTarget?.(item)}
            className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-md border border-primary/30 shrink-0 cursor-pointer transition-colors text-left"
            title={`View ${isWi ? 'Work Item' : 'Merge Request'} modal`}
          >
            <span className="font-semibold">
              {targetPrefix}
              {item.target_iid}
            </span>
            <span className="truncate max-w-[180px] sm:max-w-xs text-foreground">{item.target_title}</span>
          </button>

          {item.sprint_number && (
            <Badge
              variant="outline"
              className="text-[10px] py-0 px-1.5 font-mono bg-primary/5 text-primary border-primary/20 shrink-0"
            >
              Sprint {item.sprint_number}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground font-mono" title={item.timestamp}>
            {formatTimeAgo(item.timestamp)}
          </span>
          {onSelectTarget && (
            <button
              type="button"
              onClick={() => onSelectTarget(item)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/90 bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded border border-primary/25 transition cursor-pointer"
              title={`Open ${isWi ? 'Work Item' : 'Merge Request'} modal`}
            >
              <span>View</span>
            </button>
          )}
          {item.target_url && (
            <a
              href={item.target_url}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground transition opacity-0 group-hover:opacity-100"
              title="Open on GitLab"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Detail block */}
      {item.detail && (
        <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-xs leading-relaxed max-h-48 overflow-y-auto">
          <Markdown content={item.detail} />
        </div>
      )}
    </div>
  )
}
