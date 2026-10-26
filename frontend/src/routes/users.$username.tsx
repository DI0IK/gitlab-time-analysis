import { createFileRoute } from '@tanstack/react-router'
import { UserProfilePage } from '@/features/profile/user-profile-page'

export const Route = createFileRoute('/users/$username')({
  component: UserProfilePage,
})
