import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { LeaderboardPodium, type LeaderboardItem } from './leaderboard-podium'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trophy, RefreshCw, Award } from 'lucide-react'
import { getAvatarUrl } from '@/lib/avatar'
import { UserProfileModal } from '@/features/profile/user-profile-modal'

import { useTenant } from '@/features/tenant/tenant-context'
import { apiKeys } from '@/lib/api/keys'

export function LeaderboardView({
  slug,
  rootSlug: propRootSlug,
  groupSlug: propGroupSlug,
}: {
  slug?: string
  rootSlug?: string
  groupSlug?: string
}) {
  const tenant = useTenant()
  const effectiveRootSlug = propRootSlug || tenant.rootSlug
  const effectiveGroupSlug = propGroupSlug || slug || tenant.groupSlug || ''

  const [modalUser, setModalUser] = React.useState<string | null>(null)

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: apiKeys.rootLeaderboard(effectiveRootSlug, effectiveGroupSlug),
    queryFn: async () => {
      if (effectiveGroupSlug) {
        const { data, error } = await apiClient.GET(
          '/api/{root_slug}/groups/{group_slug}/leaderboard',
          {
            params: {
              path: {
                root_slug: effectiveRootSlug,
                group_slug: effectiveGroupSlug,
              },
            },
          }
        )
        if (error || !data) throw new Error('Failed to load group leaderboard')
        return data as LeaderboardItem[]
      } else {
        const { data, error } = await apiClient.GET('/api/{root_slug}/leaderboard', {
          params: { path: { root_slug: effectiveRootSlug } },
        })
        if (error || !data) throw new Error('Failed to load cohort leaderboard')
        return data as LeaderboardItem[]
      }
    },
    enabled: Boolean(effectiveRootSlug),
  })

  const items = data || []
  const topThree = items.slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight font-display">Contributor Leaderboard</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Rankings based on non-inflationary XP progression, logged effort, and badge unlocks.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="self-start sm:self-auto min-h-[44px] sm:min-h-[36px] gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
      ) : error ? (
        <div className="p-8 text-center rounded-lg border border-border bg-card/60 text-muted-foreground">
          Failed to load leaderboard. Please check your connection.
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center rounded-lg border border-dashed border-border/60 text-muted-foreground text-sm">
          No leaderboard entries found for this group yet.
        </div>
      ) : (
        <>
          <LeaderboardPodium topThree={topThree} onSelectUser={setModalUser} />

          <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Contributor Rankings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                {items.map((m) => {
                  const displayName = m.custom_display_name || m.name || m.username
                  return (
                    <div
                      key={m.username}
                      onClick={() => setModalUser(m.username)}
                      className="flex items-center justify-between p-3 sm:px-4 hover:bg-muted/40 transition-colors cursor-pointer min-h-[52px]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 text-center font-mono font-bold text-sm text-muted-foreground">
                          #{m.rank}
                        </span>
                        <div className="h-8 w-8 rounded-full bg-muted overflow-hidden border border-border shrink-0 flex items-center justify-center font-mono text-xs">
                          {getAvatarUrl(m.avatar_url) ? (
                            <img src={getAvatarUrl(m.avatar_url)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            displayName.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{displayName}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            @{m.username} • {m.total_hours}h
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex flex-col items-end">
                          <span className="text-xs font-mono font-bold text-foreground">{m.current_xp} XP</span>
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-primary" style={{ width: `${m.progress_pct}%` }} />
                          </div>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold"
                          style={{ backgroundColor: `${m.tier_color}25`, color: m.tier_color }}
                        >
                          Lvl {m.level}
                        </span>
                        <a
                          href={`/api/render/badge/endurance_${Math.min(m.level, 7)}.svg`}
                          target="_blank"
                          rel="noreferrer"
                          title="View dynamic badge SVG"
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          <Award className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <UserProfileModal username={modalUser} onClose={() => setModalUser(null)} />
        </>
      )}
    </div>
  )
}
