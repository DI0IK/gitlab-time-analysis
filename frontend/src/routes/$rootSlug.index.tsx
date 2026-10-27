import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import { GroupAnalyticsView } from '@/features/analytics/group'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/$rootSlug/')({
  component: RootIndexRoute,
})

function RootIndexRoute() {
  const { rootSlug } = Route.useParams()

  // Find the actual root group slug from /api/{root_slug}/groups
  const { data: groups, isLoading } = useQuery({
    queryKey: apiKeys.rootGroups(rootSlug),
    queryFn: async () => {
      const res = await apiClient.GET('/api/{root_slug}/groups', {
        params: { path: { root_slug: rootSlug } },
      })
      if (res.error || !Array.isArray(res.data)) {
        return []
      }
      return res.data
    },
  })

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        <p className="text-xs text-muted-foreground mt-2">Loading root group statistics...</p>
      </div>
    )
  }

  // Safely find root group record (level 0 or first group in hierarchy)
  const groupList = Array.isArray(groups) ? groups : []
  const rootGroup = groupList.find((g) => g.level === 0) || groupList[0]
  const groupSlug = rootGroup ? rootGroup.full_path.replace(/\//g, '-') : rootSlug

  return <GroupAnalyticsView rootSlug={rootSlug} groupSlug={groupSlug} />
}
