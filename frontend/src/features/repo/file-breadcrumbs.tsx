import { FolderGit2, ChevronRight, Folder } from 'lucide-react'

interface FileBreadcrumbsProps {
  repoName: string
  currentPath: string
  onNavigate: (path: string) => void
}

export function FileBreadcrumbs({ repoName, currentPath, onNavigate }: FileBreadcrumbsProps) {
  const segments = currentPath ? currentPath.split('/').filter(Boolean) : []

  return (
    <nav className="flex items-center gap-1 text-xs font-mono text-muted-foreground overflow-x-auto py-1 px-2 rounded-md bg-muted/30 border border-border/40">
      <button
        type="button"
        onClick={() => onNavigate('')}
        className="flex items-center gap-1.5 font-semibold text-foreground hover:text-primary transition-colors shrink-0"
      >
        <FolderGit2 className="h-3.5 w-3.5 text-primary" />
        <span>{repoName}</span>
      </button>

      {segments.map((segment, index) => {
        const pathUpToSegment = segments.slice(0, index + 1).join('/')
        const isLast = index === segments.length - 1

        return (
          <div key={pathUpToSegment} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            <button
              type="button"
              onClick={() => onNavigate(pathUpToSegment)}
              className={`flex items-center gap-1 px-1 py-0.5 rounded hover:bg-muted/60 transition-colors ${
                isLast ? 'text-primary font-medium' : 'text-foreground hover:text-primary'
              }`}
            >
              {!isLast && <Folder className="h-3 w-3 text-muted-foreground shrink-0" />}
              <span>{segment}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
