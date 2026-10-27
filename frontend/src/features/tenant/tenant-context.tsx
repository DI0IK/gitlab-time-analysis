import * as React from 'react'
import { useRouterState, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import type { components } from '@/lib/api/schema'

export type PublicRootGroup = components['schemas']['PublicRootGroupRecord']

interface TenantContextValue {
  roots: PublicRootGroup[]
  activeRoot: PublicRootGroup | undefined
  rootSlug: string
  groupSlug: string | null
  isLoading: boolean
  switchRoot: (newRootSlug: string, newGroupSlug?: string) => void
}

const TenantContext = React.createContext<TenantContextValue | null>(null)

const SAVED_ROOT_KEY = 'gitlab-platform:active-root-slug'

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const routerState = useRouterState()
  const navigate = useNavigate()
  const pathname = routerState.location.pathname

  const { data: roots = [], isLoading } = useQuery({
    queryKey: apiKeys.roots,
    queryFn: async () => {
      const res = await apiClient.GET('/api/roots')
      return res.data ?? []
    },
    staleTime: 60 * 1000,
  })

  // Extract rootSlug and groupSlug from pathname
  // Path formats:
  //   /:rootSlug
  //   /:rootSlug/users/:username
  //   /:rootSlug/:groupSlug
  //   /:rootSlug/:groupSlug/:tab
  const pathParts = pathname.split('/').filter(Boolean)
  const firstSegment = pathParts[0] ?? ''

  // Known top-level non-tenant routes
  const isGlobalRoute = ['admin', 'settings', 'auth'].includes(firstSegment)

  let extractedRootSlug = ''
  let extractedGroupSlug: string | null = null

  if (!isGlobalRoute && firstSegment) {
    extractedRootSlug = firstSegment
    if (pathParts[1] === 'users') {
      // User profile page: /:rootSlug/users/:username
      extractedGroupSlug = null
    } else if (pathParts[1]) {
      // Group route: /:rootSlug/:groupSlug/...
      extractedGroupSlug = pathParts[1]
    }
  }

  // Fallback root slug if on global route or root
  const fallbackRootSlug =
    localStorage.getItem(SAVED_ROOT_KEY) || roots[0]?.slug || 'tinf24'

  const effectiveRootSlug = extractedRootSlug || fallbackRootSlug

  const activeRoot = React.useMemo(() => {
    return roots.find((r) => r.slug === effectiveRootSlug) || roots[0]
  }, [roots, effectiveRootSlug])

  React.useEffect(() => {
    if (activeRoot?.slug) {
      localStorage.setItem(SAVED_ROOT_KEY, activeRoot.slug)
    }
  }, [activeRoot?.slug])

  const switchRoot = React.useCallback(
    (newRootSlug: string, newGroupSlug?: string) => {
      localStorage.setItem(SAVED_ROOT_KEY, newRootSlug)
      if (newGroupSlug) {
        navigate({ to: `/${newRootSlug}/${newGroupSlug}` })
      } else {
        navigate({ to: `/${newRootSlug}` })
      }
    },
    [navigate]
  )

  const value = React.useMemo(
    () => ({
      roots,
      activeRoot,
      rootSlug: activeRoot?.slug || effectiveRootSlug,
      groupSlug: extractedGroupSlug,
      isLoading,
      switchRoot,
    }),
    [roots, activeRoot, effectiveRootSlug, extractedGroupSlug, isLoading, switchRoot]
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const context = React.useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}
