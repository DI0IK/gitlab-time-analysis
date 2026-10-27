import * as React from 'react'
import { useRouterState } from '@tanstack/react-router'
import { Nav } from './nav'
import { GroupSubnav } from './group-subnav'
import { useAuth } from '@/features/auth/use-auth'
import { LoginGate } from '@/features/auth/login-gate'
import { Loader2 } from 'lucide-react'

export function Shell({ children }: { children: React.ReactNode }) {
  const routerState = useRouterState()
  const { isAuthenticated, isLoading } = useAuth()
  const isKiosk = routerState.location.pathname.startsWith('/present')

  // Show a smooth splash screen while initial session status is loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-80" />
        <p className="text-xs text-muted-foreground mt-3 font-mono animate-pulse">
          Authenticating session...
        </p>
      </div>
    )
  }

  // If user is not authenticated, require GitLab login for everything
  if (!isAuthenticated) {
    return <LoginGate />
  }

  if (isKiosk) {
    return (
      <div className="min-h-screen bg-background text-foreground antialiased overflow-x-hidden">
        <main>{children}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased overflow-x-hidden">
      <Nav />
      <GroupSubnav />
      <main className="flex-1 pb-16">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</div>
      </main>
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>GitLab Unified Platform v2.0 • Clean Room Edition</p>
          <p className="font-mono text-[11px] opacity-75">Engineered with Rust, SQLite & React 19</p>
        </div>
      </footer>
    </div>
  )
}
