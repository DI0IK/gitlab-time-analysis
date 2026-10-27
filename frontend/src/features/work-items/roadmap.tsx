import * as React from 'react'
import {
  format,
  differenceInDays,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  min as minDate,
  max as maxDate,
} from 'date-fns'
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  CircleDot,
  Layers,
  ListTodo,
  CheckSquare,
  Clock,
  Compass,
  Calendar,
  FolderGit2,
  Folder,
} from 'lucide-react'
import type { WorkItemModalData } from './work-item-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getRelativePath } from '@/lib/format'

export type ZoomLevel = 'weeks' | 'months' | 'quarters'

interface WorkItemsRoadmapProps {
  items: WorkItemModalData[]
  rootItems: WorkItemModalData[]
  childrenMap: Map<string, WorkItemModalData[]>
  expanded: Set<string>
  onToggle: (id: string) => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onSelect: (item: WorkItemModalData) => void
  slug?: string
  rootGroupPath?: string
}

interface ProcessedItem {
  item: WorkItemModalData
  depth: number
  startDate: Date
  endDate: Date
  isExplicitStart: boolean
  isExplicitEnd: boolean
  hasChildren: boolean
  childCount: number
  closedChildCount: number
  progressPct: number
}

// Estimate end date for open items without explicit due date
function computeItemDates(
  item: WorkItemModalData,
  childrenMap: Map<string, WorkItemModalData[]>,
  visited: Set<string> = new Set()
): { start: Date; end: Date; explicitStart: boolean; explicitEnd: boolean } {
  if (visited.has(item.id)) {
    const fallback = new Date(item.created_at)
    return { start: fallback, end: addDays(fallback, 14), explicitStart: false, explicitEnd: false }
  }
  visited.add(item.id)

  let explicitStart = false
  let explicitEnd = false

  let start: Date
  if (item.start_date) {
    const parsed = new Date(item.start_date)
    if (!Number.isNaN(parsed.getTime())) {
      start = parsed
      explicitStart = true
    } else {
      start = new Date(item.created_at)
    }
  } else {
    start = new Date(item.created_at)
  }

  let end: Date
  if (item.due_date) {
    const parsed = new Date(item.due_date)
    if (!Number.isNaN(parsed.getTime())) {
      end = parsed
      explicitEnd = true
    } else {
      end = item.closed_at ? new Date(item.closed_at) : addDays(start, 14)
    }
  } else if (item.closed_at) {
    end = new Date(item.closed_at)
  } else {
    // If has time estimate, use it (estimate in seconds / 28800 working hours -> days)
    if (item.time_estimate > 0) {
      const workingDays = Math.max(Math.ceil(item.time_estimate / 28800), 3)
      end = addDays(start, workingDays * 1.5)
    } else {
      end = addDays(start, 14)
    }
  }

  // Roll up from children if any exist
  const children = childrenMap.get(item.id) || []
  if (children.length > 0) {
    const childSpans = children.map((c) => computeItemDates(c, childrenMap, new Set(visited)))
    const childStarts = childSpans.map((s) => s.start)
    const childEnds = childSpans.map((s) => s.end)

    if (!explicitStart && childStarts.length > 0) {
      start = minDate([start, ...childStarts])
    }
    if (!explicitEnd && childEnds.length > 0) {
      end = maxDate([end, ...childEnds])
    }
  }

  // Ensure end >= start
  if (end < start) {
    end = addDays(start, 1)
  }

  return { start, end, explicitStart, explicitEnd }
}

