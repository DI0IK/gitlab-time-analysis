import { createFileRoute } from '@tanstack/react-router'
import { KioskPresentationView } from '@/features/analytics/kiosk'

export const Route = createFileRoute('/$rootSlug/$groupSlug/present')({
  component: GroupPresentRoute,
})

function GroupPresentRoute() {
  const { rootSlug, groupSlug } = Route.useParams()
  return <KioskPresentationView rootSlug={rootSlug} groupSlug={groupSlug} />
}
