import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Shell } from '@/app/shell'
import { TenantProvider } from '@/features/tenant/tenant-context'

export const Route = createRootRoute({
  component: () => (
    <TenantProvider>
      <Shell>
        <Outlet />
      </Shell>
    </TenantProvider>
  ),
})
