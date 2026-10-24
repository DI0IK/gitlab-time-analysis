import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Clock } from 'lucide-react'
import { getAvatarUrl } from '@/lib/avatar'
import { UserProfileModal } from '@/features/profile/user-profile-modal'

interface MemberItem {
  username: string
  name: string
  custom_display_name?: string | null
  avatar_url?: string | null
  total_seconds: number
  total_hours: number
  effort_multiplier: number
  timelog_count: number
}

interface GroupMembersTableProps {
  members: MemberItem[]
}

export function GroupMembersTable({ members }: GroupMembersTableProps) {
  const [modalUser, setModalUser] = React.useState<string | null>(null)

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Team Member Effort Multipliers
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono">{members.length} contributors</span>
        </div>
        <CardDescription className="text-xs">
          Individual tracked hours relative to team average (click member for gamification profile).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No active member timelogs recorded for this cohort.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {members.map((m) => {
              const displayName = m.custom_display_name || m.name || m.username
              const multiplier = m.effort_multiplier
              const multiplierVariant =
                multiplier >= 1.2
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : multiplier <= 0.8
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-muted/50 text-foreground border-border/40'

              return (
                <div
                  key={m.username}
                  onClick={() => setModalUser(m.username)}
                  className="flex items-center justify-between py-2.5 px-2 hover:bg-muted/40 rounded-md transition-colors cursor-pointer min-h-[44px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border/50 shrink-0">
                      {getAvatarUrl(m.avatar_url) ? (
                        <img
                          src={getAvatarUrl(m.avatar_url)}
                          alt={displayName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground font-mono">
                          {displayName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                        <span>{displayName}</span>
                        {m.custom_display_name && (
                          <span className="text-[10px] text-muted-foreground font-normal">
                            (@{m.username})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        <span>{m.timelog_count} logs recorded</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-foreground">
                        {m.total_hours}h
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-mono px-2 py-0.5 ${multiplierVariant}`}
                      title={`Effort ratio vs team average`}
                    >
                      {multiplier.toFixed(2)}x
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <UserProfileModal username={modalUser} onClose={() => setModalUser(null)} />
    </Card>
  )
}
