import type { components } from '@/lib/api/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Target, Rocket, Users, Trophy, Flame, TrendingUp } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

type UserProfileDetailsResponse = components['schemas']['UserProfileDetailsResponse']

interface OverviewTabProps {
  details: UserProfileDetailsResponse
}

export function OverviewTab({ details }: OverviewTabProps) {
  const { metrics, gamification, leaderboard_rank, sprint_hours } = details

  const chartData = sprint_hours.map((s) => ({
    name: `Sprint ${s.sprint_number}`,
    hours: s.hours,
  }))

  return (
    <div className="space-y-6">
      {/* Top Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/60 bg-card/60 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total Effort</span>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">
              {metrics.total_hours}
              <span className="text-xs font-normal text-muted-foreground ml-1">hrs</span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {metrics.current_sprint_hours > 0 ? (
                <span className="text-emerald-500 font-medium">+{metrics.current_sprint_hours}h in sprint</span>
              ) : (
                <span>Across {metrics.active_sprints_count} sprints</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Estimation</span>
              <Target className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">
              {metrics.estimation_accuracy_pct != null ? (
                `${metrics.estimation_accuracy_pct.toFixed(0)}%`
              ) : (
                <span className="text-base text-muted-foreground font-normal">N/A</span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {metrics.closed_work_items_count} closed work items
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Shipping</span>
              <Rocket className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">
              {metrics.merged_mrs_count}
              <span className="text-xs font-normal text-muted-foreground ml-1">MRs</span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {metrics.sharp_shooter_count > 0 ? (
                <span className="text-primary font-medium">{metrics.sharp_shooter_count} sharp-shooter</span>
              ) : (
                <span>Production releases</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Team Standing</span>
              <Trophy className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground flex items-center gap-1.5">
              {leaderboard_rank != null ? (
                <>
                  <span className="text-primary">#{leaderboard_rank}</span>
                  <span className="text-xs font-normal text-muted-foreground">Rank</span>
                </>
              ) : (
                <span className="text-base text-muted-foreground font-normal">Active</span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{metrics.reviews_count} peer reviews</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Level & XP Progression Card */}
      <div className="rounded-xl border border-border/70 bg-gradient-to-br from-card via-card/90 to-muted/20 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-xs">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-foreground">
                  Level {gamification.level_progress.level}
                </span>
                <Badge
                  variant="outline"
                  className="text-[11px] font-mono uppercase bg-primary/10 text-primary border-primary/20"
                >
                  {gamification.level_progress.tier_name}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {gamification.level_progress.tier_name} Contributor Status
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            {gamification.streak_days > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-semibold">
                <Flame className="h-3.5 w-3.5 fill-amber-500" />
                {gamification.streak_days} sprint{gamification.streak_days > 1 ? 's' : ''} streak
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              {details.badges.filter((b) => b.is_unlocked).length} / {details.badges.length} Badges
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-muted-foreground">
              XP Progress: <span className="text-foreground font-semibold">{gamification.level_progress.progress_pct.toFixed(0)}%</span>
            </span>
            <span className="text-muted-foreground font-semibold">
              <span className="text-foreground">{gamification.level_progress.current_xp}</span> / {gamification.level_progress.next_level_xp} XP
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden p-0.5 border border-border/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-indigo-500 to-amber-500 transition-all duration-500"
              style={{ width: `${Math.min(gamification.level_progress.progress_pct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-muted-foreground/80">
            <span>Base Activity XP: {(metrics.total_hours * 10).toFixed(0)}</span>
            <span>Achievement Rewards XP: {details.badges.filter((b) => b.is_unlocked).reduce((acc, b) => acc + b.reward_xp, 0)}</span>
          </div>
        </div>
      </div>

      {/* Sprint Cadence Chart */}
      <div className="rounded-xl border border-border/60 bg-card/60 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Sprint Cadence History
            </h3>
            <p className="text-xs text-muted-foreground">
              Effort distribution across sprints
            </p>
          </div>
          {sprint_hours.length > 0 && (
            <Badge variant="outline" className="font-mono text-[11px]">
              {sprint_hours.length} Sprints Tracked
            </Badge>
          )}
        </div>

        {chartData.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
            No sprint hours logged yet.
          </div>
        ) : (
          <div className="h-48 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="#888888"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="#888888"
                  unit="h"
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="rounded-lg border border-border bg-popover p-2.5 shadow-xl text-xs space-y-1">
                          <p className="font-semibold text-foreground">{data.name}</p>
                          <p className="text-muted-foreground font-mono">
                            Effort: <span className="text-primary font-bold">{data.hours}h</span>
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="hours" fill="var(--color-primary, #6366f1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
