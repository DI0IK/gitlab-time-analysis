import { createFileRoute } from '@tanstack/react-router'
import { GroupWikiView } from '@/features/wiki/group-wiki'

export const Route = createFileRoute('/groups/$slug/wiki')({
  component: function RouteComponent() {
    const { slug } = Route.useParams()
    return <GroupWikiView key={slug} slug={slug} />
  },
})
