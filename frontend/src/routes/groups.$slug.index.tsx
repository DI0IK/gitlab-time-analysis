import { createFileRoute } from '@tanstack/react-router'
import { GroupAnalyticsView } from '@/features/analytics/group'

export const Route = createFileRoute('/groups/$slug/')({
  component: function RouteComponent() {
    const { slug } = Route.useParams()
    return <GroupAnalyticsView slug={slug} />
  },
})
