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
}

export function WikiPane({ targetPath, title, gitlabDomain = 'https://gitlab.com' }: WikiPaneProps) {
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const param = new URLSearchParams(window.location.search).get('page')
    if (param) return param
    const hash = window.location.hash
    return hash.startsWith('#wiki:') ? hash.replace('#wiki:', '') : null
  })
  const [selectedRevision, setSelectedRevision] = React.useState<string>(() => {
    return typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('rev') || '' : ''
  })
  const [historyOpen, setHistoryOpen] = React.useState(false)

  // Intermediate state for pages to calculate activeSlug
  const [activeSlug, setActiveSlug] = React.useState<string>('')

  const {
    wikiCommits,
    isCommitsLoading,
    refetchCommits,
    pages,
    isPagesLoading,
    isPagesFetching,
    refetchPages,
    pageContent,
    isPageLoading,
    refetchContent,
    pageCommits,
    isHistoryLoading,
  } = useWikiQueries({ targetPath, activeSlug, selectedRevision, historyOpen })

  React.useEffect(() => {
    if (pages.length === 0) return
    if (selectedSlug) {
      const resolved = resolveWikiSlug(selectedSlug, selectedSlug, pages)
      const found = pages.find((p) => p.slug === resolved || p.slug.toLowerCase() === resolved.toLowerCase())
      if (found) {
        setActiveSlug(found.slug)
        return
      }
    }
    const home = pages.find((p) => p.slug.toLowerCase() === 'home') || pages[0]
    if (home) setActiveSlug(home.slug)
  }, [pages, selectedSlug])

  const handleSelectPage = React.useCallback(
    (target: string) => {
      const resolved = resolveWikiSlug(target, activeSlug, pages)
      setSelectedSlug(resolved || target)
    },
    [activeSlug, pages]
  )

  React.useEffect(() => {
    if (typeof window === 'undefined' || !activeSlug) return
    const params = new URLSearchParams(window.location.search)
    params.set('page', activeSlug)
    if (selectedRevision) params.set('rev', selectedRevision)
    else params.delete('rev')
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
  }, [activeSlug, selectedRevision])

  return (
    <div className="space-y-3">
      <WikiToolbar
        title={title}
        targetPath={targetPath}
        gitlabDomain={gitlabDomain}
        pageCount={pages.length}
        commits={wikiCommits}
        selectedRevision={selectedRevision}
        onSelectRevision={(rev) => setSelectedRevision(rev)}
        isCommitsLoading={isCommitsLoading}
        isPagesFetching={isPagesFetching}
        onRefresh={() => { refetchCommits(); refetchPages(); refetchContent() }}
      />

      <Card className="border-border/60 overflow-hidden shadow-sm flex flex-col md:flex-row h-[calc(100vh-250px)] min-h-[480px]">
        <div className="w-full md:w-64 md:shrink-0 h-full">
          <WikiSidebar pages={pages} selectedSlug={activeSlug} onSelectPage={handleSelectPage} isLoading={isPagesLoading} />
        </div>

        <div className="flex-1 h-full overflow-hidden bg-background/50">
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
                {pages.length === 0 ? 'No markdown pages initialized on GitLab.' : 'Choose a page to view documentation.'}
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
