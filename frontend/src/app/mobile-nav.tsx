import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Menu,
  X,
  BarChart3,
  Trophy,
  ListTodo,
  FolderGit2,
  GitPullRequest,
  BookOpen,
  Presentation,
  Settings,
  Shield,
} from 'lucide-react'
import { ThemeControls } from './theme-controls'
import { useTenant } from '@/features/tenant/tenant-context'
import { useAuth } from '@/features/auth/use-auth'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const { rootSlug, groupSlug, activeRoot } = useTenant()
  const { user } = useAuth()

  const closeMenu = () => setOpen(false)

  const rootGroupSlug = activeRoot?.gitlab_group_path
    ? activeRoot.gitlab_group_path.replace(/\//g, '-')
    : rootSlug

  const isRootLevel = !groupSlug || groupSlug === rootSlug || groupSlug === rootGroupSlug
  const effectiveGroupSlug = isRootLevel ? rootGroupSlug : groupSlug

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
              {!rootSlug ? (
                <div className="px-3 py-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">No workspaces configured</p>
                  <Link
                    to="/admin"
                    onClick={closeMenu}
                    className="inline-block text-xs text-primary hover:underline font-semibold"
                  >
                    Go to Admin Settings &rarr;
                  </Link>
                </div>
              ) : (
                <>
                  <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {isRootLevel ? `Root: ${activeRoot?.name ?? rootSlug}` : `Team: ${groupSlug}`}
                  </p>
                  <Link
                    to={(isRootLevel ? `/${rootSlug}` : `/${rootSlug}/${effectiveGroupSlug}`) as any}
                    onClick={closeMenu}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition"
                  >
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <span>Analytics</span>
                  </Link>
                  <Link
                    to={`/${rootSlug}/${effectiveGroupSlug}/activity` as any}
                    onClick={closeMenu}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition"
                  >
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span>Activity</span>
                  </Link>
                  <Link
                    to={`/${rootSlug}/${effectiveGroupSlug}/leaderboard` as any}
                    onClick={closeMenu}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition"
                  >
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <span>{isRootLevel ? 'Global Leaderboard' : 'Leaderboard'}</span>
                  </Link>
                  <Link
                    to={`/${rootSlug}/${effectiveGroupSlug}/work-items` as any}
                    onClick={closeMenu}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition"
                  >
                    <ListTodo className="h-4 w-4 text-muted-foreground" />
                    <span>Work Items</span>
                  </Link>
                  <Link
                    to={`/${rootSlug}/${effectiveGroupSlug}/repo` as any}
                    onClick={closeMenu}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition"
                  >
                    <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                    <span>Code Browser</span>
                  </Link>
                  <Link
                    to={`/${rootSlug}/${effectiveGroupSlug}/wiki` as any}
                    onClick={closeMenu}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition"
                  >
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span>Wiki</span>
                  </Link>
                  <Link
                    to={`/${rootSlug}/${effectiveGroupSlug}/merge-requests` as any}
                    onClick={closeMenu}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition"
                  >
                    <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                    <span>MR Suite</span>
                  </Link>
                  <Link
                    to={`/${rootSlug}/${effectiveGroupSlug}/present` as any}
                    onClick={closeMenu}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition"
                  >
                    <Presentation className="h-4 w-4 text-primary" />
                    <span>Kiosk / Presentation</span>
                  </Link>
                </>
              )}
            </div>

            <div className="mt-auto border-t border-border/40 pt-4 space-y-3">
              <ThemeControls />
              {user?.isAdmin && (
                <Link
                  to="/admin"
                  onClick={closeMenu}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-amber-500 hover:bg-amber-500/10 transition"
                >
                  <Shield className="h-4 w-4" />
                  <span>Platform Administration</span>
                </Link>
              )}
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
