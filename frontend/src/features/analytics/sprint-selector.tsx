import * as React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface SprintSelectorProps {
  sprints: number[] | Array<{ sprint_number: number }>
  selectedSprint: number | null
  onSelectSprint: (sprint: number | null) => void
  currentSprint?: number | null
  defaultSprint?: number | null
  allowAll?: boolean
  label?: string
  className?: string
}

/**
 * Resolves the default sprint according to the platform rule:
 * Defaults to this sprint, or last sprint if today is the first day of next sprint.
 * If serverDefault is provided and valid, it uses that; otherwise falls back to the latest recorded sprint.
 */
export function resolveInitialSprint(
  sprintList: number[],
  serverDefault?: number | null,
  serverCurrent?: number | null
): number | null {
  if (serverDefault && sprintList.includes(serverDefault)) {
    return serverDefault
  }
  if (serverCurrent && sprintList.includes(serverCurrent)) {
    return serverCurrent
  }
  if (sprintList.length > 0) {
    return sprintList[sprintList.length - 1]
  }
  return null
}

export function SprintSelector({
  sprints,
  selectedSprint,
  onSelectSprint,
  currentSprint,
  defaultSprint,
  allowAll = true,
  label = 'Sprint Cycle:',
  className = '',
}: SprintSelectorProps) {
  const sprintList = React.useMemo(() => {
    const rawNums = Array.isArray(sprints)
      ? sprints.map((s) => (typeof s === 'number' ? s : s.sprint_number))
      : []
    return Array.from(new Set(rawNums)).sort((a, b) => a - b)
  }, [sprints])

  const currentIndex = selectedSprint === null ? -1 : sprintList.indexOf(selectedSprint)

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectSprint(sprintList[currentIndex - 1])
    } else if (currentIndex === 0) {
      if (allowAll) {
        onSelectSprint(null)
      }
    }
  }

  const handleNext = () => {
    if (currentIndex === -1 && sprintList.length > 0) {
      onSelectSprint(sprintList[0])
    } else if (currentIndex >= 0 && currentIndex < sprintList.length - 1) {
      onSelectSprint(sprintList[currentIndex + 1])
    }
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {label && (
        <span className="text-xs text-muted-foreground whitespace-nowrap font-medium hidden sm:inline">
          {label}
        </span>
      )}

      {/* Previous Sprint Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrev}
        disabled={selectedSprint === null || (currentIndex === 0 && !allowAll)}
        className="h-9 px-2 text-xs font-mono"
        title="Previous Sprint"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* 50+ Sprints Dropdown Select */}
      <select
        value={selectedSprint === null ? 'all' : String(selectedSprint)}
        onChange={(e) => onSelectSprint(e.target.value === 'all' ? null : Number(e.target.value))}
        aria-label="Filter by Sprint"
        className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring h-9 cursor-pointer shadow-xs min-w-[170px]"
      >
        {allowAll && <option value="all">All Sprints (Overall Aggregate)</option>}
        {sprintList.map((num) => {
          let suffix = ''
          if (num === currentSprint) {
            suffix = ' (Current)'
          } else if (num === defaultSprint) {
            suffix = ' (Review)'
          }

          return (
            <option key={num} value={String(num)}>
              Sprint {num}
              {suffix}
            </option>
          )
        })}
      </select>

      {/* Next Sprint Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleNext}
        disabled={currentIndex === sprintList.length - 1}
        className="h-9 px-2 text-xs font-mono"
        title="Next Sprint"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
