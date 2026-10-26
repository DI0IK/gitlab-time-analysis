import * as React from 'react'
import { GitCommit, History, Check, ChevronDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WikiRevisionItem } from './wiki-revision-item'
import type { WikiCommit } from './wiki-history-modal'

interface WikiRevisionSelectorProps {
  commits: WikiCommit[]
  selectedRevision: string
  onSelectRevision: (revision: string) => void
  isLoading?: boolean
}

export function WikiRevisionSelector({
  commits,
  selectedRevision,
  onSelectRevision,
  isLoading,
}: WikiRevisionSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isHead = !selectedRevision || selectedRevision === 'HEAD'
  const activeCommit = !isHead ? commits.find((c) => c.id === selectedRevision || c.short_id === selectedRevision) : null

  const filteredCommits = React.useMemo(() => {
    if (!search.trim()) return commits
    const q = search.toLowerCase()
    return commits.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.short_id.toLowerCase().includes(q) ||
        c.author_name.toLowerCase().includes(q)
    )
  }, [commits, search])

  const handleSelect = (id: string) => {
    onSelectRevision(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        disabled={isLoading}
        onClick={() => setOpen((prev) => !prev)}
        className="h-8 gap-2 font-mono text-xs border-border/60 bg-card hover:bg-card/80 text-foreground"
      >
        {isHead ? (
          <>
            <History className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-semibold text-primary">Latest (HEAD)</span>
          </>
        ) : (
          <>
            <GitCommit className="h-3.5 w-3.5 text-purple-400 shrink-0" />
            <span className="font-semibold text-purple-400">
              {activeCommit ? activeCommit.short_id : selectedRevision.slice(0, 8)}
            </span>
          </>
        )}
        <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
      </Button>

      {open && (
        <div className="absolute left-0 mt-1.5 w-80 sm:w-96 rounded-md border border-border/80 bg-popover shadow-2xl z-[100] overflow-hidden backdrop-blur-md">
          <div className="flex items-center border-b border-border/50 px-3 py-2 bg-muted/20">
            <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search revisions by message, author, or SHA..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded text-xs transition-colors text-left ${
                isHead ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted/60 text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-primary" />
                <div>
                  <div className="font-semibold text-xs">Latest Revision (HEAD)</div>
                  <div className="text-[10px] text-muted-foreground">Always shows latest changes</div>
                </div>
              </div>
              {isHead && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>

            <div className="border-t border-border/40 my-1 px-2.5 py-1 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              Past Revisions
            </div>

            {filteredCommits.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">No matching revisions found</div>
            ) : (
              filteredCommits.map((commit) => (
                <WikiRevisionItem
                  key={commit.id}
                  commit={commit}
                  isSelected={selectedRevision === commit.id || selectedRevision === commit.short_id}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
