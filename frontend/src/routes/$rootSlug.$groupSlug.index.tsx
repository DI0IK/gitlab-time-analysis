import { createFileRoute } from '@tanstack/react-router'
import { GroupAnalyticsView } from '@/features/analytics/group'

export const Route = createFileRoute('/$rootSlug/$groupSlug/')({
  component: GroupDashboardRoute,
})

function GroupDashboardRoute() {
  const { rootSlug, groupSlug } = Route.useParams()
  return <GroupAnalyticsView rootSlug={rootSlug} groupSlug={groupSlug} />
}
