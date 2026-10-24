import { createFileRoute } from '@tanstack/react-router'
import { KioskPresentationView } from '@/features/analytics/kiosk'

export const Route = createFileRoute('/present/$slug')({
  component: function RouteComponent() {
    const { slug } = Route.useParams()
    return <KioskPresentationView slug={slug} />
  },
})
