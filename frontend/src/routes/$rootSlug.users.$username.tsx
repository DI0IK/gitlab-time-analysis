import { createFileRoute } from '@tanstack/react-router'
import { UserProfileContent } from '@/features/profile/user-profile-content'

export const Route = createFileRoute('/$rootSlug/users/$username')({
  component: ScopedUserProfileRoute,
})

function ScopedUserProfileRoute() {
  const { rootSlug, username } = Route.useParams()
  return (
    <div className="py-2">
      <UserProfileContent username={username} rootSlug={rootSlug} />
    </div>
  )
}
