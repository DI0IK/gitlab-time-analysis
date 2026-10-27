import * as React from 'react'
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileImage,
  File,
  Search,
  ChevronRight,
  CornerLeftUp,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { TreeItem } from './file-tree'

interface RepoExplorerSidebarProps {
  items: TreeItem[]
  currentPath: string
  selectedFile: string | null
  onSelectPath: (path: string) => void
  onSelectFile: (filePath: string) => void
  onNavigateUp?: () => void
  isLoading?: boolean
}

function getIcon(name: string, type: string, isOpen: boolean) {
  if (type === 'tree') {
    return isOpen ? (
      <FolderOpen className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20 shrink-0" />
    ) : (
      <Folder className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20 shrink-0" />
    )
  }

  const ext = name.split('.').pop()?.toLowerCase() || ''
  const codeExts = ['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'java', 'c', 'cpp', 'json', 'toml', 'yaml', 'yml', 'css', 'sql', 'sh']
  const docExts = ['md', 'txt', 'csv', 'log', 'pdf']
  const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico']

  if (codeExts.includes(ext)) {
    return <FileCode className="h-3.5 w-3.5 text-blue-400 shrink-0" />
  }
  if (docExts.includes(ext)) {
    return <FileText className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
  }
  if (imgExts.includes(ext)) {
    return <FileImage className="h-3.5 w-3.5 text-purple-400 shrink-0" />
  }
  return <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
}

export function RepoExplorerSidebar({
  items,
  currentPath,
  selectedFile,
  onSelectPath,
  onSelectFile,
  onNavigateUp,
  isLoading,
}: RepoExplorerSidebarProps) {
  const [filter, setFilter] = React.useState('')

  const sorted = React.useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.type === 'tree' && b.type !== 'tree') return -1
      if (a.type !== 'tree' && b.type === 'tree') return 1
      return a.name.localeCompare(b.name)
    })
  }, [items])

  const filtered = React.useMemo(() => {
    if (!filter.trim()) return sorted
    const q = filter.toLowerCase()
    return sorted.filter((item) => item.name.toLowerCase().includes(q))
  }, [sorted, filter])

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        <div className="h-7 bg-muted/40 rounded animate-pulse" />
        <div className="h-6 bg-muted/30 rounded animate-pulse" />
        <div className="h-6 bg-muted/30 rounded animate-pulse" />
        <div className="h-6 bg-muted/30 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-card/30 border border-border/60 rounded-xl overflow-hidden select-none shadow-xs">
      <div className="p-2.5 border-b border-border/50 bg-muted/20">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter files..."
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
            className="pl-8 h-8 text-xs bg-background/50 border-border/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-xs font-mono">
        {/* Navigate up to parent folder */}
        {currentPath && onNavigateUp && (
          <button
            type="button"
            onClick={onNavigateUp}
            className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors cursor-pointer"
            title="Up to parent folder"
          >
            <CornerLeftUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-semibold">..</span>
          </button>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-[11px]">
            {filter ? `No files match "${filter}"` : 'Folder is empty'}
          </div>
        ) : (
          filtered.map((item) => {
            const isDir = item.type === 'tree'
            const isSelected = isDir
              ? currentPath === item.path
              : selectedFile === item.path

            return (
              <button
                key={item.id || item.path}
                type="button"
                onClick={() => {
                  if (isDir) {
                    onSelectPath(item.path)
                  } else {
                    onSelectFile(item.path)
                  }
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors truncate cursor-pointer ${
                  isSelected
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-foreground/85 hover:bg-accent/40 hover:text-foreground'
                }`}
                title={item.name}
              >
                {isDir ? (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                {getIcon(item.name, item.type, isSelected)}
                <span className="truncate">{item.name}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
