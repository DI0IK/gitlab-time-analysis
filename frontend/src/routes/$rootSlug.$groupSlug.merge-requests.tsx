import { createFileRoute } from '@tanstack/react-router'
import { MergeRequestsView } from '@/features/merge-requests/list'

export const Route = createFileRoute('/$rootSlug/$groupSlug/merge-requests')({
  component: GroupMergeRequestsRoute,
})

function GroupMergeRequestsRoute() {
  const { rootSlug, groupSlug } = Route.useParams()
  return <MergeRequestsView rootSlug={rootSlug} groupSlug={groupSlug} />
}
