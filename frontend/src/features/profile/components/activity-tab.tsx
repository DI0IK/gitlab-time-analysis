import * as React from 'react'
import type { components } from '@/lib/api/schema'
import { Badge } from '@/components/ui/badge'
import { Clock, ExternalLink, GitPullRequest, Layers, Calendar } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

type UserTimelogItem = components['schemas']['UserTimelogItem']

interface ActivityTabProps {
  timelogs: UserTimelogItem[]
}

type FilterType = 'all' | 'work_items' | 'mrs'

export function ActivityTab({ timelogs }: ActivityTabProps) {
  const [filter, setFilter] = React.useState<FilterType>('all')

  const filtered = React.useMemo(() => {
    if (filter === 'work_items') {
      return timelogs.filter((t) => t.item_type !== 'merge_request')
    }
    if (filter === 'mrs') {
      return timelogs.filter((t) => t.item_type === 'merge_request')
    }
    return timelogs
  }, [timelogs, filter])

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Activity ({timelogs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('work_items')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              filter === 'work_items'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Issues & Tasks ({timelogs.filter((t) => t.item_type !== 'merge_request').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('mrs')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              filter === 'mrs'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Merge Requests ({timelogs.filter((t) => t.item_type === 'merge_request').length})
          </button>
        </div>

        <div className="text-xs font-mono text-muted-foreground">
          Showing latest {filtered.length} entries
        </div>
      </div>

      {/* Timelog Stream */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border/60 text-muted-foreground text-sm space-y-2">
          <Clock className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p>No timelog activity found matching this filter.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((log) => {
            const date = new Date(log.spent_at)
            const isMr = log.item_type === 'merge_request'
            const itemUrl = log.item_web_url || log.web_url

            return (
              <div
                key={log.id}
                className="p-3.5 rounded-xl border border-border/60 bg-card/60 hover:border-primary/40 hover:bg-muted/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${
                      isMr
                        ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                        : 'bg-primary/10 border-primary/20 text-primary'
                    }`}
                  >
                    {isMr ? <GitPullRequest className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={itemUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate max-w-md inline-flex items-center gap-1 group"
                      >
                        <span className="truncate">{log.item_title || 'Work Item Session'}</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </a>

                      {log.item_state && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-semibold border ${
                            log.item_state === 'merged'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              : log.item_state === 'closed'
                              ? 'bg-muted text-muted-foreground border-border'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {log.item_state}
                        </span>
                      )}

                      {log.sprint_number && (
                        <Badge variant="outline" className="text-[10px] font-mono py-0 h-4 border-border/60">
                          Sprint {log.sprint_number}
                        </Badge>
                      )}
                    </div>

                    {log.summary && (
                      <p className="text-xs text-muted-foreground/90 line-clamp-2">
                        {log.summary}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(date, 'MMM d, yyyy')}
                      </span>
                      <span>•</span>
                      <span>{formatDistanceToNow(date, { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary font-mono font-bold text-xs">
                    +{log.hours}h
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    {(log.time_spent_seconds / 60).toFixed(0)} mins
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
