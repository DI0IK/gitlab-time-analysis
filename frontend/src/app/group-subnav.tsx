import { Link, useRouterState } from '@tanstack/react-router'
import {
  BarChart3,
  Trophy,
  Activity,
  ListTodo,
  FolderGit2,
  GitPullRequest,
  BookOpen,
  Presentation,
} from 'lucide-react'
import { useTenant } from '@/features/tenant/tenant-context'

export function GroupSubnav() {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const { rootSlug, groupSlug, activeRoot } = useTenant()

  // Don't show subnav on global admin/settings/auth pages or user profile pages
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/auth') ||
    pathname.includes('/users/')
  ) {
    return null
  }

  const rootGroupSlug = activeRoot?.gitlab_group_path
    ? activeRoot.gitlab_group_path.replace(/\//g, '-')
    : rootSlug

  const isRootLevel = !groupSlug || groupSlug === rootSlug || groupSlug === rootGroupSlug
  const effectiveGroupSlug = isRootLevel ? rootGroupSlug : groupSlug

  const analyticsPath = isRootLevel ? `/${rootSlug}` : `/${rootSlug}/${groupSlug}`
  const basePath = `/${rootSlug}/${effectiveGroupSlug}`

  const tabs = [
    {
      href: analyticsPath,
      label: 'Analytics',
      icon: BarChart3,
      active:
        pathname === analyticsPath ||
        pathname === `${analyticsPath}/` ||
        (isRootLevel && (pathname === basePath || pathname === `${basePath}/`)),
    },
    {
      href: `${basePath}/activity`,
      label: 'Activity',
      icon: Activity,
      active: pathname.startsWith(`${basePath}/activity`),
    },
    {
      href: `${basePath}/leaderboard`,
      label: isRootLevel ? 'Global Leaderboard' : 'Leaderboard',
      icon: Trophy,
      active: pathname.startsWith(`${basePath}/leaderboard`),
    },
    {
      href: `${basePath}/work-items`,
      label: 'Work Items',
      icon: ListTodo,
      active: pathname.startsWith(`${basePath}/work-items`),
    },
    {
      href: `${basePath}/repo`,
      label: 'Code Browser',
      icon: FolderGit2,
      active: pathname.startsWith(`${basePath}/repo`),
    },
    {
      href: `${basePath}/wiki`,
      label: 'Wiki',
      icon: BookOpen,
      active: pathname.startsWith(`${basePath}/wiki`),
    },
    {
      href: `${basePath}/merge-requests`,
      label: 'MR Suite',
      icon: GitPullRequest,
      active: pathname.startsWith(`${basePath}/merge-requests`),
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
                key={tab.href}
                to={tab.href as any}
                onClick={() => {
                  if (tab.href.endsWith('/repo')) {
                    window.dispatchEvent(new CustomEvent('reset-repo-browser'))
                  }
                }}
                className={`flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
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
            to={`${basePath}/present` as any}
            className="flex min-h-[34px] items-center gap-1.5 rounded-md border border-border/60 bg-secondary/30 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary transition"
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
