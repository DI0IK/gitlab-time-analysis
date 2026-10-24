import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, Clock, Flame, Award, Copy, Check } from 'lucide-react'
import { getAvatarUrl } from '@/lib/avatar'

const ICONS: Record<string, string> = {
  sprout: '🌱', hammer: '🔨', briefcase: '💼', mountain: '⛰️', trophy: '🏆', crown: '👑',
  zap: '⚡', flame: '🔥', star: '⭐', award: '🎖️', shield: '🛡️', clock: '⏱️', rocket: '🚀',
  users: '👥', sparkles: '✨', target: '🎯', terminal: '💻', flag: '🚩', crosshair: '🎯',
  cpu: '🖥️', compass: '🧭', layers: '📚', footprints: '👣', dumbbell: '💪', biceps: '💪',
  bot: '🤖', eye: '👁️', wind: '💨', calendar: '📅',
}

export function UserProfileModal({ username, onClose }: { username: string | null; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-gamification', username],
    queryFn: async () => {
      if (!username) return null
      const { data, error } = await apiClient.GET('/api/users/{username}/gamification', { params: { path: { username } } })
      if (error || !data) throw new Error('Failed to load user profile')
      return data
    },
    enabled: Boolean(username),
  })

  const handleCopyBadge = () => {
    if (!username) return
    navigator.clipboard.writeText(`[![${username}'s Trophy](${window.location.origin}/api/render/user/${username})](${window.location.origin})`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!username) return null
  const displayName = data?.custom_display_name || data?.name || username
  const avatarSrc = getAvatarUrl(data?.avatar_url)

  return (
    <Modal
      isOpen={Boolean(username)}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border shadow-md shrink-0">
            {avatarSrc ? <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" /> : <span className="text-sm font-bold font-mono text-muted-foreground">{displayName.slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{displayName}</h2>
            <div className="text-xs text-muted-foreground font-mono">@{username}</div>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-4 animate-pulse"><div className="h-20 bg-muted/40 rounded-xl" /><div className="h-32 bg-muted/30 rounded-xl" /></div>
      ) : error || !data ? (
        <div className="p-8 text-center rounded-lg border border-border text-muted-foreground text-sm">Could not load profile information for @{username}.</div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <span className="font-bold text-sm text-foreground">Level {data.level_progress.level}</span>
                <Badge variant="outline" className="text-[11px] font-mono uppercase bg-primary/10 text-primary border-primary/20">{data.level_progress.tier_name}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5 text-primary" />{data.total_hours}h logged</span>
                {data.streak_days > 0 && <span className="inline-flex items-center gap-1 text-amber-500 font-semibold"><Flame className="h-3.5 w-3.5" />{data.streak_days}d streak</span>}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-muted-foreground"><span>XP Progress ({data.level_progress.progress_pct.toFixed(0)}%)</span><span>{data.level_progress.current_xp} / {data.level_progress.next_level_xp} XP</span></div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden"><div className="h-full bg-linear-to-r from-primary to-amber-500 transition-all" style={{ width: `${Math.min(data.level_progress.progress_pct, 100)}%` }} /></div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
              <Award className="h-4 w-4 text-primary" />Badges Unlocked ({data.unlocked_badges.length})
            </div>
            {data.unlocked_badges.length === 0 ? (
              <div className="p-4 text-center rounded-lg border border-dashed border-border/60 text-muted-foreground text-xs">No badges earned yet. Log timelogs to earn achievements!</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {data.unlocked_badges.map((b) => (
                  <div key={b.id} className="p-2.5 rounded-lg border border-border/60 bg-card/60 flex items-start gap-2.5 hover:border-primary/40 transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-lg shrink-0 shadow-xs">
                      {ICONS[b.icon.toLowerCase()] || '🏆'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">{b.title}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{b.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Add live SVG badge to your README or portfolio</span>
            <Button variant="outline" size="sm" onClick={handleCopyBadge} className="w-full sm:w-auto gap-1.5 min-h-[44px] sm:min-h-[36px]">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied Markdown' : 'Copy Embed Snippet'}</span>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
