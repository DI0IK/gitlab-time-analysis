import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import { getAvatarUrl } from '@/lib/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  Activity,
  GitPullRequest,
  Award,
  Sparkles,
  Maximize2,
  ExternalLink,
  Share2,
  Check,
  Flame,
  Bot,
  User,
} from 'lucide-react'

import { OverviewTab } from './components/overview-tab'
import { ActivityTab } from './components/activity-tab'
import { ContributionsTab } from './components/contributions-tab'
import { BadgesTab } from './components/badges-tab'
import { ShowcaseTab } from './components/showcase-tab'

export type ProfileTab = 'overview' | 'activity' | 'contributions' | 'badges' | 'showcase'

import { useTenant } from '@/features/tenant/tenant-context'

export interface UserProfileContentProps {
  username: string
  rootSlug?: string
  isModal?: boolean
  onClose?: () => void
  initialTab?: ProfileTab
}

const TIER_GLOW_STYLES: Record<string, string> = {
  Bronze: 'ring-amber-700/50 shadow-amber-900/20',
  Silver: 'ring-zinc-400/50 shadow-zinc-400/20',
  Gold: 'ring-amber-400/60 shadow-amber-400/30',
  Platinum: 'ring-cyan-400/60 shadow-cyan-400/30',
  Diamond: 'ring-blue-400/70 shadow-blue-400/30',
  Obsidian: 'ring-purple-500/70 shadow-purple-500/30',
  Grandmaster: 'ring-rose-500/80 shadow-rose-500/40',
}

export function UserProfileContent({
  username,
  rootSlug: propRootSlug,
  isModal = false,
  onClose,
  initialTab = 'overview',
}: UserProfileContentProps) {
  const tenant = useTenant()
  const effectiveRootSlug = propRootSlug || tenant.rootSlug

  const [activeTab, setActiveTab] = React.useState<ProfileTab>(initialTab)
  const [copiedLink, setCopiedLink] = React.useState(false)

  const { data: details, isLoading, error } = useQuery({
    queryKey: apiKeys.rootUserDetails(effectiveRootSlug, username),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/{root_slug}/users/{username}', {
        params: { path: { root_slug: effectiveRootSlug, username } },
      })
      if (error || !data) {
        throw new Error('Failed to load user profile details')
      }
      return data
    },
    enabled: Boolean(username && effectiveRootSlug),
  })

  const handleShareLink = () => {
    const url = `${window.location.origin}/${effectiveRootSlug}/users/${username}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-2">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-muted/60 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-48 bg-muted/60 rounded-md" />
            <div className="h-4 w-32 bg-muted/40 rounded-md" />
          </div>
        </div>
        <div className="h-10 bg-muted/40 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="h-20 bg-muted/40 rounded-xl" />
          <div className="h-20 bg-muted/40 rounded-xl" />
          <div className="h-20 bg-muted/40 rounded-xl" />
          <div className="h-20 bg-muted/40 rounded-xl" />
        </div>
        <div className="h-44 bg-muted/30 rounded-xl" />
      </div>
    )
  }

  if (error || !details) {
    return (
      <div className="p-12 text-center rounded-xl border border-border text-muted-foreground text-sm space-y-2">
        <User className="h-8 w-8 mx-auto text-muted-foreground/40" />
        <p>Could not load profile details for @{username}.</p>
      </div>
    )
  }

  const displayName = details.user.custom_display_name || details.user.name || username
  const avatarSrc = getAvatarUrl(details.user.avatar_url)
  const tierName = details.gamification.level_progress.tier_name
  const tierGlow = TIER_GLOW_STYLES[tierName] || 'ring-border'
  const unlockedBadgesCount = details.badges.filter((b) => b.is_unlocked).length

  return (
    <div className="space-y-6">
      {/* Profile Header & Identity Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/70 bg-gradient-to-r from-card via-card to-muted/20 shadow-xs">
        <div className="flex items-center gap-4 min-w-0">
          {/* Avatar with Tier Ring Glow */}
          <div className={`relative h-16 w-16 rounded-full shrink-0 ring-4 ${tierGlow} shadow-lg overflow-hidden bg-muted flex items-center justify-center`}>
            {avatarSrc ? (
              <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-bold font-mono text-muted-foreground">
                {displayName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-foreground truncate max-w-xs sm:max-w-md">
                {displayName}
              </h2>
              {details.user.is_bot && (
                <Badge variant="outline" className="text-[10px] font-mono gap-1 bg-muted/60">
                  <Bot className="h-3 w-3" /> Bot
                </Badge>
              )}
              {details.gamification.streak_days > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Flame className="h-3.5 w-3.5 fill-amber-500" />
                  {details.gamification.streak_days}d
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
              <a
                href={`https://gitlab.com/${username}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                <span>@{username}</span>
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>

              <span>•</span>
              <span className="text-primary font-semibold">
                Level {details.gamification.level_progress.level} ({tierName})
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShareLink}
            className="gap-1.5 h-9 text-xs font-medium cursor-pointer"
            title="Copy shareable link to this profile"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>Share Profile</span>
              </>
            )}
          </Button>

          {isModal && (
            <Link
              to="/$rootSlug/users/$username"
              params={{ rootSlug: effectiveRootSlug, username }}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted/80 transition-colors"
              title="Open full page view"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Full Page</span>
            </Link>
          )}

          <a
            href={`https://gitlab.com/${username}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center h-9 px-3 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            GitLab
          </a>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1.5 border-b border-border/60 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-primary/15 text-primary border border-primary/30 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'activity'
              ? 'bg-primary/15 text-primary border border-primary/30 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Activity</span>
          {details.recent_timelogs.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-muted/80 text-[10px] font-mono">
              {details.recent_timelogs.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('contributions')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'contributions'
              ? 'bg-primary/15 text-primary border border-primary/30 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
          }`}
        >
          <GitPullRequest className="h-3.5 w-3.5" />
          <span>Contributions</span>
          {details.recent_merge_requests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-muted/80 text-[10px] font-mono">
              {details.recent_merge_requests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('badges')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'badges'
              ? 'bg-primary/15 text-primary border border-primary/30 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
          }`}
        >
          <Award className="h-3.5 w-3.5" />
          <span>Codex</span>
          <span className="px-1.5 py-0.2 rounded-full bg-muted/80 text-[10px] font-mono">
            {unlockedBadgesCount}/{details.badges.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('showcase')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'showcase'
              ? 'bg-primary/15 text-primary border border-primary/30 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Showcase & Embed</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'overview' && <OverviewTab details={details} />}
        {activeTab === 'activity' && <ActivityTab timelogs={details.recent_timelogs} />}
        {activeTab === 'contributions' && (
          <ContributionsTab
            mergeRequests={details.recent_merge_requests}
            metrics={details.metrics}
          />
        )}
        {activeTab === 'badges' && <BadgesTab badges={details.badges} />}
        {activeTab === 'showcase' && <ShowcaseTab username={username} />}
      </div>
    </div>
  )
}
