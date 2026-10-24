import { GitCommit, X, Calendar, User, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface WikiCommit {
  id: string
  short_id: string
  title: string
  message: string
  author_name: string
  author_email: string
  authored_date?: string
  web_url?: string
}

interface WikiHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  pageTitle: string
  commits: WikiCommit[]
  isLoading?: boolean
}

export function WikiHistoryModal({
  isOpen,
  onClose,
  pageTitle,
  commits,
  isLoading,
}: WikiHistoryModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
      <div className="relative w-full max-w-2xl rounded-lg border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5 bg-muted/20">
          <div className="flex items-center gap-2">
            <GitCommit className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Revision History: <span className="text-primary">{pageTitle}</span>
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="space-y-3 py-4">
              <div className="h-12 bg-muted/40 rounded animate-pulse" />
              <div className="h-12 bg-muted/30 rounded animate-pulse" />
              <div className="h-12 bg-muted/20 rounded animate-pulse" />
            </div>
          ) : commits.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <Clock className="h-6 w-6 mx-auto opacity-30 mb-2" />
              <p>No revision history found for this page.</p>
            </div>
          ) : (
            commits.map((commit) => (
              <div
                key={commit.id}
                className="flex items-start justify-between gap-4 p-3 rounded-md border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="text-xs font-medium text-foreground line-clamp-1">
                    {commit.title}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3 opacity-60" />
                      {commit.author_name}
                    </span>
                    {commit.authored_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 opacity-60" />
                        {new Date(commit.authored_date).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className="font-mono text-xs bg-muted/40 text-muted-foreground px-2 py-0.5 rounded border border-border/30">
                    {commit.short_id}
                  </span>
                  {commit.web_url && (
                    <a
                      href={commit.web_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      GitLab
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-5 py-2.5 bg-muted/10 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
