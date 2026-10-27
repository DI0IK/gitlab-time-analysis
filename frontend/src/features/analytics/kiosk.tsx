import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { GroupKpiCards } from './group-kpi-cards'
import { GroupFairnessCard } from './group-fairness-card'
import { GroupCategoriesCard } from './group-categories-card'
import { GroupSprintChart } from './group-sprint-chart'
import { GroupMembersTable } from './group-members-table'
import { SprintMatrixTable } from './sprint-matrix'
import { LeaderboardPodium, type LeaderboardItem } from './leaderboard-podium'
import { Button } from '@/components/ui/button'
import { Play, Pause, X, ChevronRight, ChevronLeft } from 'lucide-react'

import { useTenant } from '@/features/tenant/tenant-context'
import { apiKeys } from '@/lib/api/keys'

export function KioskPresentationView({
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

  const [slide, setSlide] = React.useState(0)
  const [isPaused, setIsPaused] = React.useState(false)
  const totalSlides = 4
  const slideNames = ['Overview & Balance', 'Velocity & Members', 'Time Matrix', 'XP Champions']

  const dashboardQuery = useQuery({
    queryKey: apiKeys.rootDashboard(effectiveRootSlug, effectiveGroupSlug),
    queryFn: async () => {
      const { data } = await apiClient.GET(
        '/api/{root_slug}/groups/{group_slug}/dashboard',
        {
          params: {
            path: {
              root_slug: effectiveRootSlug,
              group_slug: effectiveGroupSlug,
            },
          },
        }
      )
      return data
    },
    enabled: Boolean(effectiveRootSlug && effectiveGroupSlug),
    refetchInterval: 60 * 1000,
  })

  const leaderboardQuery = useQuery({
    queryKey: apiKeys.rootLeaderboard(effectiveRootSlug, effectiveGroupSlug),
    queryFn: async () => {
      const { data } = await apiClient.GET(
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
      return (data || []) as LeaderboardItem[]
    },
    enabled: Boolean(effectiveRootSlug && effectiveGroupSlug),
    refetchInterval: 60 * 1000,
  })

  React.useEffect(() => {
    if (isPaused) return
    const timer = setInterval(() => {
      setSlide((prev) => (prev + 1) % totalSlides)
    }, 12000)
    return () => clearInterval(timer)
  }, [isPaused, totalSlides])

  const dash = dashboardQuery.data

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-6 sm:p-10 select-none">
      {/* Top Kiosk Bar */}
      <div className="flex items-center justify-between pb-6 border-b border-border/40">
        <div>
          <span className="text-xs uppercase font-mono tracking-widest text-primary font-bold">Kiosk Presentation Mode</span>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">{dash?.group.name || slug}</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 border border-border/60">
            {[0, 1, 2, 3].map((idx) => (
              <button
                key={idx}
                onClick={() => setSlide(idx)}
                className={`h-2.5 rounded-full transition-all min-w-[20px] ${slide === idx ? 'w-8 bg-primary' : 'w-2.5 bg-muted-foreground/30'}`}
                title={`Slide ${idx + 1}: ${slideNames[idx]}`}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSlide((prev) => (prev - 1 + totalSlides) % totalSlides)}
            className="h-10 w-10 p-0 rounded-full"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="h-10 w-10 p-0 rounded-full"
          >
            {isPaused ? <Play className="h-5 w-5 text-emerald-500" /> : <Pause className="h-5 w-5" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSlide((prev) => (prev + 1) % totalSlides)}
            className="h-10 w-10 p-0 rounded-full"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          <Link
            to="/$rootSlug/$groupSlug"
            params={{ rootSlug: effectiveRootSlug, groupSlug: effectiveGroupSlug }}
            className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Exit Presentation"
          >
            <X className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Main Slide Stage */}
      <div className="flex-1 py-8 flex flex-col justify-center">
        {!dash ? (
          <div className="text-center font-mono text-muted-foreground animate-pulse text-lg">Loading kiosk metrics...</div>
        ) : slide === 0 ? (
          <div className="space-y-6 max-w-6xl mx-auto w-full animate-in fade-in zoom-in-95 duration-500">
            <GroupKpiCards
              totalHours={dash.total_hours}
              estimatedHours={dash.estimated_hours}
              deltaHours={dash.delta_hours}
              accuracyRatio={dash.accuracy_ratio}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
              <GroupFairnessCard fairness={dash.fairness} />
              <GroupCategoriesCard categories={dash.categories} />
            </div>
          </div>
        ) : slide === 1 ? (
          <div className="space-y-6 max-w-6xl mx-auto w-full animate-in fade-in zoom-in-95 duration-500">
            <GroupSprintChart sprints={dash.sprints} />
            <div className="pt-2">
              <GroupMembersTable members={dash.members.slice(0, 6)} />
            </div>
          </div>
        ) : slide === 2 ? (
          <div className="space-y-6 max-w-6xl mx-auto w-full animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold font-display text-foreground">Effort Allocation: User &times; Category Matrix</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Explore workload across project phases with active sprint filtering</p>
            </div>
            <SprintMatrixTable
              matrix={dash.matrix || []}
              sprints={dash.sprints}
              currentSprint={dash.current_sprint}
              defaultSprint={dash.default_sprint}
            />
          </div>
        ) : (
          <div className="space-y-6 max-w-5xl mx-auto w-full animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold font-display">Contributor Standings & XP Champions</h2>
              <p className="text-xs text-muted-foreground mt-1">Live ranking across effort logs and achievements</p>
            </div>
            <LeaderboardPodium topThree={(leaderboardQuery.data || []).slice(0, 3)} />
          </div>
        )}
      </div>
    </div>
  )
}
