import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/$rootSlug/$groupSlug')({
  component: () => <Outlet />,
})
