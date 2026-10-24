import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  Menu,
  X,
  BarChart3,
  Trophy,
  ListTodo,
  FolderGit2,
  GitPullRequest,
  Layers,
  Presentation,
  Settings,
} from 'lucide-react'
import { ThemeControls } from './theme-controls'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const groupMatch = pathname.match(/\/groups\/([^/]+)/)
  const currentSlug = groupMatch ? groupMatch[1] : 'dhbw-tinf24'

  const closeMenu = () => setOpen(false)

  const links = [
    { to: '/groups/$slug' as const, label: 'Sprint Analytics', icon: BarChart3 },
    { to: '/groups/$slug/leaderboard' as const, label: 'Leaderboard & Gamification', icon: Trophy },
    { to: '/groups/$slug/work-items' as const, label: 'Work Items Explorer', icon: ListTodo },
    { to: '/groups/$slug/repo' as const, label: 'Repository Tree', icon: FolderGit2 },
    { to: '/groups/$slug/merge-requests' as const, label: 'Merge Request Suite', icon: GitPullRequest },
  ]

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/50 text-foreground hover:bg-muted/70 transition"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={() => setOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="relative ml-auto flex h-full w-full max-w-xs flex-col overflow-y-auto border-l border-border/60 bg-card p-6 shadow-2xl z-50">
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
              <span className="font-extrabold tracking-tight font-display text-base">Navigation</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 space-y-1">
              <Link
                to="/"
                onClick={closeMenu}
                className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition"
              >
                <Layers className="h-4 w-4 text-primary" />
                <span>All Groups Overview</span>
              </Link>
            </div>

            <div className="border-t border-border/40 pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Cohort: {currentSlug}
              </p>
              <div className="space-y-1">
                {links.map((link) => {
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      params={{ slug: currentSlug }}
                      onClick={closeMenu}
                      className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{link.label}</span>
                    </Link>
                  )
                })}
                <Link
                  to="/present/$slug"
                  params={{ slug: currentSlug }}
                  onClick={closeMenu}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition"
                >
                  <Presentation className="h-4 w-4 text-primary" />
                  <span>Kiosk / Presentation Mode</span>
                </Link>
              </div>
            </div>

            <div className="mt-auto border-t border-border/40 pt-4 space-y-3">
              <ThemeControls />
              <Link
                to="/settings"
                onClick={closeMenu}
                className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
              >
                <Settings className="h-4 w-4" />
                <span>Settings & Profile</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
