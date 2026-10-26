import * as React from 'react'
import { BookOpen, List } from 'lucide-react'
import { Markdown } from '@/components/ui/markdown'
import { WikiPageHeader } from './wiki-page-header'

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
  onSelectPage?: (slug: string) => void
  isLoading?: boolean
}

export function WikiPageViewer({
  data,
  gitlabDomain,
  projectPath,
  onOpenHistory,
  onSelectPage,
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

  const headings = React.useMemo(() => {
    if (!data.content) return []
    const clean = data.content.replace(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]*/, '')
    const lines = clean.split('\n')
    const list: { level: number; text: string; id: string }[] = []

    for (const line of lines) {
      if (line.startsWith('# ')) {
        const text = line.slice(2).replace(/\*\*/g, '').trim()
        list.push({ level: 1, text, id: text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') })
      } else if (line.startsWith('## ')) {
        const text = line.slice(3).replace(/\*\*/g, '').trim()
        list.push({ level: 2, text, id: text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') })
      } else if (line.startsWith('### ')) {
        const text = line.slice(4).replace(/\*\*/g, '').trim()
        list.push({ level: 3, text, id: text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') })
      }
    }
    return list
  }, [data.content])

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
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
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        <WikiPageHeader
          data={data}
          gitlabWikiUrl={gitlabWikiUrl}
          copied={copied}
          onCopy={handleCopy}
          onOpenHistory={onOpenHistory}
        />

        <div className="max-w-none text-foreground/90 leading-relaxed font-sans text-sm">
          {data.content ? (
            <Markdown
              content={data.content}
              className="text-sm leading-relaxed"
              onWikiLinkClick={onSelectPage}
            />
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto opacity-30 mb-2" />
              <p>This wiki page is empty.</p>
            </div>
          )}
        </div>
      </div>

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
                  h.level === 1 ? 'font-medium text-foreground/90' : h.level === 2 ? 'pl-3' : 'pl-6 text-[11px]'
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
