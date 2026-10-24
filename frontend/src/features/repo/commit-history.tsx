import * as React from 'react'
import { GitCommit, Copy, Check, ExternalLink, Calendar, User, FolderTree } from 'lucide-react'
import { generateAvatarUrl } from '@/lib/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface CommitItem {
  id: string
  short_id: string
  title: string
  message: string
  author_name: string
  author_email: string
  authored_date?: string | null
  web_url?: string | null
}

interface CommitHistoryProps {
  commits: CommitItem[]
  isLoading?: boolean
  onSelectCommit?: (commitId: string) => void
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function CommitHistory({ commits, isLoading, onSelectCommit }: CommitHistoryProps) {
  const [copiedSha, setCopiedSha] = React.useState<string | null>(null)

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha)
    setCopiedSha(sha)
    setTimeout(() => setCopiedSha(null), 2000)
  }

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-card/60 border border-border/40 p-4" />
        ))}
      </div>
    )
  }

  if (commits.length === 0) {
    return (
      <div className="p-12 text-center rounded-lg border border-dashed border-border/60 text-muted-foreground text-sm">
        No commits found for this ref.
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {commits.map((commit) => {
        const isCopied = copiedSha === commit.id
        const avatarUrl = generateAvatarUrl(commit.author_name)

        return (
          <div
            key={commit.id}
            className="rounded-lg border border-border/60 bg-card/60 backdrop-blur-xs p-3.5 hover:border-border transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <img
                src={avatarUrl}
                alt={commit.author_name}
                className="h-7 w-7 rounded-full bg-muted/60 shrink-0 mt-0.5 object-cover"
                onError={(e) => {
                  // Fallback
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {commit.title}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground font-mono">
                  <span className="flex items-center gap-1 text-foreground/80">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span>{commit.author_name}</span>
                  </span>
                  {commit.authored_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>{formatDate(commit.authored_date)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {onSelectCommit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectCommit(commit.id)}
                  className="h-7 px-2 text-xs font-mono gap-1 hover:border-primary/60 hover:text-primary transition-colors min-h-0"
                  title="Browse repository files at this commit"
                >
                  <FolderTree className="h-3 w-3 text-primary" />
                  <span className="hidden sm:inline">Browse Files</span>
                </Button>
              )}

              <Badge
                variant="outline"
                onClick={() => handleCopySha(commit.id)}
                className="cursor-pointer font-mono text-[11px] px-2 py-0.5 gap-1 hover:bg-accent/60 transition-colors"
                title="Copy commit SHA"
              >
                <GitCommit className="h-3 w-3 text-primary" />
                <span>{commit.short_id}</span>
                {isCopied ? (
                  <Check className="h-2.5 w-2.5 text-emerald-500 ml-0.5" />
                ) : (
                  <Copy className="h-2.5 w-2.5 text-muted-foreground ml-0.5" />
                )}
              </Badge>

              {commit.web_url && (
                <a
                  href={commit.web_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
                  title="View on GitLab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
