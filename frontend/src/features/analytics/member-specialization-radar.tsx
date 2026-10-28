import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Compass } from 'lucide-react'
import { getAvatarUrl } from '@/lib/avatar'
import type { components } from '@/lib/api/schema'

type MemberRoleSpecialization = components['schemas']['MemberRoleSpecialization']

interface MemberSpecializationRadarProps {
  specializations?: MemberRoleSpecialization[]
}

export function MemberSpecializationRadar({
  specializations = [],
}: MemberSpecializationRadarProps) {
  if (specializations.length === 0) {
    return null
  }

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">Member Role Specialization</CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Task taxonomy profiles and dominant focus areas across team members.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {specializations.map((m) => {
            const avatarSrc = getAvatarUrl(m.avatar_url)
            return (
              <div
                key={m.username}
                className="p-3 rounded-md border border-border/40 bg-muted/20 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border/50 shrink-0">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={m.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-semibold text-muted-foreground font-mono">
                          {m.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-foreground truncate block">{m.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono block">@{m.username}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                      {m.primary_role}
                    </Badge>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {m.total_hours}h total
                    </div>
                  </div>
                </div>

                {/* Role Allocation Bar */}
                <div className="space-y-1 pt-1">
                  <div className="w-full bg-muted/50 h-2 rounded-xs overflow-hidden flex">
                    {m.impl_percentage > 0 && (
                      <div
                        style={{ width: `${m.impl_percentage}%`, backgroundColor: '#34d399' }}
                        title={`Impl: ${m.impl_percentage}%`}
                      />
                    )}
                    {m.re_percentage > 0 && (
                      <div
                        style={{ width: `${m.re_percentage}%`, backgroundColor: '#60a5fa' }}
                        title={`RE: ${m.re_percentage}%`}
                      />
                    )}
                    {m.arch_percentage > 0 && (
                      <div
                        style={{ width: `${m.arch_percentage}%`, backgroundColor: '#fbbf24' }}
                        title={`Arch: ${m.arch_percentage}%`}
                      />
                    )}
                    {m.pm_percentage > 0 && (
                      <div
                        style={{ width: `${m.pm_percentage}%`, backgroundColor: '#c084fc' }}
                        title={`PM: ${m.pm_percentage}%`}
                      />
                    )}
                    {m.other_percentage > 0 && (
                      <div
                        style={{ width: `${m.other_percentage}%`, backgroundColor: '#94a3b8' }}
                        title={`Other: ${m.other_percentage}%`}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-0.5">
                    <span>Impl: {m.impl_percentage}%</span>
                    <span>RE: {m.re_percentage}%</span>
                    <span>Arch: {m.arch_percentage}%</span>
                    <span>PM: {m.pm_percentage}%</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
