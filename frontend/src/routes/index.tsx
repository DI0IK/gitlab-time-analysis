import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useTenant } from '@/features/tenant/tenant-context'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: IndexRedirect,
})

function IndexRedirect() {
  const { rootSlug, isLoading } = useTenant()

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        <p className="text-xs text-muted-foreground mt-2">Loading accessible workspaces...</p>
      </div>
    )
  }

  return <Navigate to="/$rootSlug" params={{ rootSlug }} />
}
