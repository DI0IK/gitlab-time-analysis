import * as React from 'react'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GitPullRequest, GitMerge, GitBranch, ExternalLink, Calendar, FolderGit2, CheckCircle2, MessageSquare, ThumbsUp } from 'lucide-react'
import { getRelativePath, formatStatus } from '@/lib/format'
import { UserProfileModal } from '@/features/profile/user-profile-modal'
import { ItemDiscussionThread } from '@/features/notes/item-discussion-thread'
import { Markdown } from '@/components/ui/markdown'

export interface MergeRequestModalData {
  id: string; iid: number; title: string; description?: string | null; state: string
  author_username: string; project_path: string; source_branch: string; target_branch: string
  additions: number; deletions: number; pipeline_status?: string | null; web_url: string
  approved_by_json?: string; discussion_authors_json?: string; discussion_count: number
  created_at: string; merged_at?: string | null; closed_at?: string | null
}

function parseUserList(json?: string | null): string[] {
  try {
    const raw = JSON.parse(json || '[]')
    return (Array.isArray(raw) ? raw : [])
      .map((a: unknown) => (typeof a === 'string' ? a : (a as { username?: string })?.username || ''))
      .filter(Boolean)
  } catch {
    return []
  }
}

export function MergeRequestModal({ mr, slug, onClose }: { mr: MergeRequestModalData | null; slug?: string; onClose: () => void }) {
  const [modalUser, setModalUser] = React.useState<string | null>(null)
  if (!mr) return null

  const isMerged = mr.state === 'merged'
  const isClosed = mr.state === 'closed'
  const badgeVariant = isMerged ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' : isClosed ? 'bg-muted/50 text-muted-foreground' : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'

  const approvers = parseUserList(mr.approved_by_json)
  const discussants = parseUserList(mr.discussion_authors_json)

  return (
    <>
      <Modal
        isOpen={Boolean(mr)}
        onClose={onClose}
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-xs uppercase font-mono ${badgeVariant}`}>
              {isMerged ? <GitMerge className="h-3 w-3 mr-1 inline" /> : <GitPullRequest className="h-3 w-3 mr-1 inline" />}
              {formatStatus(mr.state)}
            </Badge>
            <span className="text-sm font-mono text-muted-foreground font-semibold">!{mr.iid}</span>
          </div>
        }
        description={<div className="text-base font-semibold text-foreground mt-1">{mr.title}</div>}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="inline-flex items-center gap-1.5 font-mono text-primary font-medium" title={mr.project_path}>
                <FolderGit2 className="h-4 w-4" />
                <span>{getRelativePath(mr.project_path, slug)}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-emerald-500 font-semibold">+{mr.additions}</span>
                <span className="text-rose-500 font-semibold">-{mr.deletions}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono bg-background/60 p-2 rounded-md border border-border/40 flex-wrap">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground font-semibold">{mr.source_branch}</span>
              <span className="text-muted-foreground">&rarr;</span>
              <span className="text-muted-foreground">{mr.target_branch}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-border/40 bg-muted/10 space-y-1">
              <div className="text-muted-foreground">Author & Reviews</div>
              <button
                type="button"
                onClick={() => setModalUser(mr.author_username)}
                className="font-medium text-foreground hover:text-primary transition-colors cursor-pointer text-left block"
              >
                @{mr.author_username}
              </button>
              {approvers.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                  <ThumbsUp className="h-3 w-3" />
                  <span>Approved by {approvers.join(', ')}</span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg border border-border/40 bg-muted/10 space-y-1">
              <div className="text-muted-foreground">Discussions & Activity</div>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <span>{mr.discussion_count} comments</span>
              </div>
              {discussants.length > 0 && (
                <div className="text-[11px] text-muted-foreground truncate">
                  Participants: {discussants.join(', ')}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
            <div className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /><span>Created {new Date(mr.created_at).toLocaleDateString()}</span></div>
            {mr.merged_at && <div className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400"><CheckCircle2 className="h-3.5 w-3.5" /><span>Merged {new Date(mr.merged_at).toLocaleDateString()}</span></div>}
            {mr.closed_at && !mr.merged_at && <div className="inline-flex items-center gap-1 text-rose-500"><CheckCircle2 className="h-3.5 w-3.5" /><span>Closed {new Date(mr.closed_at).toLocaleDateString()}</span></div>}
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
            <div className="rounded-lg border border-border/50 bg-background/50 p-3 text-xs leading-relaxed max-h-52 overflow-y-auto font-sans text-foreground">
              {mr.description ? <Markdown content={mr.description} /> : <span className="italic text-muted-foreground">No description provided.</span>}
            </div>
          </div>

          {/* Discussions & Activity Notes */}
          <ItemDiscussionThread mergeRequestId={mr.id} />

          <div className="pt-2 flex justify-end">
            <a href={mr.web_url} target="_blank" rel="noreferrer" className="w-full sm:w-auto">
              <Button size="sm" className="w-full sm:w-auto gap-1.5 min-h-[44px] sm:min-h-[36px]">
                <span>Open in GitLab</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </Modal>

      <UserProfileModal username={modalUser} onClose={() => setModalUser(null)} />
    </>
  )
}
