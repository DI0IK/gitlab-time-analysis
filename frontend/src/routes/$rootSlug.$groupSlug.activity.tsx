import { createFileRoute } from '@tanstack/react-router'
import { GroupActivityView } from '@/features/analytics/activity'

export const Route = createFileRoute('/$rootSlug/$groupSlug/activity')({
  component: GroupActivityRoute,
})

function GroupActivityRoute() {
  const { rootSlug, groupSlug } = Route.useParams()
  return <GroupActivityView rootSlug={rootSlug} groupSlug={groupSlug} />
}
