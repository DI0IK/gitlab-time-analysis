import * as React from 'react'
import { FileText, Home, Folder, ChevronRight, ChevronDown, Search, BookOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'

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

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folder]: !prev[folder],
    }))
  }

  // Filter pages by search query
  const filteredPages = React.useMemo(() => {
    if (!filter.trim()) return pages
    const q = filter.toLowerCase()
    return pages.filter(
      (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    )
  }, [pages, filter])

  // Group pages into root pages and folders
  const { rootPages, folderGroups } = React.useMemo(() => {
    const root: WikiPageItem[] = []
    const groups: Record<string, WikiPageItem[]> = {}

    for (const page of filteredPages) {
      const parts = page.slug.split('/')
      if (parts.length > 1) {
        const folder = parts.slice(0, -1).join('/')
        if (!groups[folder]) groups[folder] = []
        groups[folder].push(page)
      } else {
        root.push(page)
      }
    }

    return { rootPages: root, folderGroups: groups }
  }, [filteredPages])

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

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
          <>
            {/* Root pages */}
            {rootPages.map((page) => {
              const isSelected = selectedSlug === page.slug
              const isHome = page.slug.toLowerCase() === 'home'
              return (
                <button
                  key={page.slug}
                  onClick={() => onSelectPage(page.slug)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left font-medium ${
                    isSelected
                      ? 'bg-primary/15 text-primary font-semibold'
                      : 'hover:bg-muted/50 text-foreground/90'
                  }`}
                >
                  {isHome ? (
                    <Home className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{page.title}</span>
                </button>
              )
            })}

            {/* Folder groups */}
            {Object.entries(folderGroups).map(([folder, folderPages]) => {
              const isExpanded = expandedFolders[folder] ?? true
              return (
                <div key={folder} className="pt-1">
                  <button
                    onClick={() => toggleFolder(folder)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    )}
                    <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">{folder}</span>
                    <span className="ml-auto text-[10px] opacity-60">
                      {folderPages.length}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="pl-4 space-y-0.5 border-l border-border/30 ml-2 mt-0.5">
                      {folderPages.map((page) => {
                        const isSelected = selectedSlug === page.slug
                        return (
                          <button
                            key={page.slug}
                            onClick={() => onSelectPage(page.slug)}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors text-left ${
                              isSelected
                                ? 'bg-primary/15 text-primary font-semibold'
                                : 'hover:bg-muted/50 text-foreground/80'
                            }`}
                          >
                            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{page.title}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
