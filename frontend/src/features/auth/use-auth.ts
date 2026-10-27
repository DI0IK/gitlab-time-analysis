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
  isAdmin: boolean
}

export function useAuth() {
  const { data, isLoading } = useQuery({
    queryKey: apiKeys.authMe,
    queryFn: async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) return { authenticated: false, user: null }
        const json = await res.json()
        if (!json.authenticated || !json.user) {
          return { authenticated: false, user: null }
        }
        const u = json.user as any
        const profile: UserProfile = {
          gitlabId: u.gitlab_id || u.gitlabId || '',
          username: u.username || '',
          name: u.name || '',
          customDisplayName: u.custom_display_name ?? u.customDisplayName ?? null,
          avatarUrl: u.avatar_url ?? u.avatarUrl ?? null,
          webUrl: u.web_url || u.webUrl || '',
          isBot: u.is_bot ?? u.isBot ?? false,
          isAdmin: u.is_admin ?? u.isAdmin ?? false,
        }
        return { authenticated: true, user: profile }
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
