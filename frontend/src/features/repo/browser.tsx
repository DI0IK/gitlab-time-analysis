import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FolderGit2, Folder, ExternalLink, RefreshCw, GitPullRequest, ListTodo, Search } from 'lucide-react'

interface Repository {
  name: string
  full_path: string
  web_url: string
  work_items_count: number
  merge_requests_count: number
}

export function RepoBrowserView({ slug }: { slug: string }) {
  const [search, setSearch] = React.useState('')

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['repositories', slug],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/groups/{slug}/repositories', {
        params: { path: { slug } },
      })
      if (error || !data) throw new Error('Failed to load repositories')
      return data as Repository[]
    },
  })

  const filtered = (data || []).filter(
    (repo) =>
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      repo.full_path.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight font-display">Code & Repository Browser</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            GitLab project repositories, branch structures, and code bases for {slug}.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="self-start sm:self-auto min-h-[44px] sm:min-h-[36px] gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter repositories by name or path..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[44px]"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-lg border border-border bg-card/60 text-muted-foreground">
          Failed to load repositories. Please check your connection.
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-lg border border-dashed border-border/60 text-muted-foreground text-sm">
          No project repositories found for this group.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((repo) => (
            <Card key={repo.full_path} className="border-border/60 bg-card/60 backdrop-blur-xs flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <Folder className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold truncate hover:text-primary transition-colors">
                        <a href={repo.web_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
                          <span>{repo.name}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </CardTitle>
                      <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">{repo.full_path}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
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
                  <Badge variant="outline" className="text-[10px] font-mono">GitLab Repo</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
