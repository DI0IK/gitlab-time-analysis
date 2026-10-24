import { Link } from '@tanstack/react-router'
import { Clock, ShieldCheck } from 'lucide-react'
import { GroupSwitcher } from './group-switcher'
import { MobileNav } from './mobile-nav'
import { ProfileMenu } from '@/features/auth/profile-menu'

export function Nav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Brand & Group Switcher */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold tracking-tight text-foreground transition hover:opacity-90"
            aria-label="GitLab Platform Home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-primary text-white shadow-xs">
              <Clock className="h-4 w-4" />
            </div>
            <span className="hidden text-sm font-extrabold tracking-tight sm:inline-block font-display">
              GitLab <span className="text-primary font-normal">Companion</span>
            </span>
          </Link>

          <span className="text-border/80 text-sm select-none">/</span>

          {/* shadcn-inspired interactive Group/Team Switcher */}
          <GroupSwitcher />
        </div>

        {/* Right: Status, Profile, and Mobile Drawer */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>SQLite WAL</span>
          </div>

          <ProfileMenu />
          <MobileNav />
        </div>
      </div>
    </header>
  )
}
