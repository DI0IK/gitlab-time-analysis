import {
  Folder,
  FileCode,
  FileText,
  FileImage,
  File,
  CornerLeftUp,
} from 'lucide-react'

export interface TreeItem {
  id: string
  name: string
  type: string // "tree" or "blob"
  path: string
  mode: string
}

interface FileTreeProps {
  items: TreeItem[]
  currentPath: string
  onSelectPath: (path: string) => void
  onSelectFile: (path: string) => void
  onNavigateUp: () => void
  isLoading?: boolean
}

function getFileIcon(name: string, type: string) {
  if (type === 'tree') {
    return <Folder className="h-4 w-4 text-amber-500/90 fill-amber-500/20 shrink-0" />
  }

  const ext = name.split('.').pop()?.toLowerCase() || ''
  const codeExts = [
    'ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'java', 'c', 'cpp',
    'h', 'html', 'css', 'scss', 'sql', 'graphql', 'json', 'yaml', 'yml', 'toml', 'sh',
  ]
  const docExts = ['md', 'txt', 'csv', 'log', 'pdf', 'rst']
  const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico']

  if (codeExts.includes(ext)) {
    return <FileCode className="h-4 w-4 text-blue-400 shrink-0" />
  }
  if (docExts.includes(ext)) {
    return <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
  }
  if (imgExts.includes(ext)) {
    return <FileImage className="h-4 w-4 text-purple-400 shrink-0" />
  }
  return <File className="h-4 w-4 text-muted-foreground shrink-0" />
}

export function FileTree({
  items,
  currentPath,
  onSelectPath,
  onSelectFile,
  onNavigateUp,
  isLoading,
}: FileTreeProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-2 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-8 rounded bg-muted/40 w-full" />
        ))}
      </div>
    )
  }

  // Sort directories first, then files alphabetically
  const sorted = [...items].sort((a, b) => {
    if (a.type === 'tree' && b.type !== 'tree') return -1
    if (a.type !== 'tree' && b.type === 'tree') return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 backdrop-blur-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground">
              <th className="py-2.5 px-3 font-medium">Name</th>
              <th className="py-2.5 px-3 font-medium hidden sm:table-cell w-28">Type</th>
              <th className="py-2.5 px-3 font-medium hidden md:table-cell w-28">Mode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {currentPath && (
              <tr
                onClick={onNavigateUp}
                className="hover:bg-accent/40 cursor-pointer transition-colors group"
              >
                <td colSpan={3} className="py-2 px-3 text-muted-foreground flex items-center gap-2 group-hover:text-foreground">
                  <CornerLeftUp className="h-4 w-4 text-muted-foreground/70 group-hover:text-primary transition-colors" />
                  <span className="font-semibold text-xs">..</span>
                </td>
              </tr>
            )}

            {sorted.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-muted-foreground">
                  Empty directory
                </td>
              </tr>
            ) : (
              sorted.map((item) => {
                const isTree = item.type === 'tree'

                return (
                  <tr
                    key={item.id}
                    onClick={() => {
                      if (isTree) {
                        onSelectPath(item.path)
                      } else {
                        onSelectFile(item.path)
                      }
                    }}
                    className="hover:bg-accent/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {getFileIcon(item.name, item.type)}
                        <span
                          className={`truncate ${
                            isTree
                              ? 'font-medium text-foreground group-hover:text-primary group-hover:underline'
                              : 'text-foreground/90 group-hover:text-primary'
                          }`}
                        >
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell capitalize">
                      {isTree ? 'Directory' : 'File'}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground hidden md:table-cell text-[11px]">
                      {item.mode}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
