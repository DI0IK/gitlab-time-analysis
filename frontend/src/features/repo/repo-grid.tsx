import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Folder, ExternalLink, GitPullRequest, ListTodo, Search, Code2 } from 'lucide-react'

export interface RepositoryItem {
  name: string
  full_path: string
  web_url: string
  work_items_count: number
  merge_requests_count: number
}

interface RepoGridProps {
  repos: RepositoryItem[]
  isLoading?: boolean
  error?: unknown
  onSelectRepo: (fullPath: string) => void
}

export function RepoGrid({ repos, isLoading, error, onSelectRepo }: RepoGridProps) {
  const [filter, setFilter] = React.useState('')

  const filtered = React.useMemo(() => {
    if (!filter.trim()) return repos
    const q = filter.toLowerCase()
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_path.toLowerCase().includes(q)
    )
  }, [repos, filter])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter repositories by name or path..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-xl border border-border/60 bg-card/40 pl-9 pr-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[42px]"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-xl border border-border bg-card/60 text-muted-foreground">
          Failed to load repositories. Please check connection.
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border/60 text-muted-foreground text-sm">
          {filter ? `No repositories match "${filter}"` : 'No project repositories found for this group.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((repo) => (
            <Card
              key={repo.full_path}
              className="border-border/60 bg-card/50 backdrop-blur-xs flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-xs group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Folder className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle
                        className="text-sm font-semibold truncate hover:text-primary transition-colors cursor-pointer"
                        onClick={() => onSelectRepo(repo.full_path)}
                      >
                        {repo.name}
                      </CardTitle>
                      <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                        {repo.full_path}
                      </p>
                    </div>
                  </div>

                  <a
                    href={repo.web_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                    title="Open on GitLab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-muted-foreground font-mono">
                      <ListTodo className="h-3.5 w-3.5 text-blue-500" />
                      <span>{repo.work_items_count} items</span>
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground font-mono">
                      <GitPullRequest className="h-3.5 w-3.5 text-purple-500" />
                      <span>{repo.merge_requests_count} MRs</span>
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onSelectRepo(repo.full_path)}
                    className="text-xs h-7 px-3 font-mono gap-1"
                  >
                    <Code2 className="h-3 w-3" />
                    <span>Browse Code</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
