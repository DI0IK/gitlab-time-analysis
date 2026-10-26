import { BookOpen, RefreshCw, ExternalLink, GitCommit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WikiRevisionSelector } from './wiki-revision-selector'
import type { WikiCommit } from './wiki-history-modal'

interface WikiToolbarProps {
  title?: string
  targetPath: string
  gitlabDomain: string
  pageCount: number
  commits: WikiCommit[]
  selectedRevision: string
  onSelectRevision: (rev: string) => void
  isCommitsLoading?: boolean
  isPagesFetching?: boolean
  onRefresh: () => void
}

export function WikiToolbar({
  title,
  targetPath,
  gitlabDomain,
  pageCount,
  commits,
  selectedRevision,
  onSelectRevision,
  isCommitsLoading,
  isPagesFetching,
  onRefresh,
}: WikiToolbarProps) {
  const cleanTarget = targetPath.replace(/^\/+/, '')
  const gitlabWikiUrl = `${gitlabDomain.replace(/\/+$/, '')}/${cleanTarget}/-/wikis`

  return (
    <div className="space-y-2">
      <div className="relative z-30 flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/60 bg-card/60 backdrop-blur-xs">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold text-xs truncate">
              {title || targetPath.split('/').slice(-1)[0] || targetPath} Wiki
            </span>
            {pageCount > 0 && (
              <span className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded font-mono border border-border/30">
                {pageCount} {pageCount === 1 ? 'page' : 'pages'}
              </span>
            )}
          </div>

          <WikiRevisionSelector
            commits={commits}
            selectedRevision={selectedRevision}
            onSelectRevision={onSelectRevision}
            isLoading={isCommitsLoading}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isPagesFetching}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            title="Refresh wiki"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPagesFetching ? 'animate-spin' : ''}`} />
          </Button>

          <a
            href={gitlabWikiUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-border/60 bg-background hover:bg-muted/60 h-8 px-2.5 gap-1.5 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">GitLab</span>
          </a>
        </div>
      </div>

      {selectedRevision && selectedRevision !== 'HEAD' && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-purple-500/10 border border-purple-500/20 text-xs font-mono">
          <div className="flex items-center gap-2 text-foreground">
            <GitCommit className="h-3.5 w-3.5 text-purple-400 shrink-0" />
            <span>
              Viewing wiki at historical revision{' '}
              <strong className="text-purple-300">{selectedRevision.slice(0, 8)}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectRevision('')}
            className="text-xs text-primary hover:underline hover:text-primary/80 transition-colors shrink-0"
          >
            Switch to latest (HEAD)
          </button>
        </div>
      )}
    </div>
  )
}
