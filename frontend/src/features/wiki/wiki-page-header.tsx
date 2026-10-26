import {
  History,
  ExternalLink,
  Copy,
  Check,
  User,
  Calendar,
  GitCommit,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { WikiPageContentData } from './wiki-page-viewer'

interface WikiPageHeaderProps {
  data: WikiPageContentData
  gitlabWikiUrl: string
  copied: boolean
  onCopy: () => void
  onOpenHistory: () => void
}

export function WikiPageHeader({
  data,
  gitlabWikiUrl,
  copied,
  onCopy,
  onOpenHistory,
}: WikiPageHeaderProps) {
  return (
    <div className="border-b border-border/40 pb-4 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {data.title}
        </h1>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCopy} className="h-8 text-xs gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy Markdown'}
          </Button>

          <Button variant="outline" size="sm" onClick={onOpenHistory} className="h-8 text-xs gap-1.5">
            <History className="h-3.5 w-3.5 text-primary" />
            Revisions
          </Button>

          <a
            href={gitlabWikiUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-border/60 bg-background hover:bg-muted/60 h-8 px-3 gap-1.5 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on GitLab
          </a>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        {data.last_author_name && (
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 opacity-70" />
            {data.last_author_name}
          </span>
        )}
        {data.last_commit_date && (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 opacity-70" />
            {new Date(data.last_commit_date).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        )}
        {data.last_commit_id && (
          <span className="flex items-center gap-1.5 font-mono text-[11px] bg-muted/40 px-2 py-0.5 rounded border border-border/30">
            <GitCommit className="h-3 w-3 opacity-70" />
            {data.last_commit_id.slice(0, 8)}
          </span>
        )}
        <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
          {data.format || 'markdown'}
        </Badge>
      </div>
    </div>
  )
}
