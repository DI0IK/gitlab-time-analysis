import { createFileRoute } from '@tanstack/react-router'
import { MergeRequestsView } from '@/features/merge-requests/list'

export const Route = createFileRoute('/groups/$slug/merge-requests')({
  component: function RouteComponent() {
    const { slug } = Route.useParams()
    return <MergeRequestsView slug={slug} />
  },
})
