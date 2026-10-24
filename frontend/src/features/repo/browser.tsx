import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FolderGit2,
  Folder,
  ExternalLink,
  RefreshCw,
  GitPullRequest,
  ListTodo,
  Search,
  ArrowLeft,
  Code2,
  GitCommit,
} from 'lucide-react'
import { BranchSelector, type RepoBranch } from './branch-selector'
import { FileBreadcrumbs } from './file-breadcrumbs'
import { FileTree, type TreeItem } from './file-tree'
import { CodeViewer, type FileBlobData } from './code-viewer'
import { CommitHistory, type CommitItem } from './commit-history'

interface Repository {
  name: string
  full_path: string
  web_url: string
  work_items_count: number
  merge_requests_count: number
}

export function RepoBrowserView({ slug }: { slug: string }) {
  const [search, setSearch] = React.useState('')
  const [selectedProject, setSelectedProject] = React.useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('project')
    }
    return null
  })
  const [selectedBranch, setSelectedBranch] = React.useState<string>('')
  const [currentPath, setCurrentPath] = React.useState<string>('')
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<'code' | 'commits'>('code')

  // Sync state to URL search parameters for linkability
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (selectedProject) {
      params.set('project', selectedProject)
    } else {
      params.delete('project')
    }
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    window.history.replaceState({}, '', newUrl)
  }, [selectedProject])

  // 1. Fetch repositories under this group
  const {
    data: repos,
    isLoading: isReposLoading,
    error: reposError,
    refetch: refetchRepos,
    isFetching: isReposFetching,
  } = useQuery({
    queryKey: ['repositories', slug],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/groups/{slug}/repositories', {
        params: { path: { slug } },
      })
      if (error || !data) throw new Error('Failed to load repositories')
      return data as Repository[]
    },
  })

  // 2. Fetch branches for the selected repository
  const {
    data: branches,
    isLoading: isBranchesLoading,
  } = useQuery({
    queryKey: apiKeys.repoBranches(selectedProject ?? ''),
    queryFn: async () => {
      if (!selectedProject) return []
      const { data, error } = await apiClient.GET('/api/repo/branches', {
        params: { query: { project: selectedProject } },
      })
      if (error || !data) throw new Error('Failed to load branches')
      return data as RepoBranch[]
    },
    enabled: !!selectedProject,
  })

  // Derive active branch without cascading state updates
  const effectiveBranch =
    selectedBranch ||
    branches?.find((b) => b.default)?.name ||
    branches?.[0]?.name ||
    ''

  // 3. Fetch directory tree
  const {
    data: treeItems,
    isLoading: isTreeLoading,
    refetch: refetchTree,
  } = useQuery({
    queryKey: apiKeys.repoTree(selectedProject ?? '', currentPath, effectiveBranch),
    queryFn: async () => {
      if (!selectedProject) return []
      const { data, error } = await apiClient.GET('/api/repo/tree', {
        params: {
          query: {
            project: selectedProject,
            ref: effectiveBranch || undefined,
            path: currentPath || undefined,
          },
        },
      })
      if (error || !data) throw new Error('Failed to load tree')
      return data as TreeItem[]
    },
    enabled: !!selectedProject && !selectedFile && activeTab === 'code',
  })

  // 4. Fetch file blob content
  const {
    data: fileBlob,
    isLoading: isBlobLoading,
  } = useQuery({
    queryKey: apiKeys.repoBlob(selectedProject ?? '', selectedFile ?? '', effectiveBranch),
    queryFn: async () => {
      if (!selectedProject || !selectedFile) return null
      const { data, error } = await apiClient.GET('/api/repo/blob', {
        params: {
          query: {
            project: selectedProject,
            file_path: selectedFile,
            ref: effectiveBranch || undefined,
          },
        },
      })
      if (error || !data) throw new Error('Failed to load file content')
      return data as FileBlobData
    },
    enabled: !!selectedProject && !!selectedFile && activeTab === 'code',
  })

  // 5. Fetch commits history
  const {
    data: commits,
    isLoading: isCommitsLoading,
    refetch: refetchCommits,
  } = useQuery({
    queryKey: apiKeys.repoCommits(selectedProject ?? '', currentPath, effectiveBranch),
    queryFn: async () => {
      if (!selectedProject) return []
      const { data, error } = await apiClient.GET('/api/repo/commits', {
        params: {
          query: {
            project: selectedProject,
            ref: effectiveBranch || undefined,
            path: currentPath || undefined,
            limit: 40,
          },
        },
      })
      if (error || !data) throw new Error('Failed to load commits')
      return data as CommitItem[]
    },
    enabled: !!selectedProject && activeTab === 'commits',
  })

  const activeRepo = (repos || []).find((r) => r.full_path === selectedProject)
  const activeRepoName = activeRepo?.name ?? selectedProject?.split('/').pop() ?? 'Repository'

  const filteredRepos = (repos || []).filter(
    (repo) =>
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      repo.full_path.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectRepo = (fullPath: string) => {
    setSelectedProject(fullPath)
    setSelectedBranch('')
    setCurrentPath('')
    setSelectedFile(null)
    setActiveTab('code')
  }

  const handleNavigateUp = () => {
    if (!currentPath) return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    setCurrentPath(parts.join('/'))
  }

  return (
    <div className="space-y-6">
      {/* Global Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight font-display">
              {selectedProject ? activeRepoName : 'Code & Repository Browser'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {selectedProject
              ? `Browse source code, files, and commit logs directly in-app for ${selectedProject}`
              : `GitLab project repositories, branch structures, and code bases for ${slug}.`}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {selectedProject && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedProject(null)
                setSelectedFile(null)
                setCurrentPath('')
              }}
              className="gap-1.5 text-xs font-mono min-h-[36px]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>All Repositories</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!selectedProject) {
                refetchRepos()
              } else if (activeTab === 'code') {
                refetchTree()
              } else {
                refetchCommits()
              }
            }}
            disabled={isReposFetching}
            className="min-h-[36px] gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isReposFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* VIEW 1: REPOSITORY LISTING */}
      {!selectedProject ? (
        <>
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

          {isReposLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
              {[1, 2].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-muted/40" />
              ))}
            </div>
          ) : reposError ? (
            <div className="p-8 text-center rounded-lg border border-border bg-card/60 text-muted-foreground">
              Failed to load repositories. Please check your connection.
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="p-12 text-center rounded-lg border border-dashed border-border/60 text-muted-foreground text-sm">
              No project repositories found for this group.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRepos.map((repo) => (
                <Card
                  key={repo.full_path}
                  className="border-border/60 bg-card/60 backdrop-blur-xs flex flex-col justify-between hover:border-primary/50 transition-colors"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                          <Folder className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-semibold truncate hover:text-primary transition-colors cursor-pointer" onClick={() => handleSelectRepo(repo.full_path)}>
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
                        onClick={() => handleSelectRepo(repo.full_path)}
                        className="text-xs h-7 px-2.5 font-mono gap-1"
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
        </>
      ) : (
        /* VIEW 2: ACTIVE REPOSITORY CODE BROWSER */
        <div className="space-y-4">
          {/* Subheader Toolbar */}
          <div className="relative z-30 flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border/60 bg-card/60 backdrop-blur-xs">
            <div className="flex flex-wrap items-center gap-3">
              <BranchSelector
                branches={branches || []}
                selectedBranch={effectiveBranch}
                recentCommits={commits || []}
                onSelectBranch={(branch) => {
                  setSelectedBranch(branch)
                  setSelectedFile(null)
                }}
                isLoading={isBranchesLoading}
              />

              <div className="flex items-center rounded-md bg-muted/60 p-0.5 border border-border/40 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setActiveTab('code')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
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
                  onClick={() => setActiveTab('commits')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
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

            {activeRepo?.web_url && (
              <a
                href={activeRepo.web_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground font-mono rounded hover:bg-accent/40 transition-colors"
              >
                <span>GitLab Web</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Detached commit banner if browsing at a specific commit SHA */}
          {/^[0-9a-f]{7,40}$/i.test(effectiveBranch) && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-purple-500/10 border border-purple-500/20 text-xs font-mono">
              <div className="flex items-center gap-2 text-foreground">
                <GitCommit className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                <span>
                  Browsing tree at commit <strong className="text-purple-300">{effectiveBranch.slice(0, 8)}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const defaultBranch = branches?.find((b) => b.default)?.name || 'main'
                  setSelectedBranch(defaultBranch)
                  setSelectedFile(null)
                }}
                className="text-xs text-primary hover:underline hover:text-primary/80 transition-colors shrink-0"
              >
                Switch to default branch
              </button>
            </div>
          )}

          {/* TAB 1: CODE & FILE TREE */}
          {activeTab === 'code' && (
            <div className="space-y-3">
              <FileBreadcrumbs
                repoName={activeRepoName}
                currentPath={selectedFile || currentPath}
                onNavigate={(path) => {
                  setSelectedFile(null)
                  setCurrentPath(path)
                }}
              />

              {selectedFile && fileBlob ? (
                <CodeViewer
                  data={fileBlob}
                  projectWebUrl={activeRepo?.web_url}
                  onBack={() => setSelectedFile(null)}
                  isLoading={isBlobLoading}
                />
              ) : (
                <FileTree
                  items={treeItems || []}
                  currentPath={currentPath}
                  onSelectPath={(path) => {
                    setCurrentPath(path)
                    setSelectedFile(null)
                  }}
                  onSelectFile={(filePath) => setSelectedFile(filePath)}
                  onNavigateUp={handleNavigateUp}
                  isLoading={isTreeLoading}
                />
              )}
            </div>
          )}

          {/* TAB 2: COMMITS */}
          {activeTab === 'commits' && (
            <div className="space-y-3">
              <CommitHistory
                commits={commits || []}
                isLoading={isCommitsLoading}
                onSelectCommit={(commitId) => {
                  setSelectedBranch(commitId)
                  setSelectedFile(null)
                  setActiveTab('code')
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
