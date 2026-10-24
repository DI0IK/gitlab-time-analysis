import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/groups/$slug')({
  component: function RouteComponent() {
    return <Outlet />
  },
})
