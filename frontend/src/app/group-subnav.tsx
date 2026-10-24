import { Link, useRouterState } from '@tanstack/react-router'
import {
  BarChart3,
  Trophy,
  ListTodo,
  FolderGit2,
  GitPullRequest,
  Presentation,
} from 'lucide-react'

export function GroupSubnav() {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const groupMatch = pathname.match(/\/groups\/([^/]+)/)
  if (!groupMatch) return null
  const currentSlug = groupMatch[1]

  const tabs = [
    {
      to: '/groups/$slug' as const,
      label: 'Analytics',
      icon: BarChart3,
      exact: true,
      active: pathname === `/groups/${currentSlug}`,
    },
    {
      to: '/groups/$slug/leaderboard' as const,
      label: 'Leaderboard',
      icon: Trophy,
      active: pathname.includes('/leaderboard'),
    },
    {
      to: '/groups/$slug/work-items' as const,
      label: 'Work Items',
      icon: ListTodo,
      active: pathname.includes('/work-items'),
    },
    {
      to: '/groups/$slug/repo' as const,
      label: 'Code Browser',
      icon: FolderGit2,
      active: pathname.includes('/repo'),
    },
    {
      to: '/groups/$slug/merge-requests' as const,
      label: 'MR Suite',
      icon: GitPullRequest,
      active: pathname.includes('/merge-requests'),
    },
  ]

  return (
    <div className="border-b border-border/40 bg-background/60 backdrop-blur-sm sticky top-14 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
        <nav
          className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2"
          aria-label="Group sub-navigation"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <Link
                key={tab.to}
                to={tab.to}
                params={{ slug: currentSlug }}
                className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${
                  tab.active
                    ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="hidden sm:flex items-center pl-4 shrink-0">
          <Link
            to="/present/$slug"
            params={{ slug: currentSlug }}
            className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-border/60 bg-secondary/30 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary transition"
            title="Launch Fullscreen Presentation Mode"
          >
            <Presentation className="h-3.5 w-3.5 text-primary" />
            <span>Kiosk</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
