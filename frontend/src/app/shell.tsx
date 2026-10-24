import * as React from 'react'
import { useRouterState } from '@tanstack/react-router'
import { Nav } from './nav'
import { GroupSubnav } from './group-subnav'

export function Shell({ children }: { children: React.ReactNode }) {
  const routerState = useRouterState()
  const isKiosk = routerState.location.pathname.startsWith('/present')

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
