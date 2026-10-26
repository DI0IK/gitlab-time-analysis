import { Check, Calendar, User } from 'lucide-react'
import type { WikiCommit } from './wiki-history-modal'

interface WikiRevisionItemProps {
  commit: WikiCommit
  isSelected: boolean
  onSelect: (id: string) => void
}

export function WikiRevisionItem({ commit, isSelected, onSelect }: WikiRevisionItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(commit.id)}
      className={`w-full flex items-start justify-between gap-2 px-2.5 py-1.5 rounded text-xs transition-colors text-left ${
        isSelected
          ? 'bg-purple-500/15 text-purple-400 font-medium'
          : 'hover:bg-muted/60 text-foreground'
      }`}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] bg-muted/60 px-1 rounded text-muted-foreground shrink-0">
            {commit.short_id}
          </span>
          <span className="font-medium text-xs truncate line-clamp-1">{commit.title}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5 truncate">
            <User className="h-2.5 w-2.5 opacity-60" />
            {commit.author_name}
          </span>
          {commit.authored_date && (
            <span className="flex items-center gap-0.5 shrink-0">
              <Calendar className="h-2.5 w-2.5 opacity-60" />
              {new Date(commit.authored_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      {isSelected && <Check className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />}
    </button>
  )
}
