import * as React from 'react'
import type { components } from '@/lib/api/schema'
import { Badge } from '@/components/ui/badge'
import { Award, CheckCircle2, Lock, Filter } from 'lucide-react'

type BadgeProgressItem = components['schemas']['BadgeProgressItem']

interface BadgesTabProps {
  badges: BadgeProgressItem[]
}

const ICONS: Record<string, string> = {
  sprout: '🌱',
  hammer: '🔨',
  briefcase: '💼',
  mountain: '⛰️',
  trophy: '🏆',
  crown: '👑',
  zap: '⚡',
  flame: '🔥',
  star: '⭐',
  award: '🎖️',
  shield: '🛡️',
  clock: '⏱️',
  rocket: '🚀',
  users: '👥',
  sparkles: '✨',
  target: '🎯',
  terminal: '💻',
  flag: '🚩',
  crosshair: '🎯',
  cpu: '🖥️',
  compass: '🧭',
  layers: '📚',
  footprints: '👣',
  dumbbell: '💪',
  biceps: '💪',
  bot: '🤖',
  eye: '👁️',
  wind: '💨',
  calendar: '📅',
  'heart-handshake': '🤝',
  lock: '🔒',
  'check-circle': '✅',
  'package-check': '📦',
  'shield-check': '🛡️',
  'calendar-check': '📅',
  'trending-up': '📈',
  'git-merge': '🔀',
  'git-pull-request': '🔀',
}

type StatusFilter = 'all' | 'unlocked' | 'locked'

export function BadgesTab({ badges }: BadgesTabProps) {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [selectedTrack, setSelectedTrack] = React.useState<string>('All')

  const tracks = React.useMemo(() => {
    const set = new Set<string>()
    for (const b of badges) {
      if (b.track) set.add(b.track)
    }
    return ['All', ...Array.from(set)]
  }, [badges])

  const filteredBadges = React.useMemo(() => {
    return badges.filter((b) => {
      if (statusFilter === 'unlocked' && !b.is_unlocked) return false
      if (statusFilter === 'locked' && b.is_unlocked) return false
      if (selectedTrack !== 'All' && b.track !== selectedTrack) return false
      return true
    })
  }, [badges, statusFilter, selectedTrack])

  const unlockedCount = badges.filter((b) => b.is_unlocked).length
  const lockedCount = badges.length - unlockedCount

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-2.5 border-b border-border/50 pb-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Status Segmented Buttons */}
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Badges ({badges.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unlocked')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                statusFilter === 'unlocked'
                  ? 'bg-card text-emerald-400 shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Unlocked ({unlockedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('locked')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                statusFilter === 'locked'
                  ? 'bg-card text-amber-400 shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              In Progress ({lockedCount})
            </button>
          </div>

          <div className="text-xs font-mono text-muted-foreground">
            {unlockedCount} of {badges.length} unlocked (
            {badges.length > 0 ? ((unlockedCount / badges.length) * 100).toFixed(0) : 0}%)
          </div>
        </div>

        {/* Tracks Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 pr-1">
            <Filter className="h-3 w-3" /> Track:
          </span>
          {tracks.map((track) => (
            <button
              key={track}
              type="button"
              onClick={() => setSelectedTrack(track)}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-full border transition-all shrink-0 cursor-pointer ${
                selectedTrack === track
                  ? 'bg-primary/15 text-primary border-primary/30 font-semibold'
                  : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60'
              }`}
            >
              {track}
            </button>
          ))}
        </div>
      </div>

      {/* Badges Grid */}
      {filteredBadges.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border/60 text-muted-foreground text-sm space-y-2">
          <Award className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p>No achievements match the current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredBadges.map((b) => {
            const isUnlocked = b.is_unlocked
            const icon = ICONS[b.icon.toLowerCase()] || '🏆'
            const deltaRemaining = b.threshold > b.current_value ? b.threshold - b.current_value : 0

            return (
              <div
                key={b.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  isUnlocked
                    ? 'border-primary/30 bg-card/80 hover:border-primary/60 shadow-xs'
                    : 'border-border/50 bg-muted/15 hover:border-border/80'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0 border shadow-xs ${
                      isUnlocked
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-muted/40 border-border/60 grayscale contrast-75 opacity-70'
                    }`}
                  >
                    {icon}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4
                        className={`text-sm font-semibold truncate ${
                          isUnlocked ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {b.title}
                      </h4>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono shrink-0 ${
                          isUnlocked
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        +{b.reward_xp} XP
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {b.description}
                    </p>

                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40">
                        {b.track}
                      </span>

                      {isUnlocked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Unlocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-500/90 font-medium">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar (Always shown for both locked and unlocked) */}
                <div className="space-y-1.5 border-t border-border/40 pt-2.5">
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="text-muted-foreground">
                      {isUnlocked ? (
                        <span className="text-emerald-400 font-semibold">Completed</span>
                      ) : (
                        <span>
                          {deltaRemaining > 0 ? `${deltaRemaining} more needed` : 'In progress'}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      <span className={isUnlocked ? 'text-emerald-400 font-semibold' : 'text-foreground font-semibold'}>
                        {b.current_value}
                      </span>{' '}
                      / {b.threshold} ({b.progress_pct.toFixed(0)}%)
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isUnlocked
                          ? 'bg-emerald-500'
                          : 'bg-gradient-to-r from-primary to-amber-500'
                      }`}
                      style={{ width: `${Math.min(b.progress_pct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