export function WorkItemsRoadmap({
  items,
  rootItems,
  childrenMap,
  expanded,
  onToggle,
  onExpandAll,
  onCollapseAll,
  onSelect,
  slug,
  rootGroupPath,
}: WorkItemsRoadmapProps) {
  const [currentDate] = React.useState<Date>(() => new Date())
  const [zoom, setZoom] = React.useState<ZoomLevel>('months')
  const timelineScrollRef = React.useRef<HTMLDivElement>(null)
  const leftPanelScrollRef = React.useRef<HTMLDivElement>(null)
  const [hoveredItem, setHoveredItem] = React.useState<ProcessedItem | null>(null)
  const [tooltipPos, setTooltipPos] = React.useState<{ x: number; y: number } | null>(null)

  // 1. Precalculate dates and hierarchy
  const processedItems = React.useMemo(() => {
    const dateMap = new Map<
      string,
      { start: Date; end: Date; explicitStart: boolean; explicitEnd: boolean }
    >()

    for (const item of items) {
      dateMap.set(item.id, computeItemDates(item, childrenMap))
    }

    const result: ProcessedItem[] = []

    function traverse(node: WorkItemModalData, depth: number) {
      const children = childrenMap.get(node.id) || []
      const hasChildren = children.length > 0
      const dates = dateMap.get(node.id) || {
        start: new Date(node.created_at),
        end: addDays(new Date(node.created_at), 14),
        explicitStart: false,
        explicitEnd: false,
      }

      const closedChildren = children.filter((c) => c.state.toLowerCase() === 'closed').length
      let progressPct = 0
      if (hasChildren) {
        progressPct = Math.round((closedChildren / children.length) * 100)
      } else if (node.state.toLowerCase() === 'closed') {
        progressPct = 100
      } else if (node.time_estimate > 0) {
        progressPct = Math.min(Math.round((node.total_time_spent / node.time_estimate) * 100), 100)
      }

      result.push({
        item: node,
        depth,
        startDate: dates.start,
        endDate: dates.end,
        isExplicitStart: dates.explicitStart,
        isExplicitEnd: dates.explicitEnd,
        hasChildren,
        childCount: children.length,
        closedChildCount: closedChildren,
        progressPct,
      })

      if (hasChildren && expanded.has(node.id)) {
        for (const child of children) {
          traverse(child, depth + 1)
        }
      }
    }

    for (const root of rootItems) {
      traverse(root, 0)
    }

    return result
  }, [items, rootItems, childrenMap, expanded])

  // 2. Compute timeline bounding dates
  const { timelineStart, timelineEnd, totalDays, pxPerDay } = React.useMemo(() => {
    let minD = currentDate
    let maxD = addDays(currentDate, 30)

    if (processedItems.length > 0) {
      const allStarts = processedItems.map((p) => p.startDate)
      const allEnds = processedItems.map((p) => p.endDate)
      minD = minDate([...allStarts, currentDate])
      maxD = maxDate([...allEnds, currentDate])
    }

    // Add padding days around timeline bounds
    let start: Date
    let end: Date

    if (zoom === 'weeks') {
      start = startOfWeek(subDays(minD, 7), { weekStartsOn: 1 })
      end = endOfWeek(addDays(maxD, 14), { weekStartsOn: 1 })
    } else if (zoom === 'quarters') {
      start = startOfQuarter(subDays(minD, 30))
      end = endOfQuarter(addDays(maxD, 45))
    } else {
      // months
      start = startOfMonth(subDays(minD, 14))
      end = endOfMonth(addDays(maxD, 21))
    }

    const days = Math.max(differenceInDays(end, start), 14)

    // Pixel scaling per day
    let pixels: number
    if (zoom === 'weeks') {
      pixels = 28 // 196px per week
    } else if (zoom === 'quarters') {
      pixels = 3.5 // approx 315px per quarter
    } else {
      pixels = 9 // approx 270px per month
    }

    return {
      timelineStart: start,
      timelineEnd: end,
      totalDays: days,
      pxPerDay: pixels,
    }
  }, [processedItems, zoom, currentDate])

  const totalGridWidth = totalDays * pxPerDay
  const todayOffset = differenceInDays(currentDate, timelineStart) * pxPerDay
  const isTodayVisible = currentDate >= timelineStart && currentDate <= timelineEnd

  // 3. Generate Header Intervals
  const headerStructure = React.useMemo(() => {
    if (zoom === 'weeks') {
      const weeks = eachWeekOfInterval(
        { start: timelineStart, end: timelineEnd },
        { weekStartsOn: 1 }
      )
      return {
        primary: weeks.map((w) => {
          const wEnd = endOfWeek(w, { weekStartsOn: 1 })
          const duration = differenceInDays(wEnd, w) + 1
          const width = duration * pxPerDay
          return {
            key: w.toISOString(),
            label: format(w, 'MMM yyyy'),
            subLabel: `W${format(w, 'I')} (${format(w, 'd')} - ${format(wEnd, 'd')})`,
            width,
          }
        }),
      }
    }

    if (zoom === 'quarters') {
      const quarters = eachQuarterOfInterval({ start: timelineStart, end: timelineEnd })
      return {
        primary: quarters.map((q) => {
          const qEnd = endOfQuarter(q)
          const duration = differenceInDays(qEnd, q) + 1
          const width = duration * pxPerDay
          return {
            key: q.toISOString(),
            label: `Q${Math.floor(q.getMonth() / 3) + 1} ${format(q, 'yyyy')}`,
            subLabel: `${format(q, 'MMM')} - ${format(qEnd, 'MMM')}`,
            width,
          }
        }),
      }
    }

    // Default: Months
    const months = eachMonthOfInterval({ start: timelineStart, end: timelineEnd })
    return {
      primary: months.map((m) => {
        const mEnd = endOfMonth(m)
        const duration = differenceInDays(mEnd, m) + 1
        const width = duration * pxPerDay
        return {
          key: m.toISOString(),
          label: format(m, 'MMMM yyyy'),
          subLabel: `${duration} days`,
          width,
        }
      }),
    }
  }, [timelineStart, timelineEnd, pxPerDay, zoom])

  // Synchronize vertical scroll between left items list and right timeline
  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setHoveredItem(null)
    if (leftPanelScrollRef.current) {
      leftPanelScrollRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  const handleLeftPanelScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setHoveredItem(null)
    if (timelineScrollRef.current) {
      timelineScrollRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  // Jump to Today
  const jumpToToday = () => {
    if (!timelineScrollRef.current) return
    const containerWidth = timelineScrollRef.current.clientWidth
    timelineScrollRef.current.scrollTo({
      left: Math.max(0, todayOffset - containerWidth / 2),
      behavior: 'smooth',
    })
  }

  // Scroll to start
  const scrollToStart = () => {
    if (!timelineScrollRef.current) return
    timelineScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' })
  }

  // Initial scroll to today
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (timelineScrollRef.current) {
        const containerWidth = timelineScrollRef.current.clientWidth
        if (isTodayVisible) {
          timelineScrollRef.current.scrollTo({
            left: Math.max(0, todayOffset - containerWidth / 3),
            behavior: 'auto',
          })
        }
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [isTodayVisible, todayOffset, zoom])

  return (
    <div className="space-y-3">
      {/* Roadmap Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border/70 bg-card/70 backdrop-blur-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-md border border-border p-1 bg-muted/40">
            <button
              onClick={() => setZoom('weeks')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                zoom === 'weeks'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Weeks
            </button>
            <button
              onClick={() => setZoom('months')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                zoom === 'months'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Months
            </button>
            <button
              onClick={() => setZoom('quarters')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                zoom === 'quarters'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Quarters
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={jumpToToday}
            className="text-xs h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            title="Scroll timeline to current date"
          >
            <Compass className="h-3.5 w-3.5" />
            Today
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={scrollToStart}
            className="text-xs h-8 text-muted-foreground hover:text-foreground"
            title="Scroll to beginning of timeline"
          >
            Scroll to Start
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExpandAll}
            className="text-xs text-primary hover:underline cursor-pointer font-medium"
          >
            Expand All
          </button>
          <span className="text-muted-foreground text-xs">•</span>
          <button
            onClick={onCollapseAll}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer font-medium"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Main Roadmap Board */}
      <div className="rounded-lg border border-border/80 bg-card overflow-hidden shadow-xs flex">
        {/* Left Column: Hierarchical Items List */}
        <div className="w-[300px] sm:w-[340px] shrink-0 border-r border-border flex flex-col z-10 bg-card">
          {/* Left Column Header */}
          <div className="h-12 border-b border-border bg-muted/40 px-3 flex items-center justify-between shrink-0 select-none">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Hierarchy ({processedItems.length})
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">Item Title</span>
          </div>

          {/* Left Column Scrollable Item Rows */}
          <div
            ref={leftPanelScrollRef}
            onScroll={handleLeftPanelScroll}
            className="overflow-y-auto overflow-x-hidden divide-y divide-border/40 flex-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {processedItems.map((p) => {
              const { item, depth, hasChildren, progressPct } = p
              const isClosed = item.state.toLowerCase() === 'closed'
              const isEpic = item.work_item_type.toLowerCase() === 'epic'
              const isTask = item.work_item_type.toLowerCase() === 'task'
              const isExpanded = expanded.has(item.id)

              return (
                <div
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className={`h-11 flex items-center gap-1.5 px-2 hover:bg-muted/40 cursor-pointer transition select-none group ${
                    hoveredItem?.item.id === item.id ? 'bg-muted/50' : ''
                  }`}
                  style={{ paddingLeft: `${8 + depth * 18}px` }}
                >
                  {/* Expand / Collapse Chevron */}
                  {hasChildren ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggle(item.id)
                      }}
                      className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/70 transition"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : (
                    <div className="w-5.5 shrink-0" />
                  )}

                  {/* Type Icon */}
                  {isEpic ? (
                    <Layers className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                  ) : isTask ? (
                    <CheckSquare className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                  ) : (
                    <ListTodo className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  )}

                  {/* Status Indicator */}
                  {isClosed ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                  ) : (
                    <CircleDot className="h-3 w-3 text-amber-500 shrink-0" />
                  )}

                  {/* IID */}
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    #{item.iid}
                  </span>

                  {/* Title */}
                  <span
                    className={`text-xs truncate font-medium flex-1 ${
                      isClosed
                        ? 'text-muted-foreground line-through decoration-muted-foreground/50'
                        : 'text-foreground'
                    }`}
                    title={item.title}
                  >
                    {item.title}
                  </span>

                  {/* Progress Pill */}
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
                      progressPct === 100
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold'
                        : progressPct > 0
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground/60'
                    }`}
                  >
                    {progressPct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Timeline Gantt Grid */}
        <div
          ref={timelineScrollRef}
          onScroll={handleTimelineScroll}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-background/50 flex flex-col"
        >
          <div style={{ width: `${totalGridWidth}px` }} className="flex flex-col min-h-full">
            {/* Right Column Sticky Header */}
            <div className="sticky top-0 z-30 h-12 border-b border-border bg-muted/90 backdrop-blur-xs flex shrink-0 select-none">
              {headerStructure.primary.map((col) => (
                <div
                  key={col.key}
                  style={{ width: `${col.width}px` }}
                  className="shrink-0 border-r border-border/60 p-1.5 text-center flex flex-col justify-center"
                >
                  <div className="text-xs font-bold text-foreground truncate">{col.label}</div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">
                    {col.subLabel}
                  </div>
                </div>
              ))}
            </div>

            {/* Grid Rows Container */}
            <div className="relative divide-y divide-border/30 flex-1">
              {/* Background Grid Columns */}
              <div className="absolute inset-0 flex pointer-events-none z-0">
                {headerStructure.primary.map((col, idx) => (
                  <div
                    key={col.key}
                    style={{ width: `${col.width}px` }}
                    className={`shrink-0 border-r border-border/30 h-full ${
                      idx % 2 === 1 ? 'bg-muted/10' : ''
                    }`}
                  />
                ))}
              </div>

              {/* Vertical "Today" Line */}
              {isTodayVisible && (
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none flex flex-col items-center"
                  style={{ left: `${todayOffset}px` }}
                >
                  <div className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-xs -translate-y-1">
                    Today
                  </div>
                  <div className="w-[2px] flex-1 bg-primary/70 shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                </div>
              )}

              {/* Timeline Row Bars */}
              {processedItems.map((p) => {
                const {
                  item,
                  startDate,
                  endDate,
                  isExplicitStart,
                  isExplicitEnd,
                  progressPct,
                } = p
                const isClosed = item.state.toLowerCase() === 'closed'
                const isEpic = item.work_item_type.toLowerCase() === 'epic'
                const isTask = item.work_item_type.toLowerCase() === 'task'

                // Position calculation
                const offsetDays = differenceInDays(startDate, timelineStart)
                const spanDays = Math.max(differenceInDays(endDate, startDate) + 1, 1)

                const barLeft = offsetDays * pxPerDay
                const barWidth = Math.max(spanDays * pxPerDay, 28)

                // Visual styling based on work item type and status
                let barGradient = isClosed
                  ? 'bg-muted/80 border-border/80 text-muted-foreground'
                  : isEpic
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 border-purple-400/40 text-white shadow-xs'
                  : isTask
                  ? 'bg-gradient-to-r from-sky-500 to-teal-500 border-sky-400/40 text-white shadow-xs'
                  : 'bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 border-blue-400/40 text-white shadow-xs'

                if (isClosed) {
                  barGradient =
                    'bg-muted/60 border-emerald-500/30 text-foreground/80 dark:bg-muted/40'
                }

                return (
                  <div
                    key={item.id}
                    className={`h-11 relative flex items-center transition select-none ${
                      hoveredItem?.item.id === item.id ? 'bg-muted/20' : ''
                    }`}
                  >
                    {/* The Interactive Timeline Bar */}
                    <div
                      onClick={() => onSelect(item)}
                      onMouseEnter={(e) => {
                        setHoveredItem(p)
                        setTooltipPos({ x: e.clientX, y: e.clientY })
                      }}
                      onMouseMove={(e) => {
                        setTooltipPos({ x: e.clientX, y: e.clientY })
                      }}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`absolute h-7 rounded-md border flex items-center px-2 cursor-pointer transition-all duration-150 hover:brightness-110 hover:shadow-md hover:scale-[1.01] overflow-hidden z-10 ${barGradient}`}
                      style={{
                        left: `${barLeft}px`,
                        width: `${barWidth}px`,
                      }}
                    >
                      {/* Inner Progress Fill */}
                      {progressPct > 0 && !isClosed && (
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-white/20 pointer-events-none rounded-l-md"
                          style={{ width: `${progressPct}%` }}
                        />
                      )}

                      {/* Closed checkmark indicator inside bar */}
                      {isClosed && (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 mr-1 shrink-0" />
                      )}

                      {/* Bar text label */}
                      <span className="text-[11px] font-medium truncate relative z-10 drop-shadow-xs">
                        #{item.iid} {item.title}
                      </span>

                      {/* Small Progress label inside bar if wide enough */}
                      {barWidth > 120 && progressPct > 0 && (
                        <span className="ml-auto text-[10px] font-mono font-bold opacity-90 pl-1 relative z-10 shrink-0">
                          {progressPct}%
                        </span>
                      )}

                      {/* Estimated span indicator (subtle dashes if not explicit) */}
                      {(!isExplicitStart || !isExplicitEnd) && !isClosed && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-r from-transparent to-black/20 pointer-events-none"
                          title="Span contains estimated or child-derived dates"
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Rich Hover Floating Tooltip */}
      {hoveredItem && tooltipPos && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 w-72 rounded-lg border border-border/80 bg-popover/95 backdrop-blur-md p-3 text-popover-foreground shadow-xl transition-opacity animate-in fade-in-0 zoom-in-95"
          style={{
            left: `${Math.max(160, Math.min(typeof window !== 'undefined' ? window.innerWidth - 160 : 1000, tooltipPos.x))}px`,
            top: `${tooltipPos.y - 12}px`,
          }}
        >
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={`text-[10px] uppercase font-mono ${
                hoveredItem.item.work_item_type.toLowerCase() === 'epic'
                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30'
                  : hoveredItem.item.work_item_type.toLowerCase() === 'task'
                  ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
              }`}
            >
              {hoveredItem.item.work_item_type}
            </Badge>

            <span className="text-xs font-mono font-semibold text-muted-foreground">
              #{hoveredItem.item.iid}
            </span>

            <span
              className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                hoveredItem.item.state.toLowerCase() === 'closed'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-emerald-500/15 text-emerald-600'
              }`}
            >
              {hoveredItem.item.state}
            </span>
          </div>

          <div className="text-xs font-semibold text-foreground mb-2 line-clamp-2">
            {hoveredItem.item.title}
          </div>

          <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-primary" />
                Schedule:
              </span>
              <span className="font-medium text-foreground">
                {format(hoveredItem.startDate, 'MMM d, yyyy')} –{' '}
                {format(hoveredItem.endDate, 'MMM d, yyyy')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Duration:</span>
              <span className="font-mono text-foreground font-semibold">
                {differenceInDays(hoveredItem.endDate, hoveredItem.startDate) + 1} days
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Date Origin:</span>
              <span className="text-[10px] font-mono">
                {hoveredItem.isExplicitStart && hoveredItem.isExplicitEnd
                  ? 'GitLab Target Dates'
                  : hoveredItem.hasChildren
                  ? 'Rolled up from children'
                  : 'Created / Estimated'}
              </span>
            </div>

            {hoveredItem.hasChildren && (
              <div className="flex items-center justify-between">
                <span>Children Progress:</span>
                <span className="font-mono text-foreground">
                  {hoveredItem.closedChildCount} / {hoveredItem.childCount} closed (
                  {hoveredItem.progressPct}%)
                </span>
              </div>
            )}

            {hoveredItem.item.time_estimate > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Time Tracking:
                </span>
                <span className="font-mono text-foreground">
                  {(hoveredItem.item.total_time_spent / 3600).toFixed(1)}h /{' '}
                  {(hoveredItem.item.time_estimate / 3600).toFixed(1)}h
                </span>
              </div>
            )}

            {hoveredItem.item.project_path && (
              <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground truncate pt-1">
                {hoveredItem.item.work_item_type.toLowerCase() === 'epic' ? (
                  <Folder className="h-3 w-3 text-purple-500 shrink-0" />
                ) : (
                  <FolderGit2 className="h-3 w-3 text-primary shrink-0" />
                )}
                <span className="truncate">
                  {getRelativePath(hoveredItem.item.project_path, slug, rootGroupPath)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
