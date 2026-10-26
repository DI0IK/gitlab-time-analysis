import { createFileRoute } from '@tanstack/react-router'
import { GroupActivityView } from '@/features/analytics/activity'

export const Route = createFileRoute('/groups/$slug/activity')({
  component: function RouteComponent() {
    const { slug } = Route.useParams()
    return <GroupActivityView slug={slug} />
  },
})
