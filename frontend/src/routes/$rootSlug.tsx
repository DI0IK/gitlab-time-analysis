import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/$rootSlug')({
  component: () => <Outlet />,
})
