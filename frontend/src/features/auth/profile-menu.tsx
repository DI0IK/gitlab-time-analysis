import { useState, useRef, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { User as UserIcon, Settings, LogOut, LogIn } from 'lucide-react'
import { useAuth } from './use-auth'
import { resolveDisplayName } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { ThemeControls } from '@/app/theme-controls'

export function ProfileMenu() {
  const { user, isAuthenticated, login, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName = user ? resolveDisplayName(user) : 'Guest'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 p-1.5 pr-3 text-sm font-medium transition hover:bg-secondary/80 focus:outline-none"
        aria-label="User profile and preferences"
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={displayName} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary">
            <UserIcon className="h-4 w-4" />
          </div>
        )}
        <span className="hidden max-w-[120px] truncate text-xs sm:inline-block font-medium">
          {displayName}
        </span>
      </button>

      {open && (
        <div className="glass-dropdown absolute right-0 mt-2 w-64 rounded-xl p-3 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="border-b border-border/40 pb-2 mb-3">
            <p className="font-semibold text-sm truncate">{displayName}</p>
            {user && <p className="text-xs text-muted-foreground truncate">@{user.username}</p>}
          </div>

          <ThemeControls />

          {/* Settings & Auth Actions */}
          <div className="border-t border-border/40 pt-2 mt-3 space-y-1">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-accent/50 transition"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings & Profile</span>
            </Link>

            {isAuthenticated ? (
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={login}
                className="w-full text-xs h-7 mt-1 gap-1.5"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>GitLab Login</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
