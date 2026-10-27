import { createFileRoute } from '@tanstack/react-router'
import { RepoBrowserView } from '@/features/repo/browser'

export const Route = createFileRoute('/$rootSlug/$groupSlug/repo')({
  component: GroupRepoRoute,
})

function GroupRepoRoute() {
  const { rootSlug, groupSlug } = Route.useParams()
  return <RepoBrowserView rootSlug={rootSlug} groupSlug={groupSlug} />
}
