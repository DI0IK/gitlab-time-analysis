import type { components } from '@/lib/api/schema'
import { ActivityItemCard } from './activity-item-card'
import type { ActivityGroup } from './activity-helpers'

type GroupActivityItem = components['schemas']['GroupActivityItem']

export function ActivityGroupList({
  groups,
  onSelectTarget,
}: {
  groups: ActivityGroup[]
  onSelectTarget: (item: GroupActivityItem) => void
}) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.header} className="space-y-3">
          <div className="flex items-center gap-2 sticky top-28 z-20 bg-background/90 backdrop-blur-xs py-1">
            <span className="text-xs font-bold tracking-wide uppercase text-muted-foreground font-mono">
              {group.header}
            </span>
            <div className="h-px flex-1 bg-border/40" />
          </div>
          <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-border/50">
            {group.items.map((item) => (
              <ActivityItemCard key={item.id} item={item} onSelectTarget={onSelectTarget} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
