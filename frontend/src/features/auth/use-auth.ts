import { useQuery } from '@tanstack/react-query'
import { apiKeys } from '@/lib/api/keys'

export interface UserProfile {
  gitlabId: string
  username: string
  name: string
  customDisplayName?: string | null
  avatarUrl?: string | null
  webUrl: string
  isBot: boolean
}

export function useAuth() {
  const { data, isLoading } = useQuery({
    queryKey: apiKeys.authMe,
    queryFn: async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) return { authenticated: false, user: null }
        return (await res.json()) as { authenticated: boolean; user: UserProfile | null }
      } catch {
        return { authenticated: false, user: null }
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  const login = () => {
    window.location.href = '/api/auth/login'
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.reload()
  }

  return {
    user: data?.user ?? null,
    isAuthenticated: data?.authenticated ?? false,
    isLoading,
    login,
    logout,
  }
}
