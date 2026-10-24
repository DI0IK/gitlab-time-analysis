import { createFileRoute } from '@tanstack/react-router'
import { LeaderboardView } from '@/features/analytics/leaderboard'

export const Route = createFileRoute('/groups/$slug/leaderboard')({
  component: function RouteComponent() {
    const { slug } = Route.useParams()
    return <LeaderboardView slug={slug} />
  },
})
