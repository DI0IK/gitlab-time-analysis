import { Button } from '@/components/ui/button'
import {
  Code2,
  GitCommit,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
} from 'lucide-react'
import { BranchSelector, type RepoBranch } from './branch-selector'
import type { CommitItem } from './commit-history'

interface RepoToolbarProps {
  branches: RepoBranch[]
  selectedBranch: string
  recentCommits: CommitItem[]
  activeTab: 'code' | 'commits'
  sidebarOpen: boolean
  gitlabWebUrl?: string
  isBranchesLoading?: boolean
  onToggleSidebar: () => void
  onSelectBranch: (branch: string) => void
  onTabChange: (tab: 'code' | 'commits') => void
}

export function RepoToolbar({
  branches,
  selectedBranch,
  recentCommits,
  activeTab,
  sidebarOpen,
  gitlabWebUrl,
  isBranchesLoading,
  onToggleSidebar,
  onSelectBranch,
  onTabChange,
}: RepoToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl border border-border/60 bg-card/50 backdrop-blur-xs shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1.5"
          title={sidebarOpen ? 'Hide explorer sidebar' : 'Show explorer sidebar'}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
          <span className="text-xs hidden sm:inline">Files</span>
        </Button>

        <BranchSelector
          branches={branches}
          selectedBranch={selectedBranch}
          recentCommits={recentCommits}
          onSelectBranch={onSelectBranch}
          isLoading={isBranchesLoading}
        />

        {/* View Tabs: Code & Commits only */}
        <div className="flex items-center rounded-lg bg-muted/50 p-0.5 border border-border/40 text-xs font-mono">
          <button
            type="button"
            onClick={() => onTabChange('code')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer ${
              activeTab === 'code'
                ? 'bg-background text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code2 className="h-3.5 w-3.5 text-primary" />
            <span>Code</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('commits')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer ${
              activeTab === 'commits'
                ? 'bg-background text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <GitCommit className="h-3.5 w-3.5 text-primary" />
            <span>Commits</span>
          </button>
        </div>
      </div>

      {gitlabWebUrl && (
        <a
          href={gitlabWebUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground font-mono rounded-lg hover:bg-accent/40 transition-colors"
        >
          <span>GitLab Web</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
