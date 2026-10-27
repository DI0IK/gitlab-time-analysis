import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/ui/markdown'
import { getAvatarUrl } from '@/lib/avatar'
import {
  Activity,
  ExternalLink,
  CheckCircle2,
  Lock,
  Tag,
  User,
  Clock,
  GitCommit,
  GitPullRequest,
} from 'lucide-react'
import type { components } from '@/lib/api/schema'
import { useTenant } from '@/features/tenant/tenant-context'

type ItemNoteRecord = components['schemas']['ItemNoteRecord']

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffSec < 60) return 'just now'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)}d ago`
    return date.toLocaleDateString()
  } catch {
    return isoString
  }
}

function getSystemIcon(iconName?: string | null) {
  switch (iconName) {
    case 'label':
    case 'tag':
      return <Tag className="h-3.5 w-3.5 text-sky-400" />
    case 'user':
    case 'user-plus':
    case 'assignee':
      return <User className="h-3.5 w-3.5 text-indigo-400" />
    case 'time-out':
    case 'timer':
    case 'clock':
      return <Clock className="h-3.5 w-3.5 text-amber-400" />
    case 'commit':
      return <GitCommit className="h-3.5 w-3.5 text-emerald-400" />
    case 'git-pull-request':
      return <GitPullRequest className="h-3.5 w-3.5 text-purple-400" />
    case 'status':
    case 'status-closed':
    case 'check':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
    default:
      return <Activity className="h-3.5 w-3.5 text-muted-foreground" />
  }
}

export function NoteCard({ note }: { note: ItemNoteRecord }) {
  const { rootSlug } = useTenant()
  const authorUsername = note.author_username
  const authorDisplayName = note.author_name || authorUsername || 'GitLab System'
  const avatarSrc = getAvatarUrl(note.author_avatar_url)

  if (note.is_system) {
    return (
      <div className="relative flex items-center gap-3 pl-2 py-1 text-xs">
        <div className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted border border-border/60">
          {getSystemIcon(note.system_note_icon_name)}
        </div>
        <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
          {authorUsername ? (
            <Link
              to="/$rootSlug/users/$username"
              params={{ rootSlug, username: authorUsername }}
              className="font-medium text-foreground hover:underline shrink-0"
            >
              {authorDisplayName}
            </Link>
          ) : (
            <span className="font-medium text-muted-foreground shrink-0">{authorDisplayName}</span>
          )}
          <div className="text-muted-foreground inline">
            <Markdown content={note.body} inline />
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0" title={note.created_at}>
          {formatTimeAgo(note.created_at)}
        </span>
      </div>
    )
  }

  return (
    <div className="relative z-10 rounded-lg border border-border/60 bg-card/60 hover:bg-card/90 transition shadow-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/40 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {avatarSrc ? (
            <img src={avatarSrc} alt={authorDisplayName} className="h-5 w-5 rounded-full object-cover shrink-0" />
          ) : (
            <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
              {authorDisplayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          {authorUsername ? (
            <Link to="/$rootSlug/users/$username" params={{ rootSlug, username: authorUsername }} className="font-semibold text-foreground hover:underline truncate">
              {authorDisplayName}
            </Link>
          ) : (
            <span className="font-semibold text-foreground truncate">{authorDisplayName}</span>
          )}
          {authorUsername && <span className="text-[11px] text-muted-foreground hidden sm:inline">@{authorUsername}</span>}
          {note.is_internal && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1">
              <Lock className="h-2.5 w-2.5" /> Internal
            </Badge>
          )}
          {note.is_resolved && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1">
              <CheckCircle2 className="h-2.5 w-2.5" /> Resolved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground" title={note.created_at}>
            {formatTimeAgo(note.created_at)}
          </span>
          {note.web_url && (
            <a href={note.web_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground transition" title="View on GitLab">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      <div className="p-3 text-xs leading-relaxed font-sans">
        <Markdown content={note.body} />
      </div>
    </div>
  )
}
