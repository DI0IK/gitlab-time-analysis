import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, RefreshCw, ExternalLink, GitCommit } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { WikiSidebar, type WikiPageItem } from './wiki-sidebar'
import { WikiPageViewer, type WikiPageContentData } from './wiki-page-viewer'
import { WikiHistoryModal, type WikiCommit } from './wiki-history-modal'
import { WikiRevisionSelector } from './wiki-revision-selector'

interface WikiPaneProps {
  targetPath: string
  title?: string
  gitlabDomain?: string
}

export function WikiPane({
  targetPath,
  title,
  gitlabDomain = 'https://gitlab.com',
}: WikiPaneProps) {
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('page')
    }
    return null
  })
  const [selectedRevision, setSelectedRevision] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('rev') || ''
    }
    return ''
  })

  const [historyOpen, setHistoryOpen] = React.useState(false)

  // 1. Fetch wiki commit history for revision selector
  const {
    data: wikiCommits = [],
    isLoading: isCommitsLoading,
    refetch: refetchCommits,
  } = useQuery({
    queryKey: apiKeys.wikiHistory(targetPath),
    queryFn: async () => {
      if (!targetPath) return []
      const { data, error } = await apiClient.GET('/api/wiki/history', {
        params: { query: { project: targetPath } },
      })
      if (error || !data) return []
      return data as WikiCommit[]
    },
    enabled: Boolean(targetPath),
  })

  // 2. Fetch pages for this target at the selected revision
  const {
    data: pages = [],
    isLoading: isPagesLoading,
    refetch: refetchPages,
    isFetching: isPagesFetching,
  } = useQuery({
    queryKey: apiKeys.wikiPages(targetPath, selectedRevision),
    queryFn: async () => {
      if (!targetPath) return []
      const { data, error } = await apiClient.GET('/api/wiki/pages', {
        params: {
          query: {
            project: targetPath,
            ref: selectedRevision || undefined,
          },
        },
      })
      if (error || !data) throw new Error('Failed to load wiki pages')
      return data as WikiPageItem[]
    },
    enabled: Boolean(targetPath),
  })

  // Derive active page slug (respect selection if exists, or default to home/first page)
  const activeSlug = React.useMemo(() => {
    if (pages.length === 0) return ''
    if (selectedSlug && pages.some((p) => p.slug === selectedSlug)) {
      return selectedSlug
    }
    const homePage = pages.find((p) => p.slug.toLowerCase() === 'home') || pages[0]
    return homePage ? homePage.slug : ''
  }, [pages, selectedSlug])

  // Sync active slug & revision to URL search parameters
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (activeSlug) {
      params.set('page', activeSlug)
    } else {
      params.delete('page')
    }
    if (selectedRevision) {
      params.set('rev', selectedRevision)
    } else {
      params.delete('rev')
    }
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    window.history.replaceState({}, '', newUrl)
  }, [activeSlug, selectedRevision])

  // 3. Fetch active page content at the selected revision
  const {
    data: pageContent,
    isLoading: isPageLoading,
    refetch: refetchContent,
  } = useQuery({
    queryKey: apiKeys.wikiPage(targetPath, activeSlug, selectedRevision),
    queryFn: async () => {
      if (!targetPath || !activeSlug) return null
      const { data, error } = await apiClient.GET('/api/wiki/page', {
        params: {
          query: {
            project: targetPath,
            slug: activeSlug,
            ref: selectedRevision || undefined,
          },
        },
      })
      if (error || !data) throw new Error('Failed to load page content')
      return data as WikiPageContentData
    },
    enabled: Boolean(targetPath && activeSlug),
  })

  // 4. Fetch specific page commits when history modal is opened
  const { data: pageCommits = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: apiKeys.wikiHistory(targetPath, activeSlug),
    queryFn: async () => {
      if (!targetPath || !activeSlug) return []
      const { data, error } = await apiClient.GET('/api/wiki/history', {
        params: { query: { project: targetPath, slug: activeSlug } },
      })
      if (error || !data) return []
      return data as WikiCommit[]
    },
    enabled: Boolean(historyOpen && targetPath && activeSlug),
  })

  const gitlabWikiUrl = `${gitlabDomain.replace(/\/+$/, '')}/${targetPath.replace(/^\/+/, '')}/-/wikis`

  return (
    <div className="space-y-3">
      {/* Mini toolbar */}
      <div className="relative z-30 flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/60 bg-card/60 backdrop-blur-xs">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold text-xs truncate">
              {title || targetPath.split('/').slice(-1)[0] || targetPath} Wiki
            </span>
            {pages.length > 0 && (
              <span className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded font-mono border border-border/30">
                {pages.length} {pages.length === 1 ? 'page' : 'pages'}
              </span>
            )}
          </div>

          {/* Revision Switcher */}
          <WikiRevisionSelector
            commits={wikiCommits}
            selectedRevision={selectedRevision}
            onSelectRevision={(rev) => setSelectedRevision(rev)}
            isLoading={isCommitsLoading}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              refetchCommits()
              refetchPages()
              refetchContent()
            }}
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

      {/* Detached historical revision banner */}
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
            onClick={() => setSelectedRevision('')}
            className="text-xs text-primary hover:underline hover:text-primary/80 transition-colors shrink-0"
          >
            Switch to latest (HEAD)
          </button>
        </div>
      )}

      {/* Split pane container */}
      <Card className="border-border/60 overflow-hidden shadow-sm flex flex-col md:flex-row h-[calc(100vh-250px)] min-h-[480px]">
        {/* Left sidebar: page hierarchy */}
        <div className="w-full md:w-64 md:shrink-0 h-full">
          <WikiSidebar
            pages={pages}
            selectedSlug={activeSlug}
            onSelectPage={(slug) => setSelectedSlug(slug)}
            isLoading={isPagesLoading}
          />
        </div>

        {/* Right pane: page viewer */}
        <div className="flex-1 h-full overflow-hidden bg-background/50">
          {pageContent ? (
            <WikiPageViewer
              data={pageContent}
              gitlabDomain={gitlabDomain}
              projectPath={targetPath}
              onOpenHistory={() => setHistoryOpen(true)}
              isLoading={isPageLoading}
            />
          ) : isPagesLoading ? (
            <div className="p-8 space-y-4 animate-pulse">
              <div className="h-8 bg-muted/40 rounded w-1/3" />
              <div className="h-4 bg-muted/30 rounded w-1/4" />
              <div className="h-48 bg-muted/20 rounded w-full" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10 stroke-[1.2] opacity-30 mb-2" />
              <h3 className="text-sm font-semibold text-foreground/80 mb-1">
                {pages.length === 0 ? 'No Wiki Pages Available' : 'Select a page'}
              </h3>
              <p className="text-xs max-w-sm text-muted-foreground">
                {pages.length === 0
                  ? 'This repository or group does not have any wiki markdown pages initialized on GitLab.'
                  : 'Choose a page from the sidebar to view its documentation and revision history.'}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Revision History Modal */}
      <WikiHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        pageTitle={pageContent?.title || activeSlug}
        commits={pageCommits}
        isLoading={isHistoryLoading}
      />
    </div>
  )
}
