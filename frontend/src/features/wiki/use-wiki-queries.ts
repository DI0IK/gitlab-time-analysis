import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import type { WikiPageItem } from './wiki-sidebar'
import type { WikiPageContentData } from './wiki-page-viewer'
import type { WikiCommit } from './wiki-history-modal'

interface UseWikiQueriesOptions {
  targetPath: string
  activeSlug: string
  selectedRevision: string
  historyOpen: boolean
}

export function useWikiQueries({
  targetPath,
  activeSlug,
  selectedRevision,
  historyOpen,
}: UseWikiQueriesOptions) {
  const commitsQuery = useQuery({
    queryKey: apiKeys.wikiHistory(targetPath),
    queryFn: async () => {
      if (!targetPath) return []
      const { data, error } = await apiClient.GET('/api/wiki/history', {
        params: { query: { project: targetPath } },
      })
      return error || !data ? [] : (data as WikiCommit[])
    },
    enabled: Boolean(targetPath),
  })

  const pagesQuery = useQuery({
    queryKey: apiKeys.wikiPages(targetPath, selectedRevision),
    queryFn: async () => {
      if (!targetPath) return []
      const { data, error } = await apiClient.GET('/api/wiki/pages', {
        params: { query: { project: targetPath, ref: selectedRevision || undefined } },
      })
      if (error || !data) throw new Error('Failed to load wiki pages')
      return data as WikiPageItem[]
    },
    enabled: Boolean(targetPath),
  })

  const contentQuery = useQuery({
    queryKey: apiKeys.wikiPage(targetPath, activeSlug, selectedRevision),
    queryFn: async () => {
      if (!targetPath || !activeSlug) return null
      const { data, error } = await apiClient.GET('/api/wiki/page', {
        params: { query: { project: targetPath, slug: activeSlug, ref: selectedRevision || undefined } },
      })
      if (error || !data) throw new Error('Failed to load page content')
      return data as WikiPageContentData
    },
    enabled: Boolean(targetPath && activeSlug),
  })

  const pageCommitsQuery = useQuery({
    queryKey: apiKeys.wikiHistory(targetPath, activeSlug),
    queryFn: async () => {
      if (!targetPath || !activeSlug) return []
      const { data, error } = await apiClient.GET('/api/wiki/history', {
        params: { query: { project: targetPath, slug: activeSlug } },
      })
      return error || !data ? [] : (data as WikiCommit[])
    },
    enabled: Boolean(historyOpen && targetPath && activeSlug),
  })

  return {
    wikiCommits: commitsQuery.data ?? [],
    isCommitsLoading: commitsQuery.isLoading,
    refetchCommits: commitsQuery.refetch,
    pages: pagesQuery.data ?? [],
    isPagesLoading: pagesQuery.isLoading,
    isPagesFetching: pagesQuery.isFetching,
    refetchPages: pagesQuery.refetch,
    pageContent: contentQuery.data,
    isPageLoading: contentQuery.isLoading,
    refetchContent: contentQuery.refetch,
    pageCommits: pageCommitsQuery.data ?? [],
    isHistoryLoading: pageCommitsQuery.isLoading,
  }
}
