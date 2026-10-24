import { Trophy, Award } from 'lucide-react'
import { getAvatarUrl } from '@/lib/avatar'

export interface LeaderboardItem {
  rank: number
  username: string
  name: string
  custom_display_name?: string | null
  avatar_url?: string | null
  level: number
  tier_name: string
  tier_color: string
  current_xp: number
  progress_pct: number
  total_hours: number
  badges_count: number
  badge_icons: string[]
}

export function LeaderboardPodium({
  topThree,
  onSelectUser,
}: {
  topThree: LeaderboardItem[]
  onSelectUser?: (username: string) => void
}) {
  if (topThree.length === 0) return null

  const medals = [
    { rank: 1, label: '1st', bg: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/40', text: 'text-amber-500' },
    { rank: 2, label: '2nd', bg: 'from-slate-400/20 to-slate-400/5', border: 'border-slate-400/40', text: 'text-slate-400' },
    { rank: 3, label: '3rd', bg: 'from-amber-700/20 to-amber-700/5', border: 'border-amber-700/40', text: 'text-amber-700' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {topThree.map((item, idx) => {
        const medal = medals[idx] || medals[0]
        const displayName = item.custom_display_name || item.name || item.username

        return (
          <div
            key={item.username}
            onClick={() => onSelectUser?.(item.username)}
            className={`relative rounded-xl border ${medal.border} bg-linear-to-b ${medal.bg} p-4 backdrop-blur-xs flex flex-col items-center text-center cursor-pointer hover:scale-[1.01] transition-transform`}
          >
            <div className={`absolute top-3 right-3 text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${medal.border} ${medal.text}`}>
              {medal.label}
            </div>

            <div className="relative mb-3 mt-1">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border shadow-md">
                {getAvatarUrl(item.avatar_url) ? (
                  <img src={getAvatarUrl(item.avatar_url)} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-base font-bold font-mono text-muted-foreground">
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-background border border-border shadow-xs">
                <Trophy className={`h-4 w-4 ${medal.text}`} />
              </div>
            </div>

            <div className="text-sm font-bold text-foreground truncate max-w-[180px]">
              {displayName}
            </div>
            <div className="text-xs text-muted-foreground font-mono">@{item.username}</div>

            <div className="mt-3 flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono"
                style={{ backgroundColor: `${item.tier_color}25`, color: item.tier_color }}
              >
                Lvl {item.level} {item.tier_name}
              </span>
              <span className="text-xs font-mono font-bold text-foreground">
                {item.total_hours}h
              </span>
            </div>

            <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
              <Award className="h-3.5 w-3.5 text-primary" />
              <span>{item.badges_count} Badges • {item.current_xp} XP</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
