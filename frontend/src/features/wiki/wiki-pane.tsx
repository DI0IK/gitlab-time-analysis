import * as React from 'react'
import { BookOpen } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { WikiSidebar } from './wiki-sidebar'
import { WikiPageViewer } from './wiki-page-viewer'
import { WikiHistoryModal } from './wiki-history-modal'
import { WikiToolbar } from './wiki-toolbar'
import { resolveWikiSlug } from './wiki-slug-helpers'
import { useWikiQueries } from './use-wiki-queries'

interface WikiPaneProps {
  targetPath: string
  title?: string
  gitlabDomain?: string
  page?: string
  rev?: string
  onPageChange?: (slug: string) => void
  onRevisionChange?: (rev: string) => void
}

export function WikiPane({
  targetPath,
  title,
  gitlabDomain = 'https://gitlab.com',
  page: controlledPage,
  rev: controlledRev,
  onPageChange,
  onRevisionChange,
}: WikiPaneProps) {
  // If controlled, use prop; otherwise fallback to URL or internal state
  const [internalSlug, setInternalSlug] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const param = new URLSearchParams(window.location.search).get('page')
    if (param) return param
    const hash = window.location.hash
    return hash.startsWith('#wiki:') ? hash.replace('#wiki:', '') : null
  })

  const [internalRevision, setInternalRevision] = React.useState<string>(() => {
    return typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('rev') || ''
      : ''
  })

  const [historyOpen, setHistoryOpen] = React.useState(false)

  const activeSelectedSlug = controlledPage !== undefined ? controlledPage : internalSlug
  const activeSelectedRevision = controlledRev !== undefined ? controlledRev : internalRevision

  const {
    wikiCommits,
    isCommitsLoading,
    refetchCommits,
    pages,
    activeSlug,
    isPagesLoading,
    isPagesFetching,
    refetchPages,
    pageContent,
    isPageLoading,
    refetchContent,
    pageCommits,
    isHistoryLoading,
  } = useWikiQueries({
    targetPath,
    activeSelectedSlug,
    selectedRevision: activeSelectedRevision,
    historyOpen,
  })

  const handleSelectPage = React.useCallback(
    (target: string) => {
      const resolved = resolveWikiSlug(target, activeSlug, pages)
      const nextSlug = resolved || target
      if (onPageChange) {
        onPageChange(nextSlug)
      } else {
        setInternalSlug(nextSlug)
      }
    },
    [activeSlug, pages, onPageChange]
  )

  const handleSelectRevision = React.useCallback(
    (rev: string) => {
      if (onRevisionChange) {
        onRevisionChange(rev)
      } else {
        setInternalRevision(rev)
      }
    },
    [onRevisionChange]
  )

  // Sync to URL only when in uncontrolled mode
  React.useEffect(() => {
    if (controlledPage !== undefined || typeof window === 'undefined' || !activeSlug) return
    const params = new URLSearchParams(window.location.search)
    params.set('page', activeSlug)
    if (activeSelectedRevision) params.set('rev', activeSelectedRevision)
    else params.delete('rev')
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
  }, [controlledPage, activeSlug, activeSelectedRevision])

  return (
    <div className="space-y-3">
      <WikiToolbar
        title={title}
        targetPath={targetPath}
        gitlabDomain={gitlabDomain}
        pageCount={pages.length}
        commits={wikiCommits}
        selectedRevision={activeSelectedRevision}
        onSelectRevision={handleSelectRevision}
        isCommitsLoading={isCommitsLoading}
        isPagesFetching={isPagesFetching}
        onRefresh={() => {
          refetchCommits()
          refetchPages()
          refetchContent()
        }}
      />

      <Card className="border-border/60 overflow-hidden shadow-xs flex flex-col md:flex-row h-[calc(100vh-250px)] min-h-[500px] bg-card/40 backdrop-blur-xs">
        <div className="w-full md:w-64 md:shrink-0 h-full border-r border-border/40">
          <WikiSidebar
            pages={pages}
            selectedSlug={activeSlug}
            onSelectPage={handleSelectPage}
            isLoading={isPagesLoading}
          />
        </div>

        <div className="flex-1 h-full overflow-hidden bg-background/40">
          {pageContent ? (
            <WikiPageViewer
              data={pageContent}
              gitlabDomain={gitlabDomain}
              projectPath={targetPath}
              onOpenHistory={() => setHistoryOpen(true)}
              onSelectPage={handleSelectPage}
              isLoading={isPageLoading}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10 stroke-[1.2] opacity-30 mb-2" />
              <h3 className="text-sm font-semibold text-foreground/80 mb-1">
                {pages.length === 0 ? 'No Wiki Pages Available' : 'Select a page'}
              </h3>
              <p className="text-xs max-w-sm text-muted-foreground">
                {pages.length === 0
                  ? 'No markdown documentation pages initialized on GitLab.'
                  : 'Choose a page from the sidebar to view documentation.'}
              </p>
            </div>
          )}
        </div>
      </Card>

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
