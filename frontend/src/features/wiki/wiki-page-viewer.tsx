import * as React from 'react'
import {
  History,
  ExternalLink,
  Copy,
  Check,
  User,
  Calendar,
  GitCommit,
  BookOpen,
  List,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface WikiPageContentData {
  slug: string
  title: string
  content: string
  format?: string
  last_commit_id?: string
  last_author_name?: string
  last_commit_date?: string
}

interface WikiPageViewerProps {
  data: WikiPageContentData
  gitlabDomain: string
  projectPath: string
  onOpenHistory: () => void
  isLoading?: boolean
}

export function WikiPageViewer({
  data,
  gitlabDomain,
  projectPath,
  onOpenHistory,
  isLoading,
}: WikiPageViewerProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    if (!data.content) return
    try {
      await navigator.clipboard.writeText(data.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  // Extract table of contents (headings level 1-3)
  const headings = React.useMemo(() => {
    if (!data.content) return []
    const lines = data.content.split('\n')
    const list: { level: number; text: string; id: string }[] = []

    for (const line of lines) {
      const match = line.match(/^(#{1,3})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const text = match[2].trim()
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
        list.push({ level, text, id })
      }
    }
    return list
  }, [data.content])

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-muted/40 rounded w-1/3" />
        <div className="h-4 bg-muted/30 rounded w-1/4" />
        <div className="h-48 bg-muted/20 rounded w-full" />
      </div>
    )
  }

  const cleanProjectPath = projectPath.replace(/^\/+/, '')
  const gitlabWikiUrl = `${gitlabDomain.replace(/\/+$/, '')}/${cleanProjectPath}/-/wikis/${encodeURIComponent(data.slug)}`

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Main markdown content pane */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {/* Header bar */}
        <div className="border-b border-border/40 pb-4 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {data.title}
            </h1>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-8 text-xs gap-1.5"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? 'Copied' : 'Copy Markdown'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onOpenHistory}
                className="h-8 text-xs gap-1.5"
              >
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

          {/* Metadata chips */}
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

        {/* Rendered content */}
        <div className="prose prose-invert max-w-none space-y-4 text-foreground/90 leading-relaxed font-sans text-sm">
          {data.content ? (
            <SimpleMarkdownRenderer content={data.content} />
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto opacity-30 mb-2" />
              <p>This wiki page is empty.</p>
            </div>
          )}
        </div>
      </div>

      {/* Table of contents sidebar (if 2+ headings) */}
      {headings.length >= 2 && (
        <div className="hidden xl:block w-64 border-l border-border/40 p-4 overflow-y-auto bg-card/20 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            <List className="h-3.5 w-3.5" />
            Table of Contents
          </div>
          <nav className="space-y-1 text-xs">
            {headings.map((h, i) => (
              <a
                key={i}
                href={`#${h.id}`}
                className={`block py-1 text-muted-foreground hover:text-foreground transition-colors truncate ${
                  h.level === 1
                    ? 'font-medium text-foreground/90'
                    : h.level === 2
                    ? 'pl-3'
                    : 'pl-6 text-[11px]'
                }`}
              >
                {h.text}
              </a>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}

function SimpleMarkdownRenderer({ content }: { content: string }) {
  const blocks = React.useMemo(() => {
    const lines = content.split('\n')
    const result: React.ReactNode[] = []
    let inCodeBlock = false
    let codeContent: string[] = []
    let codeLanguage = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('```')) {
        if (inCodeBlock) {
          result.push(
            <pre
              key={i}
              data-language={codeLanguage || undefined}
              className="p-3 my-3 rounded-md bg-muted/60 border border-border/50 text-xs font-mono overflow-x-auto text-emerald-300"
            >
              <code>{codeContent.join('\n')}</code>
            </pre>
          )
          inCodeBlock = false
          codeContent = []
        } else {
          inCodeBlock = true
          codeLanguage = line.slice(3).trim()
        }
        continue
      }

      if (inCodeBlock) {
        codeContent.push(line)
        continue
      }

      if (line.startsWith('# ')) {
        const text = line.slice(2)
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
        result.push(
          <h1 key={i} id={id} className="text-xl font-bold mt-6 mb-3 border-b border-border/30 pb-1 text-foreground">
            {text}
          </h1>
        )
      } else if (line.startsWith('## ')) {
        const text = line.slice(3)
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
        result.push(
          <h2 key={i} id={id} className="text-lg font-semibold mt-5 mb-2 text-foreground">
            {text}
          </h2>
        )
      } else if (line.startsWith('### ')) {
        const text = line.slice(4)
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
        result.push(
          <h3 key={i} id={id} className="text-base font-medium mt-4 mb-1 text-foreground/90">
            {text}
          </h3>
        )
      } else if (line.startsWith('> ')) {
        result.push(
          <blockquote key={i} className="border-l-2 border-primary/60 pl-3 my-2 text-muted-foreground italic text-xs">
            {line.slice(2)}
          </blockquote>
        )
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        result.push(
          <li key={i} className="ml-4 list-disc text-xs text-foreground/85 my-0.5">
            {line.slice(2)}
          </li>
        )
      } else if (/^\d+\.\s/.test(line)) {
        result.push(
          <li key={i} className="ml-4 list-decimal text-xs text-foreground/85 my-0.5">
            {line.replace(/^\d+\.\s/, '')}
          </li>
        )
      } else if (line.trim() === '') {
        // spacing
      } else {
        result.push(
          <p key={i} className="my-1.5 text-xs text-foreground/85 leading-normal">
            {line}
          </p>
        )
      }
    }

    return result
  }, [content])

  return <div className="space-y-1">{blocks}</div>
}
