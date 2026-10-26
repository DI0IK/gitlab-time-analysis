import { Button } from '@/components/ui/button'
import { User, Layers, Search } from 'lucide-react'
import type { components } from '@/lib/api/schema'

type GroupMemberRecord = components['schemas']['GroupMemberRecord']

interface ActivityToolbarProps {
  activityType: string
  onActivityTypeChange: (type: string) => void
  author: string
  onAuthorChange: (author: string) => void
  sprint: string
  onSprintChange: (sprint: string) => void
  search: string
  onSearchChange: (search: string) => void
  members: GroupMemberRecord[]
  onReset: () => void
}

const TYPE_PILLS = [
  { id: 'all', label: 'All Activity' },
  { id: 'comment', label: 'Discussions' },
  { id: 'system', label: 'System Notes' },
  { id: 'timelog', label: 'Timelogs' },
  { id: 'mr', label: 'Merge Requests' },
  { id: 'work_item', label: 'Work Items' },
]

export function ActivityToolbar({
  activityType,
  onActivityTypeChange,
  author,
  onAuthorChange,
  sprint,
  onSprintChange,
  search,
  onSearchChange,
  members,
  onReset,
}: ActivityToolbarProps) {
  const hasFilters = Boolean(author || sprint || activityType !== 'all' || search)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/60 p-3.5 shadow-xs">
      {/* Type Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {TYPE_PILLS.map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => onActivityTypeChange(pill.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
              activityType === pill.id
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Secondary dropdown filters and search */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-border/40 text-xs">
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={author}
            onChange={(e) => onAuthorChange(e.target.value)}
            className="h-8 rounded-md border border-border/60 bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          >
            <option value="">All Members</option>
            {members.map((m) => (
              <option key={m.username} value={m.username}>
                {m.name ? `${m.name} (@${m.username})` : `@${m.username}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={sprint}
            onChange={(e) => onSprintChange(e.target.value)}
            className="h-8 rounded-md border border-border/60 bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          >
            <option value="">All Sprints</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
              <option key={s} value={s.toString()}>
                Sprint {s}
              </option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 min-w-[160px] sm:max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search feed..."
            className="w-full h-8 pl-8 pr-3 rounded-md border border-border/60 bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            Reset Filters
          </Button>
        )}
      </div>
    </div>
  )
}
