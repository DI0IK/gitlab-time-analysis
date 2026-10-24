import * as React from 'react'
import { GitBranch, GitCommit, Check, ChevronDown, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface RepoBranch {
  name: string
  default: boolean
  protected: boolean
}

interface BranchSelectorProps {
  branches: RepoBranch[]
  selectedBranch: string
  onSelectBranch: (branchOrCommit: string) => void
  isLoading?: boolean
  recentCommits?: Array<{ id: string; short_id: string; title: string }>
}

function isCommitSha(ref: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(ref.trim())
}

export function BranchSelector({
  branches,
  selectedBranch,
  onSelectBranch,
  isLoading,
  recentCommits = [],
}: BranchSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [customSha, setCustomSha] = React.useState('')
  const [tab, setTab] = React.useState<'branches' | 'commits'>('branches')
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

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredCommits = recentCommits.filter(
    (c) =>
      c.short_id.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase())
  )

  const isCurrentACommit = isCommitSha(selectedBranch)
  const displayLabel = isCurrentACommit
    ? selectedBranch.slice(0, 8)
    : selectedBranch || 'Select branch'

  const handleApplyCustomRef = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = customSha.trim()
    if (!trimmed) return
    onSelectBranch(trimmed)
    setCustomSha('')
    setOpen(false)
  }

  return (
    <div className="relative inline-block text-left z-30" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isLoading || (branches.length === 0 && !selectedBranch)}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background/90 hover:bg-accent/60 px-3 py-1.5 text-xs font-mono font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
      >
        {isCurrentACommit ? (
          <GitCommit className="h-3.5 w-3.5 text-purple-400 shrink-0" />
        ) : (
          <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />
        )}
        <span className="truncate max-w-[140px] sm:max-w-[200px]">{displayLabel}</span>
        {isCurrentACommit && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-purple-500/40 text-purple-400">
            commit
          </Badge>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 z-[100] mt-1.5 w-72 sm:w-80 rounded-lg border border-border bg-popover p-2 shadow-2xl backdrop-blur-xl">
          {/* Ref Switcher Header Tabs */}
          <div className="flex items-center rounded-md bg-muted/60 p-0.5 border border-border/40 text-xs font-mono mb-2">
            <button
              type="button"
              onClick={() => setTab('branches')}
              className={`flex-1 py-1 rounded text-center transition-colors ${
                tab === 'branches'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Branches ({branches.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('commits')}
              className={`flex-1 py-1 rounded text-center transition-colors ${
                tab === 'commits'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Custom / Commit
            </button>
          </div>

          {/* TAB 1: BRANCHES */}
          {tab === 'branches' && (
            <>
              <div className="pb-1.5 border-b border-border/40">
                <input
                  type="text"
                  placeholder="Filter branches..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded bg-muted/50 px-2 py-1 text-xs font-mono placeholder:text-muted-foreground focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="max-h-56 overflow-y-auto py-1">
                {filteredBranches.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                    No branches found
                  </div>
                ) : (
                  filteredBranches.map((branch) => {
                    const isSelected = branch.name === selectedBranch
                    return (
                      <button
                        key={branch.name}
                        type="button"
                        onClick={() => {
                          onSelectBranch(branch.name)
                          setOpen(false)
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-mono rounded hover:bg-accent/60 transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-foreground'
                        }`}
                      >
                        <span className="truncate mr-2">{branch.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {branch.default && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary"
                            >
                              default
                            </Badge>
                          )}
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </>
          )}

          {/* TAB 2: COMMITS & CUSTOM REF */}
          {tab === 'commits' && (
            <div className="space-y-2 pt-1">
              <form onSubmit={handleApplyCustomRef} className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Enter commit SHA or tag..."
                  value={customSha}
                  onChange={(e) => setCustomSha(e.target.value)}
                  className="flex-1 rounded bg-muted/50 px-2 py-1 text-xs font-mono placeholder:text-muted-foreground border border-input focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!customSha.trim()}
                  className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-mono flex items-center gap-1 disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  <span>Go</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </form>

              {recentCommits.length > 0 && (
                <>
                  <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider pt-1">
                    Recent Commits
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredCommits.slice(0, 15).map((commit) => {
                      const isSelected = selectedBranch === commit.id || selectedBranch === commit.short_id
                      return (
                        <button
                          key={commit.id}
                          type="button"
                          onClick={() => {
                            onSelectBranch(commit.id)
                            setOpen(false)
                          }}
                          className={`w-full text-left p-1.5 rounded text-xs font-mono hover:bg-accent/60 transition-colors flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-purple-500/15 text-purple-400 font-semibold'
                              : 'text-foreground'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-1.5">
                            <GitCommit className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="font-bold shrink-0">{commit.short_id}</span>
                            <span className="truncate text-muted-foreground text-[11px]">
                              {commit.title}
                            </span>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
