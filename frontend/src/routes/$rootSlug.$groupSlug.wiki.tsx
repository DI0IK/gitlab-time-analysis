import { createFileRoute } from '@tanstack/react-router'
import { GroupWikiView } from '@/features/wiki/group-wiki'

export const Route = createFileRoute('/$rootSlug/$groupSlug/wiki')({
  component: GroupWikiRoute,
})

function GroupWikiRoute() {
  const { rootSlug, groupSlug } = Route.useParams()
  return <GroupWikiView rootSlug={rootSlug} groupSlug={groupSlug} />
}
