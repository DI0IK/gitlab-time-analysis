import { LogIn, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from './use-auth'

export function LoginGate() {
  const { login } = useAuth()

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background px-4 py-12 select-none">
      <div className="w-full max-w-sm space-y-8 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Logo */}
        <div className="inline-flex relative">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-primary opacity-40 blur-lg" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-primary text-white shadow-xl">
            <Clock className="h-8 w-8" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight font-display text-foreground">
            GitLab <span className="text-primary font-normal">Companion</span>
          </h1>
        </div>

        {/* Login Button */}
        <div>
          <Button
            size="lg"
            onClick={login}
            className="w-full h-11 text-sm font-semibold gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <LogIn className="h-4 w-4" />
            <span>Sign in with GitLab</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
