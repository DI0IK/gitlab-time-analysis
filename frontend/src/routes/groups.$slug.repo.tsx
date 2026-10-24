import { createFileRoute } from '@tanstack/react-router'
import { RepoBrowserView } from '@/features/repo/browser'

export const Route = createFileRoute('/groups/$slug/repo')({
  component: function RouteComponent() {
    const { slug } = Route.useParams()
    return <RepoBrowserView slug={slug} />
  },
})
