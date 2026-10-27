import { createFileRoute } from '@tanstack/react-router'
import { LeaderboardView } from '@/features/analytics/leaderboard'

export const Route = createFileRoute('/$rootSlug/$groupSlug/leaderboard')({
  component: GroupLeaderboardRoute,
})

function GroupLeaderboardRoute() {
  const { rootSlug, groupSlug } = Route.useParams()
  return <LeaderboardView rootSlug={rootSlug} groupSlug={groupSlug} />
}
