import type { components } from '@/lib/api/schema'
import { Card, CardContent } from '@/components/ui/card'
import { GitPullRequest, GitMerge, MessageSquare, ExternalLink, ArrowRight, ShieldCheck } from 'lucide-react'
import { format } from 'date-fns'

type UserMrSummary = components['schemas']['UserMrSummary']
type UserMetricsSummary = components['schemas']['UserMetricsSummary']

interface ContributionsTabProps {
  mergeRequests: UserMrSummary[]
  metrics: UserMetricsSummary
}

export function ContributionsTab({ mergeRequests, metrics }: ContributionsTabProps) {
  const totalAdditions = mergeRequests.reduce((acc, mr) => acc + mr.additions, 0)
  const totalDeletions = mergeRequests.reduce((acc, mr) => acc + mr.deletions, 0)

  return (
    <div className="space-y-5">
      {/* Top Contributions Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60 bg-card/60 shadow-xs">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">Merged MRs</span>
              <GitMerge className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {metrics.merged_mrs_count}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Successfully shipped
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 shadow-xs">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">Code Reviews</span>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {metrics.reviews_count}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Teammate approvals & comments
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 shadow-xs">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">Lines Added</span>
              <span className="text-emerald-500 font-mono font-bold text-xs">+</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-500">
              +{totalAdditions.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Across recent MRs
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 shadow-xs">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider">Lines Deleted</span>
              <span className="text-rose-500 font-mono font-bold text-xs">-</span>
            </div>
            <div className="text-xl font-bold font-mono text-rose-500">
              -{totalDeletions.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Refactored / pruned
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Authored MRs List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-primary" />
            Authored Merge Requests ({mergeRequests.length})
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            Most recent branches
          </span>
        </div>

        {mergeRequests.length === 0 ? (
          <div className="p-10 text-center rounded-xl border border-dashed border-border/60 text-muted-foreground text-sm space-y-2">
            <GitPullRequest className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p>No merge requests authored by this contributor yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {mergeRequests.map((mr) => {
              const createdDate = new Date(mr.created_at)
              const stateColor =
                mr.state === 'merged'
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  : mr.state === 'opened'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-muted text-muted-foreground border-border'

              return (
                <div
                  key={mr.id}
                  className="p-3.5 rounded-xl border border-border/60 bg-card/60 hover:border-primary/40 hover:bg-muted/10 transition-all space-y-2 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-semibold border ${stateColor}`}>
                          {mr.state}
                        </span>
                        <a
                          href={mr.web_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
                        >
                          <span>{mr.title}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </a>
                      </div>

                      {/* Branch Info */}
                      <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-muted/80 text-[11px] truncate max-w-xs">
                          {mr.source_branch}
                        </span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        <span className="px-1.5 py-0.5 rounded bg-muted/80 text-[11px]">
                          {mr.target_branch}
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="text-[11px] truncate">{mr.project_path}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-medium text-emerald-500">
                        +{mr.additions}
                      </span>
                      <span className="text-xs font-mono font-medium text-rose-500">
                        -{mr.deletions}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground border-t border-border/40 pt-2">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {mr.discussion_count} discussions
                      </span>
                    </div>
                    <div>Created {format(createdDate, 'MMM d, yyyy')}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
