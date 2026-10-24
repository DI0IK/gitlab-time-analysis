import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Calendar } from 'lucide-react'
import { getAvatarUrl } from '@/lib/avatar'
import { UserProfileModal } from '@/features/profile/user-profile-modal'

import { SprintSelector, resolveInitialSprint } from './sprint-selector'

export interface MatrixRow {
  username: string
  name: string
  custom_display_name?: string | null
  avatar_url?: string | null
  sprint_number?: number | null
  pm_hours: number
  re_hours: number
  impl_hours: number
  arch_hours: number
  other_hours: number
  total_hours: number
}

interface SprintMatrixProps {
  matrix: MatrixRow[]
  sprints: Array<{ sprint_number: number; total_hours: number }>
  currentSprint?: number | null
  defaultSprint?: number | null
}

export function SprintMatrixTable({
  matrix,
  sprints,
  currentSprint,
  defaultSprint,
}: SprintMatrixProps) {
  const sprintList = React.useMemo(() => {
    const nums = Array.from(new Set(sprints.map((s) => s.sprint_number))).sort((a, b) => a - b)
    return nums
  }, [sprints])

  const initialSprint = React.useMemo(() => {
    return resolveInitialSprint(sprintList, defaultSprint, currentSprint)
  }, [sprintList, defaultSprint, currentSprint])

  const [userSelectedSprint, setUserSelectedSprint] = React.useState<number | null | undefined>(undefined)
  const selectedSprint = userSelectedSprint !== undefined ? userSelectedSprint : initialSprint
  const [modalUser, setModalUser] = React.useState<string | null>(null)

  const rows = React.useMemo(() => {
    return matrix.filter((r) =>
      selectedSprint === null ? r.sprint_number === null : r.sprint_number === selectedSprint
    )
  }, [matrix, selectedSprint])

  const totals = React.useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        pm: acc.pm + r.pm_hours,
        re: acc.re + r.re_hours,
        impl: acc.impl + r.impl_hours,
        arch: acc.arch + r.arch_hours,
        other: acc.other + r.other_hours,
        total: acc.total + r.total_hours,
      }),
      { pm: 0, re: 0, impl: 0, arch: 0, other: 0, total: 0 }
    )
  }, [rows])

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Historical Progress: User &times; Category Matrix
            </CardTitle>
            <CardDescription>
              Effort allocation across categories with automatic current sprint defaulting.
            </CardDescription>
          </div>
          <SprintSelector
            sprints={sprints}
            selectedSprint={selectedSprint}
            onSelectSprint={setUserSelectedSprint}
            currentSprint={currentSprint}
            defaultSprint={defaultSprint}
            allowAll={true}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/40 border-y border-border/60 font-mono uppercase text-muted-foreground">
            <tr>
              <th className="py-2.5 px-4 font-medium">Engineer</th>
              <th className="py-2.5 px-3 text-right font-medium">PM</th>
              <th className="py-2.5 px-3 text-right font-medium">Req Eng</th>
              <th className="py-2.5 px-3 text-right font-medium">Architecture</th>
              <th className="py-2.5 px-3 text-right font-medium">Implementation</th>
              <th className="py-2.5 px-3 text-right font-medium">Other</th>
              <th className="py-2.5 px-4 text-right font-bold text-foreground">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-mono">
            {rows.map((r) => {
              const displayName = r.custom_display_name || r.name || r.username
              const avatarSrc = getAvatarUrl(r.avatar_url)
              return (
                <tr
                  key={r.username}
                  onClick={() => setModalUser(r.username)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer min-h-[44px]"
                >
                  <td className="py-2.5 px-4 font-sans font-medium text-foreground flex items-center gap-2.5 min-w-[180px]">
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border/60 shrink-0">
                      {avatarSrc ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold text-muted-foreground">{displayName.slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <span className="truncate hover:text-primary transition-colors">{displayName}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">{r.pm_hours > 0 ? `${r.pm_hours}h` : '-'}</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">{r.re_hours > 0 ? `${r.re_hours}h` : '-'}</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">{r.arch_hours > 0 ? `${r.arch_hours}h` : '-'}</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">{r.impl_hours > 0 ? `${r.impl_hours}h` : '-'}</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">{r.other_hours > 0 ? `${r.other_hours}h` : '-'}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-foreground">{r.total_hours.toFixed(1)}h</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-muted/40 border-t border-border/80 font-mono font-bold">
            <tr>
              <td className="py-2.5 px-4 font-sans text-foreground">Sprint Total</td>
              <td className="py-2.5 px-3 text-right text-foreground">{totals.pm.toFixed(1)}h</td>
              <td className="py-2.5 px-3 text-right text-foreground">{totals.re.toFixed(1)}h</td>
              <td className="py-2.5 px-3 text-right text-foreground">{totals.arch.toFixed(1)}h</td>
              <td className="py-2.5 px-3 text-right text-foreground">{totals.impl.toFixed(1)}h</td>
              <td className="py-2.5 px-3 text-right text-foreground">{totals.other.toFixed(1)}h</td>
              <td className="py-2.5 px-4 text-right text-primary font-extrabold">{totals.total.toFixed(1)}h</td>
            </tr>
          </tfoot>
        </table>
      </CardContent>

      <UserProfileModal username={modalUser} onClose={() => setModalUser(null)} />
    </Card>
  )
}
