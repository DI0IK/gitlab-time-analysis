import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { MessageSquare, RefreshCw, Search } from 'lucide-react'
import type { components } from '@/lib/api/schema'
import { NoteCard } from './note-card'

import { useTenant } from '@/features/tenant/tenant-context'
import { apiKeys } from '@/lib/api/keys'

type ItemNoteRecord = components['schemas']['ItemNoteRecord']

export function ItemDiscussionThread({
  workItemId,
  mergeRequestId,
  rootSlug: propRootSlug,
}: {
  workItemId?: string
  mergeRequestId?: string
  rootSlug?: string
}) {
  const tenant = useTenant()
  const effectiveRootSlug = propRootSlug || tenant.rootSlug

  const [filter, setFilter] = React.useState<'all' | 'comments' | 'activity'>('all')
  const [search, setSearch] = React.useState('')

  const itemType = workItemId ? 'work_item' : 'merge_request'
  const itemId = workItemId || mergeRequestId || ''

  const { data: notes, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: apiKeys.rootNotes(effectiveRootSlug, itemType, itemId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/{root_slug}/notes', {
        params: {
          path: { root_slug: effectiveRootSlug },
          query: {
            work_item_id: workItemId,
            merge_request_id: mergeRequestId,
          },
        },
      })
      if (error || !data) {
        throw new Error((error as unknown as { error?: string })?.error || 'Failed to load notes')
      }
      return data as ItemNoteRecord[]
    },
    enabled: Boolean(effectiveRootSlug && (workItemId || mergeRequestId)),
  })

  if (isLoading) {
    return (
      <div className="space-y-3 py-4 animate-pulse">
        <div className="h-4 w-32 bg-muted/60 rounded" />
        <div className="h-20 bg-muted/30 rounded-lg border border-border/40" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center rounded-lg border border-border/50 bg-destructive/5 text-xs text-muted-foreground">
        <p>Failed to load discussion notes.</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-2 text-xs gap-1.5">
          <RefreshCw className="h-3 w-3" /> Retry
        </Button>
      </div>
    )
  }

  const allNotes = notes || []
  const commentsCount = allNotes.filter((n) => !n.is_system).length
  const activityCount = allNotes.filter((n) => n.is_system).length

  let filtered = allNotes.filter((n) => {
    if (filter === 'comments') return !n.is_system
    if (filter === 'activity') return n.is_system
    return true
  })

  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter(
      (n) =>
        n.body.toLowerCase().includes(q) ||
        (n.author_username && n.author_username.toLowerCase().includes(q)) ||
        (n.author_name && n.author_name.toLowerCase().includes(q)),
    )
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Activity & Discussions</h4>
          <span className="text-xs text-muted-foreground font-mono">({allNotes.length})</span>
          {isFetching && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filter === 'all' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({allNotes.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('comments')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filter === 'comments' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Comments ({commentsCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('activity')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filter === 'activity' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              System ({activityCount})
            </button>
          </div>

          {allNotes.length > 5 && (
            <div className="relative flex-1 sm:w-36">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter notes..."
                className="w-full h-7 pl-7 pr-2 rounded-md border border-border/60 bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
          No discussion notes or activity matching current filter.
        </div>
      ) : (
        <div className="relative space-y-3 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-border/40">
          {filtered.map((note) => <NoteCard key={note.id} note={note} />)}
        </div>
      )}
    </div>
  )
}
