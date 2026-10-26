import {
  MessageSquare,
  Clock,
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
  CircleDot,
  CheckCircle2,
  Activity,
  Tag,
  User,
} from 'lucide-react'
import type { components } from '@/lib/api/schema'

export function formatTimeAgo(isoString: string): string {
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

export function formatDateHeader(isoString: string): string {
  try {
    const date = new Date(isoString)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    })
  } catch {
    return 'Recent'
  }
}

export function getActivityIcon(activityType: string, iconName?: string | null) {
  switch (activityType) {
    case 'comment':
      return <MessageSquare className="h-4 w-4 text-sky-400" />
    case 'timelog':
      return <Clock className="h-4 w-4 text-amber-400" />
    case 'mr_created':
      return <GitPullRequest className="h-4 w-4 text-purple-400" />
    case 'mr_merged':
      return <GitMerge className="h-4 w-4 text-emerald-400" />
    case 'mr_closed':
      return <GitPullRequestClosed className="h-4 w-4 text-rose-400" />
    case 'work_item_created':
      return <CircleDot className="h-4 w-4 text-indigo-400" />
    case 'work_item_closed':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
    default:
      if (iconName === 'label' || iconName === 'tag') return <Tag className="h-4 w-4 text-sky-400" />
      if (iconName === 'user' || iconName === 'user-plus') return <User className="h-4 w-4 text-indigo-400" />
      return <Activity className="h-4 w-4 text-muted-foreground" />
  }
}

type GroupActivityItem = components['schemas']['GroupActivityItem']

export function filterActivityItems(rawItems: GroupActivityItem[], search: string): GroupActivityItem[] {
  if (!search.trim()) return rawItems
  const q = search.toLowerCase()
  return rawItems.filter(
    (item) =>
      item.summary.toLowerCase().includes(q) ||
      (item.detail && item.detail.toLowerCase().includes(q)) ||
      (item.author_username && item.author_username.toLowerCase().includes(q)) ||
      (item.author_name && item.author_name.toLowerCase().includes(q)) ||
      item.target_title.toLowerCase().includes(q),
  )
}

export function groupActivityItems(items: GroupActivityItem[]): Array<{ header: string; items: GroupActivityItem[] }> {
  const groups: Array<{ header: string; items: GroupActivityItem[] }> = []
  let currentHeader = ''
  let currentGroup: GroupActivityItem[] = []

  for (const item of items) {
    const header = formatDateHeader(item.timestamp)
    if (header !== currentHeader) {
      if (currentGroup.length > 0) groups.push({ header: currentHeader, items: currentGroup })
      currentHeader = header
      currentGroup = [item]
    } else {
      currentGroup.push(item)
    }
  }
  if (currentGroup.length > 0) groups.push({ header: currentHeader, items: currentGroup })
  return groups
}
