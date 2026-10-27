import { createFileRoute } from '@tanstack/react-router'
import { WorkItemsExplorer } from '@/features/work-items/explorer'

export const Route = createFileRoute('/$rootSlug/$groupSlug/work-items')({
  component: GroupWorkItemsRoute,
})

function GroupWorkItemsRoute() {
  const { rootSlug, groupSlug } = Route.useParams()
  return <WorkItemsExplorer rootSlug={rootSlug} groupSlug={groupSlug} />
}
