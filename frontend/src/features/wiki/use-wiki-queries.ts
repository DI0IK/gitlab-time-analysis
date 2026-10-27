import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import { resolveWikiSlug } from './wiki-slug-helpers'
import type { WikiPageItem } from './wiki-sidebar'
import type { WikiPageContentData } from './wiki-page-viewer'
import type { WikiCommit } from './wiki-history-modal'

import { useTenant } from '@/features/tenant/tenant-context'

interface UseWikiQueriesOptions {
  targetPath: string
  activeSelectedSlug?: string | null
  selectedRevision: string
  historyOpen: boolean
  rootSlug?: string
}

export function useWikiQueries({
  targetPath,
  activeSelectedSlug,
  selectedRevision,
  historyOpen,
  rootSlug: propRootSlug,
}: UseWikiQueriesOptions) {
  const tenant = useTenant()
  const effectiveRootSlug = propRootSlug || tenant.rootSlug

  const commitsQuery = useQuery({
    queryKey: apiKeys.rootWikiHistory(effectiveRootSlug, targetPath),
    queryFn: async () => {
      if (!targetPath || !effectiveRootSlug) return []
      const { data, error } = await apiClient.GET('/api/{root_slug}/wiki/history', {
        params: {
          path: { root_slug: effectiveRootSlug },
          query: { project: targetPath },
        },
      })
      return error || !data ? [] : (data as WikiCommit[])
    },
    enabled: Boolean(targetPath && effectiveRootSlug),
  })

  const pagesQuery = useQuery({
    queryKey: apiKeys.rootWikiPages(effectiveRootSlug, targetPath, selectedRevision),
    queryFn: async () => {
      if (!targetPath || !effectiveRootSlug) return []
      const { data, error } = await apiClient.GET('/api/{root_slug}/wiki/pages', {
        params: {
          path: { root_slug: effectiveRootSlug },
          query: { project: targetPath, ref: selectedRevision || undefined },
        },
      })
      if (error || !data) throw new Error('Failed to load wiki pages')
      return data as WikiPageItem[]
    },
    enabled: Boolean(targetPath && effectiveRootSlug),
  })

  const pages = React.useMemo(() => pagesQuery.data ?? [], [pagesQuery.data])

  const activeSlug = React.useMemo(() => {
    if (pages.length === 0) return ''
    if (activeSelectedSlug) {
      const resolved = resolveWikiSlug(activeSelectedSlug, activeSelectedSlug, pages)
      const found = pages.find(
        (p) => p.slug === resolved || p.slug.toLowerCase() === resolved.toLowerCase()
      )
      if (found) return found.slug
    }
    const home = pages.find((p) => p.slug.toLowerCase() === 'home') || pages[0]
    return home ? home.slug : ''
  }, [pages, activeSelectedSlug])

  const contentQuery = useQuery({
    queryKey: apiKeys.rootWikiPage(effectiveRootSlug, targetPath, activeSlug, selectedRevision),
    queryFn: async () => {
      if (!targetPath || !activeSlug || !effectiveRootSlug) return null
      const { data, error } = await apiClient.GET('/api/{root_slug}/wiki/page', {
        params: {
          path: { root_slug: effectiveRootSlug },
          query: { project: targetPath, slug: activeSlug, ref: selectedRevision || undefined },
        },
      })
      if (error || !data) throw new Error('Failed to load page content')
      return data as WikiPageContentData
    },
    enabled: Boolean(targetPath && activeSlug && effectiveRootSlug),
  })

  const pageCommitsQuery = useQuery({
    queryKey: apiKeys.rootWikiHistory(effectiveRootSlug, targetPath, activeSlug),
    queryFn: async () => {
      if (!targetPath || !activeSlug || !effectiveRootSlug) return []
      const { data, error } = await apiClient.GET('/api/{root_slug}/wiki/history', {
        params: {
          path: { root_slug: effectiveRootSlug },
          query: { project: targetPath, slug: activeSlug },
        },
      })
      return error || !data ? [] : (data as WikiCommit[])
    },
    enabled: Boolean(historyOpen && targetPath && activeSlug && effectiveRootSlug),
  })

  return {
    wikiCommits: commitsQuery.data ?? [],
    isCommitsLoading: commitsQuery.isLoading,
    refetchCommits: commitsQuery.refetch,
    pages,
    activeSlug,
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
