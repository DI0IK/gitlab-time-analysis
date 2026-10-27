import { createFileRoute, Navigate, Link } from '@tanstack/react-router'
import { useTenant } from '@/features/tenant/tenant-context'
import { Loader2, Building2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: IndexRedirect,
})

function IndexRedirect() {
  const { rootSlug, roots, isLoading } = useTenant()

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        <p className="text-xs text-muted-foreground mt-2">Loading accessible workspaces...</p>
      </div>
    )
  }

  if (roots.length === 0 || !rootSlug) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="h-12 w-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center text-muted-foreground mb-4 shadow-xs">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold font-display tracking-tight text-foreground">
          No Workspaces Configured
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          There are currently no GitLab root groups or tenants configured. Configure your first root group in Admin settings.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link to="/admin" className={buttonVariants()}>
            Open Admin Settings
          </Link>
        </div>
      </div>
    )
  }

  return <Navigate to="/$rootSlug" params={{ rootSlug }} />
}
