import * as React from 'react'
import { Search, BookOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { buildWikiTree, WikiItemNode } from './wiki-tree-node'

export interface WikiPageItem {
  slug: string
  title: string
  path: string
  format: string
}

interface WikiSidebarProps {
  pages: WikiPageItem[]
  selectedSlug: string | null
  onSelectPage: (slug: string) => void
  isLoading?: boolean
}

export function WikiSidebar({
  pages,
  selectedSlug,
  onSelectPage,
  isLoading,
}: WikiSidebarProps) {
  const [filter, setFilter] = React.useState('')
  const [expandedFolders, setExpandedFolders] = React.useState<Record<string, boolean>>({})

  const toggleFolder = (slug: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [slug]: !(prev[slug] ?? true),
    }))
  }

  const filteredPages = React.useMemo(() => {
    if (!filter.trim()) return pages
    const q = filter.toLowerCase()
    return pages.filter(
      (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    )
  }, [pages, filter])

  const treeNodes = React.useMemo(
    () => buildWikiTree(filteredPages),
    [filteredPages]
  )

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        <div className="h-8 rounded bg-muted/40 animate-pulse w-full mb-3" />
        <div className="h-7 rounded bg-muted/30 animate-pulse w-3/4" />
        <div className="h-7 rounded bg-muted/30 animate-pulse w-5/6" />
        <div className="h-7 rounded bg-muted/30 animate-pulse w-2/3" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-card/40 border-r border-border/40 select-none">
      <div className="p-3 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter pages..."
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted/30 border-border/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {pages.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground space-y-1">
            <BookOpen className="h-6 w-6 mx-auto opacity-40 mb-1" />
            <p className="font-medium">No wiki pages found</p>
            <p className="text-[11px] opacity-70">This repository does not have any markdown pages yet.</p>
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            No pages match "{filter}"
          </div>
        ) : (
          treeNodes.map((node) => (
            <WikiItemNode
              key={node.slug}
              node={node}
              selectedSlug={selectedSlug}
              expandedFolders={expandedFolders}
              onToggleFolder={toggleFolder}
              onSelectPage={onSelectPage}
            />
          ))
        )}
      </div>
    </div>
  )
}
