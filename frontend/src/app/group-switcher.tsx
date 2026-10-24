import { useState, useRef, useEffect } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDown, Check, Layers, Users, Search } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'

interface GroupItem {
  slug: string
  name: string
  isRoot?: boolean
}

export function GroupSwitcher() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const groupMatch = pathname.match(/\/groups\/([^/]+)/)
  const currentSlug = groupMatch ? groupMatch[1] : null
  const subPath = currentSlug ? pathname.replace(`/groups/${currentSlug}`, '') : ''

  const { data: meta } = useQuery({
    queryKey: apiKeys.meta,
    queryFn: async () => (await apiClient.GET('/api/meta')).data,
  })

  const { data: dbGroups } = useQuery({
    queryKey: apiKeys.groups,
    queryFn: async () => (await apiClient.GET('/api/groups')).data,
  })

  const fallbackRoots: GroupItem[] = (
    meta?.root_groups || (meta?.group_path ? [meta.group_path] : [])
  ).map((rg) => ({
    slug: rg.replace(/\//g, '-'),
    name: rg,
    isRoot: true,
  }))

  const knownGroups: GroupItem[] = dbGroups?.length
    ? dbGroups.map((g) => ({
        slug: g.full_path.replace(/\//g, '-'),
        name: g.name,
        isRoot: g.level === 0,
      }))
    : fallbackRoots.length
      ? fallbackRoots
      : [{ slug: 'dhbw-tinf24', name: 'dhbw/tinf24', isRoot: true }]

  const filteredGroups = knownGroups.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.slug.toLowerCase().includes(search.toLowerCase())
  )

  const activeGroup = knownGroups.find((g) => g.slug === currentSlug)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  const select = (slug?: string) => {
    setOpen(false)
    setSearch('')
    navigate({ to: slug ? (subPath ? `/groups/${slug}${subPath}` : `/groups/${slug}`) : '/' })
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-muted/70 hover:border-border focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Switch cohort or group"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary">
          {currentSlug ? <Users className="h-3 w-3" /> : <Layers className="h-3 w-3" />}
        </div>
        <div className="flex flex-col text-left">
          <span className="max-w-[110px] sm:max-w-[150px] truncate font-semibold leading-tight">
            {activeGroup ? activeGroup.name : 'All Cohorts'}
          </span>
          <span className="text-[10px] text-muted-foreground leading-none">
            {activeGroup?.isRoot ? 'Root Group' : currentSlug ? 'Subgroup' : 'Comparison'}
          </span>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5 opacity-60" />
      </button>

      {open && (
        <div className="glass-dropdown absolute left-0 mt-2 w-72 rounded-xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="relative mb-2 px-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter cohorts or teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border/50 bg-background/50 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <button
              onClick={() => select()}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                !currentSlug ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-accent/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-medium">All Cohorts Overview</p>
                  <p className="text-[10px] text-muted-foreground">Cross-group benchmarks</p>
                </div>
              </div>
              {!currentSlug && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>

            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Cohort Groups
            </div>

            {filteredGroups.map((g) => (
              <button
                key={g.slug}
                onClick={() => select(g.slug)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                  currentSlug === g.slug ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                    {g.slug.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium truncate max-w-[130px]">{g.name}</p>
                      {g.isRoot && (
                        <span className="rounded bg-primary/20 px-1 py-0.2 text-[9px] font-semibold text-primary shrink-0">
                          Root
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[160px]">{g.slug}</p>
                  </div>
                </div>
                {currentSlug === g.slug && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
