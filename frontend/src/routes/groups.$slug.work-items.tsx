import { createFileRoute } from '@tanstack/react-router'
import { WorkItemsExplorer } from '@/features/work-items/explorer'

export const Route = createFileRoute('/groups/$slug/work-items')({
  component: function RouteComponent() {
    const { slug } = Route.useParams()
    return <WorkItemsExplorer slug={slug} />
  },
})
